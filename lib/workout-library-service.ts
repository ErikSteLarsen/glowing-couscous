import { prisma } from './prisma.ts';
import {
  normalizeSessionEditorDraft,
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
} from './session-editor.ts';

export type WorkoutLibraryOwner = 'coach' | 'athlete';

type WorkoutLibraryDeps = {
  db?: typeof prisma;
};

function ownerWhere(owner: WorkoutLibraryOwner, ownerId: number) {
  return owner === 'coach'
    ? { coachOwnerId: ownerId, athleteId: null }
    : { athleteId: ownerId, coachOwnerId: null };
}

function standaloneWhere(owner: WorkoutLibraryOwner, ownerId: number) {
  return {
    ...ownerWhere(owner, ownerId),
    trainingPlanId: null,
    planId: null,
    date: null,
  };
}

function normalizeWorkoutDraft(input: unknown) {
  const draft = normalizeSessionEditorDraft(input);

  if (draft.scheduledDate !== null) {
    return { draft, error: 'Standalone workouts cannot be assigned to a date.' };
  }

  if (draft.planWeekday !== null) {
    return { draft, error: 'Standalone workouts cannot be assigned to a weekday.' };
  }

  return { draft, error: validateSessionEditorDraft(draft) };
}

function blockData(draft: ReturnType<typeof normalizeSessionEditorDraft>) {
  return draft.blocks.map((block, sortOrder) => ({
    kind: block.kind,
    zone: block.zone,
    durationSec: block.durationSec,
    reps: block.reps,
    targetType: block.target?.metric ?? null,
    targetMode: block.target?.mode ?? 'absolute',
    targetReference: block.target?.reference ?? null,
    targetLow: block.target?.low ?? null,
    targetHigh: block.target?.high ?? null,
    targetLowDecimal: block.target ? String(block.target.low) : null,
    targetHighDecimal: block.target ? String(block.target.high) : null,
    note: block.note.trim() || null,
    skipped: block.skipped,
    sortOrder,
  }));
}

export function createWorkoutLibraryService({ db = prisma }: WorkoutLibraryDeps = {}) {
  return {
    async listForOwner(owner: WorkoutLibraryOwner, ownerId: number) {
      return db.session.findMany({
        where: standaloneWhere(owner, ownerId),
        include: { blocks: { orderBy: { sortOrder: 'asc' } } },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
      });
    },

    async saveForOwner(owner: WorkoutLibraryOwner, ownerId: number, input: unknown, sessionId?: number) {
      const normalized = normalizeWorkoutDraft(input);
      if (normalized.error) {
        return { ok: false as const, error: normalized.error, status: 400 };
      }

      const draft = normalized.draft;
      const serialized = serializeSessionEditorDraft(draft);
      if (serialized.templateId !== null) {
        const template = await db.template.findFirst({
          where: { id: serialized.templateId, ownerId },
          select: { id: true },
        });
        if (!template) {
          return { ok: false as const, error: 'Template not found.', status: 404 };
        }
      }
      const existing = sessionId
        ? await db.session.findFirst({
            where: { id: sessionId, ...standaloneWhere(owner, ownerId) },
            select: { id: true, activity: { select: { id: true } } },
          })
        : null;

      if (sessionId && !existing) {
        return { ok: false as const, error: 'Workout not found.', status: 404 };
      }

      if (existing?.activity) {
        return { ok: false as const, error: 'Completed workouts cannot be edited here.', status: 409 };
      }

      const data = {
        ...ownerWhere(owner, ownerId),
        trainingPlanId: null,
        planId: null,
        date: null,
        timeLabel: null,
        templateId: serialized.templateId,
        assignedById: null,
        sport: serialized.sport,
        title: serialized.title,
        summary: serialized.summary,
        sportMetricsJson: JSON.stringify(serialized.sportMetrics),
        status: 'planned',
        source: owner === 'coach' ? 'coach-library' : 'athlete-library',
        adjusted: false,
        blocks: { create: blockData(draft) },
      };

      if (!sessionId) {
        const created = await db.session.create({ data });
        return { ok: true as const, sessionId: created.id };
      }

      await db.$transaction([
        db.block.deleteMany({ where: { sessionId } }),
        db.session.update({ where: { id: sessionId }, data }),
      ]);
      return { ok: true as const, sessionId };
    },

    async deleteForOwner(owner: WorkoutLibraryOwner, ownerId: number, sessionId: number) {
      const existing = await db.session.findFirst({
        where: { id: sessionId, ...standaloneWhere(owner, ownerId) },
        select: { id: true, activity: { select: { id: true } } },
      });

      if (!existing) return { ok: false as const, error: 'Workout not found.', status: 404 };
      if (existing.activity) return { ok: false as const, error: 'Completed workouts cannot be deleted.', status: 409 };

      await db.session.delete({ where: { id: sessionId } });
      return { ok: true as const, sessionId };
    },
  };
}

export const workoutLibraryService = createWorkoutLibraryService();
