import { deriveSessionEditorMetrics } from './session-editor.ts';
import { deriveSessionMetrics } from './session-math.ts';
import { deserializeSessionSnapshot, createSessionSnapshotJson } from './session-snapshot-service.ts';
import type { TempoBlockKind, TempoZone } from './tempo-blocks.ts';

type Database = typeof import('./prisma.ts').prisma;

export type ImportPairingActivity = {
  completedOn: string;
  sport: string;
};

export function dateRangeForDay(day: string) {
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(`${day}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

function normalizeBlockKind(value: string): TempoBlockKind {
  return value === 'warmup' || value === 'work' || value === 'recovery' || value === 'cooldown' ? value : 'work';
}

function normalizeZone(value: number): TempoZone {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : 2;
}

export async function listImportPairingCandidates(db: typeof import('./prisma.ts').prisma, athleteId: number, activity: ImportPairingActivity) {
  const sessions = await db.session.findMany({
    where: {
      athleteId,
      date: dateRangeForDay(activity.completedOn),
      sport: activity.sport,
      status: { in: ['planned', 'adjusted'] },
      coachOwnerId: null,
      assignedById: null,
      trainingPlanId: null,
      activity: { is: null },
    },
    select: {
      id: true,
      title: true,
      date: true,
      coachBaselineJson: true,
      blocks: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
  return sessions.map((session) => {
    const baseline = deserializeSessionSnapshot('planned', session.coachBaselineJson);
    const plannedDurationSec = baseline
      ? deriveSessionEditorMetrics(baseline).durationSec
      : deriveSessionMetrics(session.blocks.filter((block) => !block.skipped).map((block) => ({
          kind: normalizeBlockKind(block.kind),
          zone: normalizeZone(block.zone),
          durationSec: block.durationSec,
          reps: block.reps,
        }))).durationSec;
    return { id: session.id, title: session.title, date: session.date?.toISOString().slice(0, 10) ?? activity.completedOn, plannedDurationSec };
  });
}

export function snapshotPlannedSession(session: {
  id: number;
  date: Date | null;
  timeLabel: string | null;
  sport: string;
  title: string;
  summary: string | null;
  coachNotes: string | null;
  athleteNotes: string | null;
  sportMetricsJson: string | null;
  rpe: number | null;
  coachBaselineJson: string | null;
  blocks: Array<{
    id: number;
    kind: string;
    zone: number;
    durationSec: number;
    reps: number | null;
    targetType: string | null;
    targetMode: string | null;
    targetReference: string | null;
    targetLow: number | null;
    targetHigh: number | null;
    targetLowDecimal: string | null;
    targetHighDecimal: string | null;
    note: string | null;
    skipped: boolean;
    sortOrder: number;
  }>;
}) {
  return session.coachBaselineJson ?? createSessionSnapshotJson({
    ...session,
    scheduledDate: session.date,
    blocks: session.blocks,
  });
}

export async function attachImportedActivity({
  db,
  athleteId,
  sessionId,
  activity,
  metricsSource,
  fingerprint,
}: {
  db: Database;
  athleteId: number;
  sessionId: number;
  activity: {
    completedOn: string;
    sport: string;
    startedAt: Date;
    completedAt: Date;
    sourceTimezoneOffsetMinutes: number;
    durationSec: number;
    distanceMeters: number | null;
  };
  metricsSource: 'tcx-import' | 'fit-import' | 'gpx-import';
  fingerprint: string;
}): Promise<'attached' | 'stale'> {
  return db.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      include: { blocks: { orderBy: { sortOrder: 'asc' } }, activity: true },
    });
    if (!session || session.athleteId !== athleteId || session.sport !== activity.sport) return 'stale';
    const dayRange = dateRangeForDay(activity.completedOn);
    if (!session.date || session.date < dayRange.gte || session.date >= dayRange.lt || (session.status !== 'planned' && session.status !== 'adjusted') || session.activity || session.coachOwnerId !== null || session.assignedById !== null || session.trainingPlanId !== null) return 'stale';

    const coachBaselineJson = snapshotPlannedSession(session);
    const claimed = await tx.session.updateMany({
      where: {
        id: sessionId,
        athleteId,
        sport: session.sport,
        date: dateRangeForDay(session.date.toISOString().slice(0, 10)),
        status: { in: ['planned', 'adjusted'] },
        coachOwnerId: null,
        assignedById: null,
        trainingPlanId: null,
      },
      data: {
        status: 'completed',
        ...(session.coachBaselineJson === null ? { coachBaselineJson } : {}),
      },
    });
    if (claimed.count !== 1) return 'stale';

    await tx.activity.create({
      data: {
        athleteId,
        sessionId,
        startedAt: activity.startedAt,
        completedAt: activity.completedAt,
        sourceTimezoneOffsetMinutes: activity.sourceTimezoneOffsetMinutes,
        durationSec: activity.durationSec,
        distanceMeters: activity.distanceMeters,
        tss: null,
        compliancePct: null,
        zoneDistributionJson: '{}',
        segmentsJson: '[]',
        metricsSource,
        importFingerprint: fingerprint,
      },
    });
    return 'attached';
  });
}
