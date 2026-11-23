import { parsePerformanceProfileJson } from './performance-profile.ts';
import { prisma } from './prisma.ts';
import { projectSessionSnapshotJson } from './session-snapshot-service.ts';

export type ComparisonActor = { role: 'ATHLETE' | 'COACH'; userId: number };

type ComparisonSession = {
  id: number;
  athleteId: number | null;
  coachBaselineJson: string | null;
  activity: { actualSnapshotJson: string | null; metricsSource: string } | null;
  athlete: { coachId: number | null; performanceProfileJson?: string | null } | null;
};

type ComparisonDatabase = {
  session: {
    findUnique(args: unknown): Promise<ComparisonSession | null>;
  };
};

export type SessionComparisonResult =
  | {
      ok: true;
      sessionId: number;
      baseline: ReturnType<typeof projectSessionSnapshotJson>['baseline'];
      actual: ReturnType<typeof projectSessionSnapshotJson>['actual'];
      hasDifference: boolean;
      ftpWatts: number | null;
    }
  | { ok: false; status: 404; error: string };

export function createSessionComparisonService({
  db = prisma as unknown as ComparisonDatabase,
}: { db?: ComparisonDatabase } = {}) {
  return {
    async loadComparison(actor: ComparisonActor, sessionId: number): Promise<SessionComparisonResult> {
      const session = await db.session.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          athleteId: true,
          coachBaselineJson: true,
          activity: { select: { actualSnapshotJson: true, metricsSource: true } },
          athlete: { select: { coachId: true, performanceProfileJson: true } },
        },
      });
      const authorized = session && (actor.role === 'ATHLETE'
        ? session.athleteId === actor.userId
        : session.athlete?.coachId === actor.userId);
      if (!authorized) return { ok: false, status: 404, error: 'Workout not found.' };
      if (session.activity && ['manual-paired', 'manual-unplanned', 'tcx-import', 'fit-import', 'gpx-import'].includes(session.activity.metricsSource)) return { ok: false, status: 404, error: 'There’s nothing to compare for an activity that only has totals.' };

      const snapshots = projectSessionSnapshotJson(session.coachBaselineJson, session.activity?.actualSnapshotJson);
      return {
        ok: true,
        sessionId: session.id,
        baseline: snapshots.baseline,
        actual: snapshots.actual,
        hasDifference: snapshots.actual !== null,
        ftpWatts: parsePerformanceProfileJson(session.athlete?.performanceProfileJson).cycling.ftpWatts,
      };
    },
  };
}

export const sessionComparisonService = createSessionComparisonService();
