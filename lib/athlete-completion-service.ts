import { sessionEditorInput } from './session-write-input.ts';
import { isValid, parseISO } from 'date-fns';

import { prisma } from './prisma.ts';
import { SESSION_CHANGED_ERROR, SKIPPED_SESSION_STATUS } from './athlete-session-status-service.ts';
import { createSessionEditorBlockData, createSessionEditorDraftFromPersisted, serializeSessionEditorDraft, type SessionEditorDraft } from './session-editor.ts';
import { deriveSessionEditorMetrics } from './session-editor.ts';
import {
  createSessionSnapshotJson,
  serializeSessionSnapshot,
  validateSessionSnapshotDraft,
} from './session-snapshot-service.ts';

const MAX_NOTES_LENGTH = 2000;
const SKIPPED_OUTCOME_ERROR = 'You can’t log a result for a skipped workout. Choose Plan again first.';
const RECORDED_OUTCOME_ERROR = 'This result comes from a recorded activity. You can only change its note here. To remove it, delete the activity.';
// Outcomes this service derives from planned or edited blocks. Every other
// source (ride recordings, file/Strava/TCX/FIT/GPX imports, manual activity
// logs) carries measured data owned elsewhere, so only its note may change here.
const COMPLETION_OWNED_SOURCES = new Set(['manual-actual', 'manual-planned']);

export function isRecordedOutcome(activity: { metricsSource: string } | null | undefined) {
  return Boolean(activity && !COMPLETION_OWNED_SOURCES.has(activity.metricsSource));
}

type OutcomeSession = {
  id: number;
  athleteId: number | null;
  date: Date | null;
  timeLabel: string | null;
  sport: string;
  title: string;
  summary: string | null;
  coachNotes: string | null;
  athleteNotes: string | null;
  sportMetricsJson: string | null;
  rpe: number | null;
  status: string;
  updatedAt: Date;
  source: string;
  adjusted: boolean;
  coachBaselineJson: string | null;
  blocks: Array<{
    id: number;
    kind: string;
    zone: number;
    durationSec: number;
    reps: number | null;
    targetType: string | null;
    targetMode?: string | null;
    targetReference?: string | null;
    targetLow: number | null;
    targetHigh: number | null;
    targetLowDecimal?: string | null;
    targetHighDecimal?: string | null;
    note: string | null;
    skipped: boolean;
    sortOrder: number;
  }>;
  activity: {
    completedAt: Date;
    notes: string | null;
    metricsSource: string;
  } | null;
  athlete: { coachId: number | null } | null;
};

