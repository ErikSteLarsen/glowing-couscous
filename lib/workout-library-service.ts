import { prisma } from './prisma.ts';
import type { CatalogLineage } from './catalog-lineage.ts';
import { workoutCatalog } from './workout-catalog/index.ts';
import { findCatalogWorkout } from './workout-catalog/query.ts';
import { createHash } from 'node:crypto';
import {
  normalizeSessionEditorDraft,
  createSessionEditorBlockData,
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

  if (draft.templateId !== null) {
    return { draft, error: 'Training plans must be applied through Calendar.' };
  }

  if (draft.scheduledDate !== null) {
    return { draft, error: 'Saved workouts don’t have a date. Add the workout to your Calendar instead.' };
  }

  if (draft.planWeekday !== null) {
    return { draft, error: 'Saved workouts don’t have a day. Add the workout to your Calendar instead.' };
  }

  return { draft, error: validateSessionEditorDraft(draft) };
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

    async getForOwner(owner: WorkoutLibraryOwner, ownerId: number, sessionId: number) {
      return db.session.findFirst({
        where: { id: sessionId, ...standaloneWhere(owner, ownerId) },
        include: { blocks: { orderBy: { sortOrder: 'asc' } } },
      });
    },

    async saveForOwner(owner: WorkoutLibraryOwner, ownerId: number, input: unknown, sessionId?: number, lineage?: CatalogLineage) {
      const safety = input && typeof input === 'object' ? input as { requestKey?: unknown; expectedUpdatedAt?: unknown; catalogWorkoutSlug?: unknown } : {};
      if (safety.requestKey !== undefined && (typeof safety.requestKey !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(safety.requestKey))) return { ok: false as const, error: 'Something went wrong. Reload the page and try again.', status: 400 };
      if (safety.expectedUpdatedAt !== undefined && (typeof safety.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(safety.expectedUpdatedAt)))) return { ok: false as const, error: 'Something went wrong. Reload the page and try again.', status: 400 };
      const normalized = normalizeWorkoutDraft(input);
      if (normalized.error) {
        return { ok: false as const, error: normalized.error, status: 400 };
      }

      const draft = normalized.draft;
      const serialized = serializeSessionEditorDraft(draft);
      const existing = sessionId
        ? await db.session.findFirst({
            where: { id: sessionId, ...standaloneWhere(owner, ownerId) },
            select: { id: true, updatedAt: true, activity: { select: { id: true } } },
          })
        : null;

      if (sessionId && !existing) {
        return { ok: false as const, error: 'Workout not found.', status: 404 };
      }

      if (existing?.activity) {
        return { ok: false as const, error: 'Workouts marked as done can’t be edited here.', status: 409 };
      }
      if (existing && typeof safety.expectedUpdatedAt === 'string' && existing.updatedAt.getTime() !== Date.parse(safety.expectedUpdatedAt)) return { ok: false as const, error: 'This workout was changed in another tab or window. Reload the page, or restore your changes as a new workout.', status: 409 };

      const data = {
        ...ownerWhere(owner, ownerId),
        trainingPlanId: null,
        planId: null,
        date: null,
        timeLabel: null,
        templateId: null,
        assignedById: null,
        sport: serialized.sport,
        title: serialized.title,
        summary: serialized.summary,
        sportMetricsJson: JSON.stringify(serialized.sportMetrics),
        status: 'planned',
        source: owner === 'coach' ? 'coach-library' : 'athlete-library',
        adjusted: false,
        blocks: { create: createSessionEditorBlockData(serialized.blocks) },
      };

      if (!sessionId) {
        const catalogWorkout = owner === 'athlete' && typeof safety.catalogWorkoutSlug === 'string'
          ? findCatalogWorkout(workoutCatalog, safety.catalogWorkoutSlug)
          : null;
        const createData = { ...data, ...(lineage ?? (catalogWorkout ? { catalogWorkoutSlug: catalogWorkout.slug } : {})) };
        if (typeof safety.requestKey === 'string') {
          const identity = { userId: ownerId, owner, requestKey: safety.requestKey };
          const payloadHash = createHash('sha256').update(JSON.stringify(createData)).digest('hex');
          const replay = async () => {
            const prior = await db.workoutSaveRequest.findUnique({ where: { userId_owner_requestKey: identity } });
            if (!prior || prior.payloadHash !== payloadHash || prior.sessionId === null) return { ok: false as const, error: 'Tempo couldn’t confirm your earlier save. Keep your changes and save again.', status: 409 };
            const saved = await db.session.findFirst({ where: { id: prior.sessionId, ...standaloneWhere(owner, ownerId) }, select: { id: true, updatedAt: true } });
            return saved ? { ok: true as const, sessionId: saved.id, updatedAt: saved.updatedAt.toISOString() } : { ok: false as const, error: 'The workout you saved earlier was deleted.', status: 409 };
          };
          if (await db.workoutSaveRequest.findUnique({ where: { userId_owner_requestKey: identity } })) return replay();
          try {
            return await db.$transaction(async (tx) => {
              const request = await tx.workoutSaveRequest.create({ data: { ...identity, payloadHash } });
              const created = await tx.session.create({ data: createData, select: { id: true, updatedAt: true } });
              await tx.workoutSaveRequest.update({ where: { id: request.id }, data: { sessionId: created.id } });
              return { ok: true as const, sessionId: created.id, updatedAt: created.updatedAt.toISOString() };
            });
          } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return replay();
            throw error;
          }
        }
        const created = await db.session.create({ data: createData });
        return { ok: true as const, sessionId: created.id };
      }

      if (existing && typeof safety.expectedUpdatedAt === 'string') {
        return db.$transaction(async (tx) => {
          const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
          const claimed = await tx.session.updateMany({ where: { id: sessionId, ...standaloneWhere(owner, ownerId), updatedAt: existing.updatedAt, activity: { is: null } }, data: { updatedAt } });
          if (claimed.count !== 1) return { ok: false as const, error: 'This workout changed while you were saving. Keep your changes and reload the page.', status: 409 };
          await tx.block.deleteMany({ where: { sessionId } });
          await tx.session.update({ where: { id: sessionId }, data: { ...data, updatedAt } });
          return { ok: true as const, sessionId, updatedAt: updatedAt.toISOString() };
        });
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
      if (existing.activity) return { ok: false as const, error: 'Workouts marked as done can’t be deleted.', status: 409 };

      await db.session.delete({ where: { id: sessionId } });
      return { ok: true as const, sessionId };
    },
  };
}

export const workoutLibraryService = createWorkoutLibraryService();
