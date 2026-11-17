import { sessionEditorInput } from './session-write-input.ts';
import { endOfWeek, isValid, parseISO, startOfWeek } from 'date-fns';

import { prisma } from './prisma.ts';
import {
  createSessionEditorBlockData,
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
} from './session-editor.ts';
import { validateSessionSnapshotDraft } from './session-snapshot-service.ts';
import { SKIPPED_SESSION_STATUS } from './athlete-session-status-service.ts';

type AdjustmentSession = {
  id: number;
  athleteId: number | null;
  coachOwnerId: number | null;
  trainingPlanId: number | null;
  planId: number | null;
  templateId: number | null;
  assignedById: number | null;
  date: Date | null;
  planWeekday: number | null;
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
  activity: { id: number } | null;
};

type AdjustmentDatabase = {
  session: {
    findUnique(args: unknown): Promise<AdjustmentSession | null>;
    update(args: unknown): Promise<unknown>;
  };
  plan: {
    findFirst(args: unknown): Promise<{ id: number } | null>;
    create(args: unknown): Promise<{ id: number }>;
  };
  block: {
    deleteMany(args: unknown): Promise<unknown>;
  };
  assignment: {
    updateMany(args: unknown): Promise<unknown>;
  };
  $transaction(operations: Array<Promise<unknown>>): Promise<unknown>;
};

type AdjustmentResult =
  | { ok: true; sessionId: number }
  | { ok: false; status: 400 | 404 | 409; error: string };

export function createAthleteSessionAdjustmentService({
  db = prisma as unknown as AdjustmentDatabase,
}: { db?: AdjustmentDatabase } = {}) {
  return {
    async savePlannedSession(
      athleteId: number,
      sessionId: number,
      input: unknown,
    ): Promise<AdjustmentResult> {
      const parsed = sessionEditorInput.safeParse(input);
      if (!parsed.success) return { ok: false as const, status: 400, error: 'Invalid session draft.' };
      const draft = parsed.data;
      if (draft.mode !== 'planned') {
        return { ok: false, status: 400, error: 'Planned session edits require planned mode.' };
      }

      const validationError = validateSessionSnapshotDraft(draft) ?? validateSessionEditorDraft(draft);
      if (validationError) return { ok: false, status: 400, error: validationError };
      if (draft.athleteId !== athleteId) return { ok: false, status: 404, error: 'Session not found.' };

      const session = await db.session.findUnique({
        where: { id: sessionId },
        include: {
          blocks: { orderBy: { sortOrder: 'asc' } },
          activity: { select: { id: true } },
        },
      });
      if (!session || session.athleteId !== athleteId) {
        return { ok: false, status: 404, error: 'Session not found.' };
      }
      if (session.activity || session.status === 'completed') {
        return { ok: false, status: 409, error: 'Completed sessions cannot be adjusted.' };
      }
      if (!draft.scheduledDate) {
        return { ok: false, status: 400, error: 'A valid scheduled date is required.' };
      }

      const scheduledDate = parseISO(`${draft.scheduledDate}T00:00:00.000Z`);
      if (!isValid(scheduledDate)) {
        return { ok: false, status: 400, error: 'A valid scheduled date is required.' };
      }

      const weekStart = startOfWeek(scheduledDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(scheduledDate, { weekStartsOn: 1 });
      const plan =
        (await db.plan.findFirst({
          where: { athleteId, startDate: weekStart, endDate: weekEnd },
          orderBy: { id: 'desc' },
        })) ??
        (await db.plan.create({
          data: {
            athleteId,
            name: `Week of ${weekStart.toISOString().slice(0, 10)}`,
            startDate: weekStart,
            endDate: weekEnd,
          },
        }));

      const serialized = serializeSessionEditorDraft(draft);
      const baselineJson = session.coachBaselineJson;
      const blocks = createSessionEditorBlockData(serialized.blocks);

      await db.$transaction([
        db.block.deleteMany({ where: { sessionId } }),
        db.session.update({
          where: { id: sessionId },
          data: {
            templateId: session.templateId,
            assignedById: session.assignedById,
            trainingPlanId: session.trainingPlanId,
            planId: plan.id,
            date: scheduledDate,
            planWeekday: null,
            timeLabel: serialized.timeLabel,
            sport: serialized.sport,
            title: serialized.title,
            summary: serialized.summary,
            coachNotes: session.coachNotes,
            athleteNotes: serialized.athleteNotes,
            source: session.source,
            sportMetricsJson: JSON.stringify(serialized.sportMetrics),
            rpe: serialized.rpe,
            // Editing a skipped session keeps it skipped; "Plan again" is the only way back.
            status: session.status === SKIPPED_SESSION_STATUS ? SKIPPED_SESSION_STATUS : 'planned',
            adjusted: true,
            coachBaselineJson: baselineJson,
            blocks: { create: blocks },
          },
        }),
        db.assignment.updateMany({
          where: { sessionId, athleteId },
          data: { targetDate: scheduledDate },
        }),
      ]);

      return { ok: true, sessionId };
    },
  };
}

export const athleteSessionAdjustmentService = createAthleteSessionAdjustmentService();
