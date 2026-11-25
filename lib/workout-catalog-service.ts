import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { prisma } from './prisma.ts';
import { createAthletePlannerService } from './athlete-planner-service.ts';
import { parseCalendarDay } from './calendar-navigation.ts';
import { workoutCatalog } from './workout-catalog/index.ts';
import type { CatalogWorkout } from './workout-catalog/types.ts';
import { findCatalogWorkout } from './workout-catalog/query.ts';
import { catalogWorkoutToSessionInput } from './workout-catalog/session.ts';

type PlannerPort = Pick<ReturnType<typeof createAthletePlannerService>, 'saveSession'>;
type CatalogTransaction = Pick<Prisma.TransactionClient, 'session' | 'placementRequest' | '$executeRaw'>;
type CatalogDatabase = Pick<typeof prisma, 'placementRequest'> & {
  $transaction<T>(run: (tx: CatalogTransaction) => Promise<T>): Promise<T>;
};

type WorkoutCatalogDeps = {
  catalog?: readonly CatalogWorkout[];
  /** Builds the planner that writes inside a catalog transaction. */
  plannerFor?: (tx: CatalogTransaction) => PlannerPort;
  db?: CatalogDatabase;
};

const REQUEST_KEY_PATTERN = /^[a-zA-Z0-9-]{16,80}$/;

class CatalogError extends Error {
  readonly status: Failure['status'];

