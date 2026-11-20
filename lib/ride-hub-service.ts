import { prisma } from './prisma.ts';
import { SKIPPED_SESSION_STATUS } from './athlete-session-status-service.ts';
import { createSessionEditorDraftFromPersisted, deriveSessionEditorMetrics } from './session-editor.ts';
import { addDayKeys, toDayKey } from './training-load.ts';
import { todayInZone } from './user-time.ts';
import { workoutCatalog } from './workout-catalog/index.ts';
import type { CatalogWorkout } from './workout-catalog/types.ts';

type RideHubDeps = { db?: typeof prisma; now?: () => Date; catalog?: readonly CatalogWorkout[] };

export type RideHubSession = {
  id: number;
  title: string;
  day: string;
  timeLabel: string | null;
  durationSec: number;
  tss: number;
  segments: ReturnType<typeof deriveSessionEditorMetrics>['segments'];
  overdue: boolean;
};

export type RideHubRecent = {
  sessionId: number;
  title: string;
  completedAt: string;
  durationSec: number;
  tss: number | null;
  distanceMeters: number | null;
  catalogSlug: string | null;
};

const OVERDUE_LOOKBACK_DAYS = 14;
const RECENT_LIMIT = 6;

function utcMidnight(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * Reads the Ride home: open bike sessions for today and the last two weeks, and the
 * latest completed rides. Sessions are stored at UTC midnight of their local day;
 * today is the rider's day in their zone (the server's local day when omitted).
 */
export function createRideHubService({ db = prisma, now = () => new Date(), catalog = workoutCatalog }: RideHubDeps = {}) {
  return {
    async load(athleteId: number, { timeZone }: { timeZone?: string } = {}) {
      const today = timeZone ? todayInZone(timeZone, now()) : toDayKey(now());
      const tomorrow = addDayKeys(today, 1);
      const [open, recent] = await Promise.all([
        db.session.findMany({
          where: {
            athleteId,
            sport: 'BIKING',
            date: { gte: utcMidnight(addDayKeys(today, -OVERDUE_LOOKBACK_DAYS)), lt: utcMidnight(tomorrow) },
            status: { notIn: ['completed', SKIPPED_SESSION_STATUS] },
            activity: { is: null },
          },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ date: 'desc' }, { id: 'asc' }],
        }),
        db.activity.findMany({
          where: { athleteId, session: { sport: 'BIKING' } },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
          take: RECENT_LIMIT,
          select: { sessionId: true, completedAt: true, durationSec: true, tss: true, distanceMeters: true, importTitle: true, session: { select: { title: true } } },
        }),
      ]);

      const sessions: RideHubSession[] = open.flatMap((session) => {
        if (!session.date) return [];
        const day = session.date.toISOString().slice(0, 10);
        const metrics = deriveSessionEditorMetrics(createSessionEditorDraftFromPersisted('planned', session));
        return [{ id: session.id, title: session.title, day, timeLabel: session.timeLabel, durationSec: metrics.durationSec, tss: metrics.tss, segments: metrics.segments, overdue: day < today }];
      });
      const slugByName = new Map(catalog.map((workout) => [workout.name, workout.slug]));

      return {
        today,
        todaySessions: sessions.filter((session) => !session.overdue),
        overdueSessions: sessions.filter((session) => session.overdue),
        recent: recent.map((activity): RideHubRecent => ({
          sessionId: activity.sessionId,
          title: activity.session.title || activity.importTitle || 'Ride',
          completedAt: activity.completedAt.toISOString(),
          durationSec: activity.durationSec,
          tss: activity.tss,
          distanceMeters: activity.distanceMeters,
          catalogSlug: slugByName.get(activity.session.title) ?? null,
        })),
      };
    },
  };
}

export const rideHubService = createRideHubService();
