import { isValid, parseISO } from 'date-fns';

import { prisma } from './prisma.ts';
import { createSessionEditorDraftFromPersisted, serializeSessionEditorDraft, type SessionEditorDraft } from './session-editor.ts';
import { deriveSessionEditorMetrics } from './session-editor.ts';
import {
  serializeSessionSnapshot,
  validateSessionSnapshotDraft,
} from './session-snapshot-service.ts';

const MAX_NOTES_LENGTH = 2000;

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
  } | null;
  athlete: { coachId: number | null } | null;
};

type CompletionDatabase = {
  session: {
    findUnique(args: unknown): Promise<OutcomeSession | null>;
    update(args: unknown): Promise<unknown>;
  };
  block: {
    deleteMany(args: unknown): Promise<unknown>;
  };
  activity: {
    upsert(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
  };
  $transaction(operations: Array<Promise<unknown>>): Promise<unknown>;
};

export type CompletionInput = { notes?: string };
export type ActualActor = { role: 'ATHLETE' | 'COACH'; userId: number };

export type CompletionResult =
  | { ok: true; sessionId: number; isDone: boolean; notes: string; completedAt: Date | null }
  | { ok: false; status: 400 | 404; error: string };

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
      return { ok: false, status: 400, error: 'Actual outcome edits require actual mode.' };
    }
    const validationError = validateSessionSnapshotDraft(draft);
    if (validationError) return { ok: false, status: 400, error: validationError };
    if (!canEditActual(actor, session)) {
      return { ok: false, status: 404, error: 'Session not found' };
    }
    if (draft.athleteId !== null && draft.athleteId !== session.athleteId) {
      return { ok: false, status: 404, error: 'Session not found' };
    }

    const metrics = deriveSessionEditorMetrics(draft);
    const serialized = serializeSessionEditorDraft(draft);
    const actualSnapshotJson = serializeSessionSnapshot(draft);
    const completedAt = session.activity?.completedAt ?? new Date();
    const blocks = serialized.blocks.map((block) => ({
      kind: block.kind,
      zone: block.zone,
      durationSec: block.durationSec,
      reps: block.reps,
      targetType: block.targetType,
      targetMode: block.targetMode,
      targetReference: block.targetReference,
      targetLow: block.targetLow,
      targetHigh: block.targetHigh,
      targetLowDecimal: block.targetLowDecimal,
      targetHighDecimal: block.targetHighDecimal,
      note: block.note,
      skipped: block.skipped,
      sortOrder: block.sortOrder,
    }));

    const sessionDate = session.date ?? parseSessionDate(draft.scheduledDate);
    await db.$transaction([
      db.block.deleteMany({ where: { sessionId: session.id } }),
      db.session.update({
        where: { id: session.id },
        data: {
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
          coachBaselineJson: session.coachBaselineJson,
          blocks: { create: blocks },
        },
      }),
      db.activity.upsert({
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
      }),
    ]);

    return { ok: true, sessionId: session.id, isDone: true, completedAt };
  }

  return {
    async saveActualOutcome(actor: ActualActor, sessionId: number, draft: SessionEditorDraft): Promise<ActualOutcomeResult> {
      const session = await db.session.findUnique({
        where: { id: sessionId },
        include: {
          blocks: { orderBy: { sortOrder: 'asc' } },
          activity: true,
          athlete: { select: { coachId: true } },
        },
      });
      if (!session || !canEditActual(actor, session)) {
        return { ok: false, status: 404, error: 'Session not found' };
      }
      return saveActualForSession(actor, session, draft);
    },

    async completeSession(athleteId: number, sessionId: number, input: CompletionInput): Promise<CompletionResult> {
      const notes = normalizeNotes(input);
      if (notes === 'invalid') return { ok: false, status: 400, error: 'Notes are too long' };

      const session = await loadSessionForAthlete(athleteId, sessionId);
      if (!session) return { ok: false, status: 404, error: 'Session not found' };

      const retainedNotes = notes ?? session.activity?.notes ?? session.athleteNotes ?? null;
      const draft = createSessionEditorDraftFromPersisted('actual', {
        ...session,
        status: 'completed',
        scheduledDate: session.date,
        athleteNotes: retainedNotes,
        blocks: session.blocks,
      });
      const result = await saveActualForSession({ role: 'ATHLETE', userId: athleteId }, session, draft);
      if (!result.ok) return { ok: false, status: result.status === 409 ? 404 : result.status, error: result.error };
      return { ok: true, sessionId: result.sessionId, isDone: true, notes: retainedNotes ?? '', completedAt: result.completedAt };
    },

    async reopenSession(athleteId: number, sessionId: number, input: CompletionInput): Promise<CompletionResult> {
      const notes = normalizeNotes(input);
      if (notes === 'invalid') return { ok: false, status: 400, error: 'Notes are too long' };

      const session = await loadSessionForAthlete(athleteId, sessionId);
      if (!session) return { ok: false, status: 404, error: 'Session not found' };

      const retainedNotes = notes ?? session.activity?.notes ?? session.athleteNotes ?? null;
      await db.$transaction([
        ...(session.activity ? [db.activity.delete({ where: { sessionId: session.id } })] : []),
        db.session.update({
          where: { id: session.id },
          data: { status: 'planned', athleteNotes: retainedNotes },
        }),
      ]);

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
