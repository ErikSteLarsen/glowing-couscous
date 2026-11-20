import { prisma } from './prisma.ts';
import { athletePlannerService } from './athlete-planner-service.ts';
import { workoutLibraryService } from './workout-library-service.ts';
import { parseCalendarDay } from './calendar-navigation.ts';
import { workoutCatalog } from './workout-catalog/index.ts';
import type { CatalogWorkout } from './workout-catalog/types.ts';
import { findCatalogWorkout } from './workout-catalog/query.ts';
import { catalogWorkoutToSessionInput } from './workout-catalog/session.ts';

type PlannerPort = Pick<typeof athletePlannerService, 'saveSession'>;
type LibraryPort = Pick<typeof workoutLibraryService, 'saveForOwner'>;
type SessionLookup = Pick<typeof prisma, 'session'>;

type WorkoutCatalogDeps = {
  catalog?: readonly CatalogWorkout[];
  planner?: PlannerPort;
  library?: LibraryPort;
  db?: SessionLookup;
};

type Failure = { ok: false; error: string; status: 400 | 404 | 409 | 500 };

const notFound: Failure = { ok: false, error: 'Workout not found in the library.', status: 404 };
const MAX_SCHEDULE_DATES = 31;

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

/**
 * Copies built-in catalog workouts into a person's own training. The catalog stays
 * read-only code; every action creates an independent copy through the existing
 * planner or workout-library owner, with that owner's validation.
 */
export function createWorkoutCatalogService({
  catalog = workoutCatalog,
  planner = athletePlannerService,
  library = workoutLibraryService,
  db = prisma,
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
      const date = parseCalendarDay(asRecord(input).date);
      if (!date) return { ok: false, error: 'Send the local date to ride on (yyyy-MM-dd).', status: 400 };

      const sessionInput = catalogWorkoutToSessionInput(workout);
      const existing = await db.session.findFirst({
        where: {
          athleteId,
          date: new Date(`${date}T00:00:00.000Z`),
          sport: sessionInput.sport,
          title: sessionInput.title,
          summary: sessionInput.summary,
          source: 'athlete',
          status: 'planned',
          activity: { is: null },
        },
        orderBy: { id: 'desc' },
        select: { id: true },
      });
      if (existing) return { ok: true, sessionId: existing.id, reused: true };

      const result = await planner.saveSession(athleteId, { ...sessionInput, scheduledDate: date });
      if (!result.ok) return { ok: false, error: result.error, status: result.status as Failure['status'] };
      return { ok: true, sessionId: result.sessionIds[0], reused: false };
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

      const result = await planner.saveSession(athleteId, { ...catalogWorkoutToSessionInput(workout), dates, timeLabel });
      if (!result.ok) return { ok: false, error: result.error, status: result.status as Failure['status'] };
      return { ok: true, sessionIds: result.sessionIds, dates: (dates as string[]).sort() };
    },

    /** Saves an editable copy into the person's own Workouts library. */
    async addToLibrary(athleteId: number, slug: string, input: unknown): Promise<{ ok: true; sessionId: number } | Failure> {
      const workout = find(slug);
      if (!workout) return notFound;
      const requestKey = asRecord(input).requestKey;
      const result = await library.saveForOwner('athlete', athleteId, {
        ...catalogWorkoutToSessionInput(workout),
        ...(requestKey === undefined ? {} : { requestKey }),
      });
      if (!result.ok) return { ok: false, error: result.error, status: result.status as Failure['status'] };
      return { ok: true, sessionId: result.sessionId };
    },
  };
}

export const workoutCatalogService = createWorkoutCatalogService();