type CompletionTransaction = {
  session: {
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  block: {
    deleteMany(args: unknown): Promise<unknown>;
  };
  activity: {
    upsert(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
    delete(args: unknown): Promise<unknown>;
  };
};

type CompletionDatabase = {
  session: {
    findUnique(args: unknown): Promise<OutcomeSession | null>;
  };
  $transaction<T>(run: (tx: CompletionTransaction) => Promise<T>): Promise<T>;
};

const SESSION_CHANGED: { ok: false; status: 409; error: string } = { ok: false, status: 409, error: SESSION_CHANGED_ERROR };

// Claim the exact row the caller validated: if a ride upload, completion or
// other edit committed after that read, updatedAt, status or the outcome no
// longer match and nothing is written. The claim also locks the row for the
// rest of the transaction.
function claimValidatedSession(tx: CompletionTransaction, session: OutcomeSession, data: Record<string, unknown>) {
  return tx.session.updateMany({
    where: {
      id: session.id,
      athleteId: session.athleteId,
      status: session.status,
      updatedAt: session.updatedAt,
      activity: session.activity ? { is: { metricsSource: session.activity.metricsSource } } : { is: null },
    },
    data,
  });
}

export type CompletionInput = { notes?: string };
export type ActualActor = { role: 'ATHLETE' | 'COACH'; userId: number };

export type CompletionResult =
  | { ok: true; sessionId: number; isDone: boolean; notes: string; completedAt: Date | null }
  | { ok: false; status: 400 | 404 | 409; error: string };

export type ActualOutcomeResult =
  | { ok: true; sessionId: number; isDone: true; completedAt: Date }
  | { ok: false; status: 400 | 404 | 409; error: string };

export function createAthleteCompletionService({
  db = prisma as unknown as CompletionDatabase,
}: { db?: CompletionDatabase } = {}) {
  function normalizeNotes(input: CompletionInput): string | null | 'invalid' {
    if (input.notes === undefined) return null;
    const notes = input.notes.trim();
    if (notes.length > MAX_NOTES_LENGTH) return 'invalid';
    return notes || null;
  }

  async function loadSessionForAthlete(athleteId: number, sessionId: number) {
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' } },
        activity: true,
        athlete: { select: { coachId: true } },
      },
    });
    return session && session.athleteId === athleteId ? session : null;
  }

  function canEditActual(actor: ActualActor, session: OutcomeSession) {
    return actor.role === 'ATHLETE'
      ? session.athleteId === actor.userId
      : session.athlete?.coachId === actor.userId;
  }

  async function saveActualForSession(
    actor: ActualActor,
    session: OutcomeSession,
    draft: SessionEditorDraft,
  ): Promise<ActualOutcomeResult> {
    if (draft.mode !== 'actual') {
      return { ok: false, status: 400, error: 'Could not save your result. Reload the page and try again.' };
    }
    const validationError = validateSessionSnapshotDraft(draft);
    if (validationError) return { ok: false, status: 400, error: validationError };
    if (!canEditActual(actor, session)) {
      return { ok: false, status: 404, error: 'Workout not found.' };
    }
    if (session.status === SKIPPED_SESSION_STATUS) {
      return { ok: false, status: 409, error: SKIPPED_OUTCOME_ERROR };
    }
    if (isRecordedOutcome(session.activity)) {
      return { ok: false, status: 409, error: RECORDED_OUTCOME_ERROR };
    }
    if (draft.athleteId !== null && draft.athleteId !== session.athleteId) {
      return { ok: false, status: 404, error: 'Workout not found.' };
    }

    const metrics = deriveSessionEditorMetrics(draft);
    const serialized = serializeSessionEditorDraft(draft);
    const actualSnapshotJson = serializeSessionSnapshot(draft);
    const plannedBaselineJson =
      session.coachBaselineJson ??
      (session.status !== 'completed'
        ? createSessionSnapshotJson({
            ...session,
            scheduledDate: session.date,
            blocks: session.blocks,
          })
        : null);
    const completedAt = session.activity?.completedAt ?? new Date();
    const blocks = createSessionEditorBlockData(serialized.blocks);

    const sessionDate = session.date ?? parseSessionDate(draft.scheduledDate);
    const claimed = await db.$transaction(async (tx) => {
      const claim = await claimValidatedSession(tx, session, {
          date: sessionDate,
          timeLabel: serialized.timeLabel ?? session.timeLabel,
          sport: serialized.sport,
          title: serialized.title,
          summary: serialized.summary,
          coachNotes: actor.role === 'COACH' ? serialized.coachNotes : session.coachNotes,
          athleteNotes: serialized.athleteNotes,
          sportMetricsJson: JSON.stringify(serialized.sportMetrics),
          rpe: serialized.rpe,
          status: 'completed',
          adjusted: session.adjusted,
          coachBaselineJson: plannedBaselineJson,
      });
      if (claim.count !== 1) return false;
      await tx.block.deleteMany({ where: { sessionId: session.id } });
      await tx.session.update({ where: { id: session.id }, data: { blocks: { create: blocks } } });
      await tx.activity.upsert({
        where: { sessionId: session.id },
        update: {
          completedAt,
          durationSec: metrics.durationSec,
          tss: metrics.tss,
          compliancePct: null,
          zoneDistributionJson: JSON.stringify(metrics.zoneDistributionSec),
          segmentsJson: JSON.stringify(metrics.segments),
          metricsSource: 'manual-actual',
          notes: serialized.athleteNotes,
          actualSnapshotJson,
          rpe: serialized.rpe,
        },
        create: {
          sessionId: session.id,
          athleteId: session.athleteId ?? actor.userId,
          completedAt,
          durationSec: metrics.durationSec,
          tss: metrics.tss,
          compliancePct: null,
          zoneDistributionJson: JSON.stringify(metrics.zoneDistributionSec),
          segmentsJson: JSON.stringify(metrics.segments),
          metricsSource: 'manual-actual',
          notes: serialized.athleteNotes,
          actualSnapshotJson,
          rpe: serialized.rpe,
        },
      });
      return true;
    });
    if (!claimed) return SESSION_CHANGED;

    return { ok: true, sessionId: session.id, isDone: true, completedAt };
  }

  return {
    async saveActualOutcome(actor: ActualActor, sessionId: number, input: unknown): Promise<ActualOutcomeResult> {
      const parsed = sessionEditorInput.safeParse(input);
      if (!parsed.success) return { ok: false, status: 400, error: 'Some details are missing or wrong. Check them and try again.' };
      const session = await db.session.findUnique({
        where: { id: sessionId },
        include: {
          blocks: { orderBy: { sortOrder: 'asc' } },
          activity: true,
          athlete: { select: { coachId: true } },
        },
      });
      if (!session || !canEditActual(actor, session)) {
        return { ok: false, status: 404, error: 'Workout not found.' };
      }
      return saveActualForSession(actor, session, parsed.data);
    },

    async completeSession(athleteId: number, sessionId: number, input: CompletionInput): Promise<CompletionResult> {
      const notes = normalizeNotes(input);
      if (notes === 'invalid') return { ok: false, status: 400, error: 'Your note is too long.' };

      const session = await loadSessionForAthlete(athleteId, sessionId);
      if (!session) return { ok: false, status: 404, error: 'Workout not found.' };
      if (session.status === SKIPPED_SESSION_STATUS) return { ok: false, status: 409, error: SKIPPED_OUTCOME_ERROR };

      const retainedNotes = notes ?? session.activity?.notes ?? session.athleteNotes ?? null;
      if (session.activity && isRecordedOutcome(session.activity)) {
        // Only notes change, so a stale read cannot clobber measured data; the
        // conditional update just turns a concurrently deleted activity into a 409.
        const updated = await db.$transaction(async (tx) => {
          const activity = await tx.activity.updateMany({
            where: { sessionId: session.id, metricsSource: session.activity!.metricsSource },
            data: { notes: retainedNotes },
          });
          if (activity.count !== 1) return false;
          await tx.session.update({ where: { id: session.id }, data: { athleteNotes: retainedNotes } });
          return true;
        });
        if (!updated) return SESSION_CHANGED;
        return { ok: true, sessionId: session.id, isDone: true, notes: retainedNotes ?? '', completedAt: session.activity.completedAt };
      }
      const draft = createSessionEditorDraftFromPersisted('actual', {
        ...session,
        status: 'completed',
        scheduledDate: session.date,
        athleteNotes: retainedNotes,
        blocks: session.blocks,
      });
      const result = await saveActualForSession({ role: 'ATHLETE', userId: athleteId }, session, draft);
      if (!result.ok) return { ok: false, status: result.status, error: result.error };
      return { ok: true, sessionId: result.sessionId, isDone: true, notes: retainedNotes ?? '', completedAt: result.completedAt };
    },

    async reopenSession(athleteId: number, sessionId: number, input: CompletionInput): Promise<CompletionResult> {
      const notes = normalizeNotes(input);
      if (notes === 'invalid') return { ok: false, status: 400, error: 'Your note is too long.' };

      const session = await loadSessionForAthlete(athleteId, sessionId);
      if (!session) return { ok: false, status: 404, error: 'Workout not found.' };
      if (session.status === SKIPPED_SESSION_STATUS) return { ok: false, status: 409, error: SKIPPED_OUTCOME_ERROR };
      if (isRecordedOutcome(session.activity)) return { ok: false, status: 409, error: RECORDED_OUTCOME_ERROR };

      const retainedNotes = notes ?? session.activity?.notes ?? session.athleteNotes ?? null;
      const claimed = await db.$transaction(async (tx) => {
        const claim = await claimValidatedSession(tx, session, { status: 'planned', athleteNotes: retainedNotes });
        if (claim.count !== 1) return false;
        if (session.activity) await tx.activity.delete({ where: { sessionId: session.id } });
        return true;
      });
      if (!claimed) return SESSION_CHANGED;

      return { ok: true, sessionId: session.id, isDone: false, notes: retainedNotes ?? '', completedAt: null };
    },
  };
}

function parseSessionDate(input: string | null) {
  if (!input) return null;
  const parsed = parseISO(`${input}T00:00:00.000Z`);
  return isValid(parsed) ? parsed : null;
}

export const athleteCompletionService = createAthleteCompletionService();
