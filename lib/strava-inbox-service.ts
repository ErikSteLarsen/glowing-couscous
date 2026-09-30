import { prisma } from './prisma.ts';
import { normalizeStravaSport } from './strava-normalizer.ts';
import { activityImportService } from './activity-import-service.ts';

export type StravaInboxAction = 'notify' | 'discard' | 'restore';

export function createStravaInboxService({ db = prisma, importer = activityImportService } = {}) {
  return {
    async notificationsForUser(userId: number) {
      const connection = await db.stravaConnection.findUnique({ where: { userId }, select: { id: true } });
      if (!connection) return { connected: false, activities: [], plannedSessions: [] };
      const imported = await db.activity.findMany({
        where: { athleteId: userId, externalSource: 'STRAVA', externalActivityId: { not: null } },
        select: { externalActivityId: true },
      });
      const activities = await db.stravaInboxActivity.findMany({
        where: {
          connectionId: connection.id, notifiedAt: null, dismissedAt: null,
          stravaActivityId: { notIn: imported.flatMap((item) => item.externalActivityId ? [item.externalActivityId] : []) },
        },
        orderBy: { id: 'asc' }, take: 50,
        select: { stravaActivityId: true, title: true, sportType: true, startedAt: true, durationSec: true, distanceMeters: true },
      });
      const plannedSessions = activities.length ? (await importer.listForUser(userId)).plannedSessions : [];
      return {
        connected: true,
        activities: activities.map((activity) => ({
          id: activity.stravaActivityId, title: activity.title, sport: normalizeStravaSport(activity.sportType),
          sportType: activity.sportType, startedAt: activity.startedAt.toISOString(),
          durationSec: activity.durationSec, distanceMeters: activity.distanceMeters,
        })),
        plannedSessions,
      };
    },

    async reviewForUser(userId: number, ids: string[], action: StravaInboxAction) {
      // The relation constraint also handles disconnect/reconnect races without relinking a row.
      const result = await db.stravaInboxActivity.updateMany({
        where: { connection: { userId }, stravaActivityId: { in: ids } },
        data: action === 'restore' ? { dismissedAt: null, notifiedAt: null }
          : action === 'discard' ? { dismissedAt: new Date(), notifiedAt: new Date() }
            : { notifiedAt: new Date() },
      });
      return { updated: result.count };
    },
  };
}

export const stravaInboxService = createStravaInboxService();
export type StravaNotifications = Awaited<ReturnType<typeof stravaInboxService.notificationsForUser>>;
