import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { findOrCreatePlan } from './athlete-planner-service.ts';
import { parseCalendarDay } from './calendar-navigation.ts';
import { prisma } from './prisma.ts';
import { createSessionEditorBlockData, createSessionEditorDraftFromPersisted, normalizeSessionEditorDraft, serializeSessionEditorDraft, validateSessionEditorDraft } from './session-editor.ts';
import { STARTED_WORKOUT_SOURCE } from './started-workout.ts';
import { workoutCatalog } from './workout-catalog/index.ts';
import { findCatalogWorkout } from './workout-catalog/query.ts';
import { catalogWorkoutToSessionInput } from './workout-catalog/session.ts';
import type { CatalogWorkout } from './workout-catalog/types.ts';

export type StartSource = { kind: 'catalog'; slug: string } | { kind: 'workout'; id: number };
/** `planned`: the workout was already in today's plan, and that copy was opened. */
export type StartResult =
  | { ok: true; sessionId: number; planned: boolean }
  | { ok: false; error: string; status: 400 | 404 };

/** Sources of workouts the athlete planned themselves. */
const SELF_PLANNED_SOURCES = ['athlete', 'athlete-template', 'athlete-library-copy'];
const ABANDONED_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

type Deps = { db?: typeof prisma; catalog?: readonly CatalogWorkout[]; now?: () => Date };

export function createStartedWorkoutService({ db = prisma, catalog = workoutCatalog, now = () => new Date() }: Deps = {}) {
  async function loadContent(athleteId: number, source: StartSource) {
    if (source.kind === 'catalog') {
      const workout = findCatalogWorkout(catalog, source.slug);
      return workout ? normalizeSessionEditorDraft({ ...catalogWorkoutToSessionInput(workout), mode: 'create', athleteId }) : null;
    }
    const workout = await db.session.findFirst({
      where: { id: source.id, athleteId, coachOwnerId: null, trainingPlanId: null, planId: null, date: null },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
    });
    return workout ? createSessionEditorDraftFromPersisted('create', { ...workout, date: null, scheduledDate: null }) : null;
  }

  return {
    /**
     * Returns the session to follow or ride. A copy already planned for that day is used as it is;
     * otherwise the workout is kept out of the Calendar until its result is saved. Starting it
     * again before that returns the same session, so an unsaved ride is found again.
     */
    async start(athleteId: number, source: StartSource, input: { date?: unknown }): Promise<StartResult> {
      const date = parseCalendarDay(input.date);
      if (!date) return { ok: false, error: 'Choose a date.', status: 400 };
      const draft = await loadContent(athleteId, source);
      if (!draft) return { ok: false, error: 'Workout not found.', status: 404 };
      const invalid = validateSessionEditorDraft(draft);
      if (invalid) return { ok: false, error: invalid, status: 400 };

      const serialized = serializeSessionEditorDraft(draft);
      const blocks = createSessionEditorBlockData(serialized.blocks);
      const content = {
        sport: serialized.sport,
        title: serialized.title,
        summary: serialized.summary,
        sportMetricsJson: JSON.stringify(serialized.sportMetrics),
      };
      const payloadHash = createHash('sha256').update(JSON.stringify({ ...content, blocks })).digest('hex');
      const requestKey = `start:${source.kind}:${source.kind === 'catalog' ? source.slug : source.id}`;
      const identity = { userId_requestKey: { userId: athleteId, requestKey } };

      return db.$transaction(async (tx) => {
        // Serializes starts of one workout, so concurrent taps share a session.
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`start-workout:${athleteId}:${requestKey}`}, 0))`);

        const planned = await tx.session.findFirst({
          where: {
            athleteId,
            date: new Date(`${date}T00:00:00.000Z`),
            sport: content.sport,
            title: content.title,
            source: { in: SELF_PLANNED_SOURCES },
            status: 'planned',
            activity: { is: null },
          },
          orderBy: { id: 'desc' },
          select: { id: true },
        });
        if (planned) return { ok: true as const, sessionId: planned.id, planned: true };

        const previous = await tx.placementRequest.findUnique({ where: identity });
        const previousId = previous?.payloadHash === payloadHash ? Number(JSON.parse(previous.sessionIdsJson)[0]) : null;
        const unsaved = previousId
          ? await tx.session.findFirst({
              where: { id: previousId, athleteId, source: STARTED_WORKOUT_SOURCE, date: null, status: 'planned', activity: { is: null } },
              select: { id: true },
            })
          : null;
        if (unsaved) return { ok: true as const, sessionId: unsaved.id, planned: false };

        await tx.session.deleteMany({
          where: { athleteId, source: STARTED_WORKOUT_SOURCE, date: null, activity: { is: null }, updatedAt: { lt: new Date(now().getTime() - ABANDONED_AFTER_MS) } },
        });
        const plan = await findOrCreatePlan(tx, athleteId, date);
        const created = await tx.session.create({
          data: { athleteId, planId: plan.id, date: null, ...content, status: 'planned', source: STARTED_WORKOUT_SOURCE, blocks: { create: blocks } },
          select: { id: true },
        });
        const pointer = { payloadHash, sessionIdsJson: JSON.stringify([created.id]) };
        await tx.placementRequest.upsert({ where: identity, create: { userId: athleteId, requestKey, ...pointer }, update: pointer });
        return { ok: true as const, sessionId: created.id, planned: false };
      });
    },
  };
}

export const startedWorkoutService = createStartedWorkoutService();