  constructor(message: string, status: Failure['status']) {
    super(message);
    this.status = status;
  }
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function replaySchedule(request: { payloadHash: string; sessionIdsJson: string }, payloadHash: string): { ok: true; sessionIds: number[] } | Failure {
  if (request.payloadHash !== payloadHash) {
    return { ok: false, error: 'Something went wrong. Reload the page and try again.', status: 409 };
  }
  let ids: unknown = null;
  try {
    ids = JSON.parse(request.sessionIdsJson);
  } catch {
    // A malformed row cannot safely be replayed.
  }
  if (Array.isArray(ids) && ids.length > 0 && ids.every((id) => Number.isInteger(id) && id > 0)) return { ok: true, sessionIds: ids as number[] };
  return { ok: false, error: 'Could not confirm that this was added. Check your Calendar before you try again.', status: 409 };
}

type Failure = { ok: false; error: string; status: 400 | 404 | 409 | 500 };

const notFound: Failure = { ok: false, error: 'Workout not found in the public library.', status: 404 };
const MAX_SCHEDULE_DATES = 31;

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

/**
 * Copies built-in catalog workouts into a person's own training. The catalog stays
 * read-only code. Ride now and Schedule use the existing planner validation.
 */
export function createWorkoutCatalogService({
  catalog = workoutCatalog,
  plannerFor = (tx) => createAthletePlannerService({ db: tx as typeof prisma }),
  db = prisma as unknown as CatalogDatabase,
}: WorkoutCatalogDeps = {}) {
  function find(slug: string) {
    return findCatalogWorkout(catalog, slug);
  }

  return {
    find,

    /**
     * Plans the workout on the rider's local today and returns the session to ride.
     * Repeating Ride now on the same day reuses the still-unridden copy instead of
     * stacking duplicates.
     */
    async rideNow(athleteId: number, slug: string, input: unknown): Promise<{ ok: true; sessionId: number; reused: boolean } | Failure> {
      const workout = find(slug);
      if (!workout) return notFound;
      if (workout.sport === 'SWIMMING') return { ok: false, error: 'Swim workouts can’t be started yet.', status: 400 };
      const date = parseCalendarDay(asRecord(input).date);
      if (!date) return { ok: false, error: 'Choose a date.', status: 400 };

      const sessionInput = catalogWorkoutToSessionInput(workout);
      try {
        return await db.$transaction(async (tx) => {
          // Serialize Ride now per athlete + workout + local day so concurrent taps
          // cannot both miss the reusable copy. Released when the transaction ends.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`catalog-ride-now:${athleteId}:${slug}:${date}`}, 0))`;
          const open = {
            athleteId,
            date: new Date(`${date}T00:00:00.000Z`),
            sport: sessionInput.sport,
            source: 'athlete',
            status: 'planned',
            activity: { is: null },
          };
          const latest = { orderBy: { id: 'desc' }, select: { id: true } } as const;
          const existing = await tx.session.findFirst({
            ...latest,
            where: { ...open, catalogWorkoutSlug: slug },
          }) ?? await tx.session.findFirst({
            ...latest,
            where: { ...open, catalogWorkoutSlug: null, title: sessionInput.title, summary: sessionInput.summary },
          });
          if (existing) return { ok: true as const, sessionId: existing.id, reused: true };

          const result = await plannerFor(tx).saveSession(athleteId, { ...sessionInput, scheduledDate: date }, undefined, { catalogWorkoutSlug: workout.slug });
          if (!result.ok) throw new CatalogError(result.error, result.status as Failure['status']);
          return { ok: true as const, sessionId: result.sessionIds[0], reused: false };
        });
      } catch (error) {
        if (error instanceof CatalogError) return { ok: false, error: error.message, status: error.status };
        throw error;
      }
    },

    /** Places independent copies on one or more chosen dates. */
    async schedule(athleteId: number, slug: string, input: unknown): Promise<{ ok: true; sessionIds: number[]; dates: string[] } | Failure> {
      const workout = find(slug);
      if (!workout) return notFound;
      const record = asRecord(input);
      const rawDates = Array.isArray(record.dates) ? record.dates : [record.date];
      const dates = [...new Set(rawDates.map(parseCalendarDay))];
      if (dates.length === 0 || dates.some((date) => date === null)) return { ok: false, error: 'Choose a valid date.', status: 400 };
      if (dates.length > MAX_SCHEDULE_DATES) return { ok: false, error: `Schedule at most ${MAX_SCHEDULE_DATES} dates at once.`, status: 400 };
      const timeLabel = typeof record.timeLabel === 'string' && record.timeLabel.trim() ? record.timeLabel.trim().slice(0, 20) : null;

      const requestKey = record.requestKey;
      if (typeof requestKey !== 'string' || !REQUEST_KEY_PATTERN.test(requestKey)) {
        return { ok: false, error: 'Something went wrong. Reload the page and try again.', status: 400 };
      }
      const sortedDates = (dates as string[]).sort();
      const payloadHash = createHash('sha256').update(JSON.stringify({ catalog: slug, dates: sortedDates, timeLabel })).digest('hex');
      const identity = { userId_requestKey: { userId: athleteId, requestKey: `catalog-schedule:${requestKey}` } };

      const respond = (result: { ok: true; sessionIds: number[] } | Failure) =>
        result.ok ? { ok: true as const, sessionIds: result.sessionIds, dates: sortedDates } : result;
      const prior = await db.placementRequest.findUnique({ where: identity });
      if (prior) return respond(replaySchedule(prior, payloadHash));

      try {
        // The request row and every dated copy commit together: a retry either
        // replays this result or, if nothing committed, writes all dates once.
        const sessionIds = await db.$transaction(async (tx) => {
          await tx.placementRequest.create({
            data: { userId: athleteId, requestKey: identity.userId_requestKey.requestKey, payloadHash, sessionIdsJson: '[]' },
          });
          const result = await plannerFor(tx).saveSession(athleteId, { ...catalogWorkoutToSessionInput(workout), dates: sortedDates, timeLabel }, undefined, { catalogWorkoutSlug: workout.slug });
          if (!result.ok) throw new CatalogError(result.error, result.status as Failure['status']);
          await tx.placementRequest.update({ where: identity, data: { sessionIdsJson: JSON.stringify(result.sessionIds) } });
          return result.sessionIds;
        });
        return respond({ ok: true, sessionIds });
      } catch (error) {
        if (error instanceof CatalogError) return { ok: false, error: error.message, status: error.status };
        if (isUniqueViolation(error)) {
          const winner = await db.placementRequest.findUnique({ where: identity });
          if (winner) return respond(replaySchedule(winner, payloadHash));
        }
        throw error;
      }
    },
  };
}

export const workoutCatalogService = createWorkoutCatalogService();
