import { createHash } from 'node:crypto';
import { format } from 'date-fns';
import { prisma } from './prisma.ts';
import { getTempoZoneMeta } from './tempo-blocks.ts';
import { calculateOlympiatoppenHeartRateZones } from './profile-training-zones.ts';
import { parseActivityTelemetry } from './activity-metrics.ts';
import { parsePerformanceProfileJson } from './performance-profile.ts';
import type { ActivitySeriesPoint } from './activity-series.ts';
import { validateActivityLaps, type ActivityLap } from './activity-laps.ts';
import { newActivityAnalysisJob } from './activity-analysis-job.ts';
import type { ActivityTelemetry } from './activity-metrics.ts';
import {
  ACTIVITY_IMPORT_FINISH_TOLERANCE_SEC,
  MAX_ACTIVITY_IMPORT_DISTANCE_METERS,
  MAX_ACTIVITY_IMPORT_DURATION_SEC,
  MAX_ACTIVITY_IMPORT_POINTS,
  MAX_ACTIVITY_IMPORT_SPAN_SEC,
} from './activity-import-limits.ts';
import { measuredPowerTssFromPoints } from './measured-power-load.ts';

const MAX_TITLE_LENGTH = 140;

export type ActivityImportInput = {
  title: string;
  sport: string;
  startedAt: string;
  /** Wall-clock finish when the recorder knows it; otherwise completion is start + duration. */
  finishedAt?: string;
  durationSec: number;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  points: ActivitySeriesPoint[];
  plannedSessionId?: number | null;
  laps?: ActivityLap[];
  analyzeWorkout?: boolean;
};

export type ImportedActivityHistory = {
  id: number;
  sessionId: number;
  title: string;
  sessionTitle: string;
  standalone: boolean;
  sport: string;
  completedAt: string;
  durationSec: number;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  source: 'file' | 'strava';
  sourceMetadata: Record<string, unknown> | null;
  telemetry: ActivityTelemetry | null;
};

export type ImportableSession = { id: number; title: string; sport: string; date: string | null };

type ImportDatabase = {
  user: { findUnique(args: unknown): Promise<{ performanceProfileJson: string | null } | null> };
  session: {
    findMany(args: unknown): Promise<Array<{ id: number; title: string; sport: string; date: Date | null }>>;
    findFirst(args: unknown): Promise<{ id: number; status: string; sport: string } | null>;
    create(args: unknown): Promise<{ id: number; activity: { id: number } }>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
    delete(args: unknown): Promise<unknown>;
  };
  activity: {
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
    create(args: unknown): Promise<{ id: number }>;
    delete(args: unknown): Promise<unknown>;
  };
  stravaInboxActivity?: {
    findUnique(args: unknown): Promise<{ fetchedAt: Date } | null>;
  };
  $queryRaw?: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $transaction<T>(operation: (transaction: Omit<ImportDatabase, 'user' | '$transaction'>) => Promise<T>): Promise<T>;
};

export type ActivityImportTransaction = Omit<ImportDatabase, 'user' | '$transaction'>;

export type ActivityImportResult =
  | { ok: true; activityId: number; sessionId: number; duplicate: boolean }
  | { ok: false; status: 400 | 404 | 409; error: string };

export function validateActivityImport(input: unknown): { ok: true; value: ActivityImportInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Activity data is missing.' };
  const value = input as Record<string, unknown>;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const sport = typeof value.sport === 'string' ? value.sport : '';
  const startedAt = typeof value.startedAt === 'string' ? value.startedAt : '';
  const startedAtDate = new Date(startedAt);
  const durationSec = value.durationSec;
  const points = value.points;
  if (!title || title.length > MAX_TITLE_LENGTH) return { ok: false, error: 'Enter a title up to 140 characters.' };
  if (!['RUNNING', 'BIKING', 'SWIMMING', 'STRENGTH', 'STRETCHING', 'OTHER'].includes(sport)) {
    return { ok: false, error: 'Choose a sport for this activity.' };
  }
  if (!Number.isFinite(startedAtDate.getTime())) return { ok: false, error: 'This activity’s start time can’t be read.' };
  if (!Number.isInteger(durationSec) || (durationSec as number) < 1 || (durationSec as number) > MAX_ACTIVITY_IMPORT_DURATION_SEC) {
    return { ok: false, error: 'Activities must last between 1 second and 36 hours.' };
  }
  let finishedAt: string | undefined;
  if (value.finishedAt !== undefined && value.finishedAt !== null) {
    const finishedAtDate = typeof value.finishedAt === 'string' ? new Date(value.finishedAt) : new Date(Number.NaN);
    const spanSec = (finishedAtDate.getTime() - startedAtDate.getTime()) / 1000;
    if (!Number.isFinite(spanSec) || spanSec < (durationSec as number) - ACTIVITY_IMPORT_FINISH_TOLERANCE_SEC || spanSec > MAX_ACTIVITY_IMPORT_SPAN_SEC) {
      return { ok: false, error: 'This activity’s start and finish times don’t match its duration.' };
    }
    finishedAt = finishedAtDate.toISOString();
  }
  if (!Array.isArray(points) || points.length < 1 || points.length > MAX_ACTIVITY_IMPORT_POINTS) {
    return { ok: false, error: `This activity must have between 1 and ${MAX_ACTIVITY_IMPORT_POINTS.toLocaleString()} recorded data points.` };
  }
  const cleanPoints: ActivitySeriesPoint[] = [];
  let previousElapsed = -1;
  for (const point of points) {
    if (!point || typeof point !== 'object') return { ok: false, error: 'This activity has recorded data Wattonaut can’t read.' };
    const sample = point as Record<string, unknown>;
    const elapsedSec = sample.elapsedSec;
    if (!Number.isInteger(elapsedSec) || (elapsedSec as number) < 0 || (elapsedSec as number) > MAX_ACTIVITY_IMPORT_DURATION_SEC || (elapsedSec as number) < previousElapsed) {
      return { ok: false, error: 'This activity’s recorded data is out of order.' };
    }
    previousElapsed = elapsedSec as number;
    const cleaned: ActivitySeriesPoint = { elapsedSec: elapsedSec as number };
    const allowedValues: Array<[keyof ActivitySeriesPoint, number, number]> = [
      ['distanceMeters', 0, MAX_ACTIVITY_IMPORT_DISTANCE_METERS],
      ['heartRateBpm', 20, 260],
      ['speedMetersPerSecond', 0, 50],
      ['powerWatts', 0, 5000],
      ['cadenceRpm', 0, 300],
      ['elevationMeters', -1000, 10000],
      ['gradePercent', -100, 100],
      ['temperatureCelsius', -100, 100],
    ];
    for (const [key, min, max] of allowedValues) {
      const candidate = sample[key];
      if (candidate === null || candidate === undefined) continue;
      if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < min || candidate > max) {
        return { ok: false, error: 'This activity has a sensor reading that is out of range.' };
      }
      Object.assign(cleaned, { [key]: candidate });
    }
    cleanPoints.push(cleaned);
  }
  const distanceMeters = optionalBoundedNumber(value.distanceMeters, 0, MAX_ACTIVITY_IMPORT_DISTANCE_METERS);
  const elevationGainMeters = optionalBoundedNumber(value.elevationGainMeters, 0, 100000);
  if (distanceMeters === 'invalid' || elevationGainMeters === 'invalid') {
    return { ok: false, error: 'This activity’s distance or elevation is out of range.' };
  }
  const plannedSessionId = value.plannedSessionId === null || value.plannedSessionId === undefined
    ? null
    : Number.isInteger(value.plannedSessionId) && (value.plannedSessionId as number) > 0
      ? value.plannedSessionId as number
      : 'invalid';
  if (plannedSessionId === 'invalid') return { ok: false, error: 'Choose a planned workout from the list.' };
  const laps = validateActivityLaps(value.laps, durationSec as number);
  if (!laps) return { ok: false, error: 'This activity’s laps can’t be read.' };
  if (value.analyzeWorkout !== undefined && typeof value.analyzeWorkout !== 'boolean') return { ok: false, error: 'Choose whether to analyze this workout.' };
  return {
    ok: true,
    value: {
      title,
      sport,
      startedAt: startedAtDate.toISOString(),
      ...(finishedAt ? { finishedAt } : {}),
      durationSec: durationSec as number,
      laps,
      analyzeWorkout: value.analyzeWorkout === true,
      distanceMeters,
      elevationGainMeters,
      points: cleanPoints,
      plannedSessionId,
    },
  };
}

export function createActivityImportService({ db = prisma as unknown as ImportDatabase }: { db?: ImportDatabase } = {}) {
  return {
    async listForUser(userId: number): Promise<{ activities: ImportedActivityHistory[]; plannedSessions: ImportableSession[] }> {
      const [activities, plannedSessions] = await Promise.all([
        db.activity.findMany({
          where: { athleteId: userId, metricsSource: { in: ['file-import', 'strava-import'] } },
          orderBy: { completedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            sessionId: true,
            importedSessionStatus: true,
            importTitle: true,
            completedAt: true,
            durationSec: true,
            distanceMeters: true,
            elevationGainMeters: true,
            metricsSource: true,
            sourceMetadataJson: true,
            session: { select: { id: true, title: true, sport: true, date: true, source: true } },
          },
        }),
        db.session.findMany({
          where: { athleteId: userId, date: { not: null }, status: { not: 'completed' }, activity: { is: null } },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: 50,
          select: { id: true, title: true, sport: true, date: true },
        }),
      ]);
      return {
        activities: activities.map((activity) => {
          const session = recordValue(activity.session);
          return {
            id: numberValue(activity.id),
            sessionId: numberValue(activity.sessionId),
            title: stringValue(activity.importTitle) || stringValue(session.title),
            sessionTitle: stringValue(session.title),
            standalone: stringValue(session.source) === 'activity-import' && activity.importedSessionStatus == null,
            sport: stringValue(session.sport),
            completedAt: dateValue(activity.completedAt)?.toISOString() ?? '',
            durationSec: numberValue(activity.durationSec),
            distanceMeters: numberOrNull(activity.distanceMeters),
            elevationGainMeters: numberOrNull(activity.elevationGainMeters),
            source: stringValue(activity.metricsSource) === 'strava-import' ? 'strava' : 'file',
            sourceMetadata: stringValue(activity.metricsSource) === 'strava-import'
              ? parseSourceMetadata(activity.sourceMetadataJson)
              : null,
            telemetry: null,
          };
        }),
        plannedSessions: plannedSessions.map((session) => ({
          id: session.id,
          title: session.title,
          sport: session.sport,
          date: session.date?.toISOString() ?? null,
        })),
      };
    },

    async loadTelemetry(userId: number, activityId: number) {
      if (!Number.isInteger(activityId) || activityId <= 0) return null;
      const activity = await db.activity.findFirst({
        where: { id: activityId, athleteId: userId, metricsSource: { in: ['file-import', 'strava-import'] } },
        select: { telemetryJson: true },
      });
      return activity ? parseTelemetry(activity.telemetryJson) : null;
    },

    async deleteImportedActivityForUser(userId: number, activityId: number) {
      if (!Number.isInteger(activityId) || activityId <= 0) {
        return { ok: false as const, status: 404 as const, error: 'Activity not found.' };
      }
      return db.$transaction((transaction) => deleteImportedActivityInTransaction(transaction, userId, activityId));
    },

    async deleteStravaActivityForUser(userId: number, stravaActivityId: string) {
      if (!/^\d{1,20}$/.test(stravaActivityId)) return { ok: false as const, status: 404 as const, error: 'Activity not found.' };
      return db.$transaction((transaction) => deleteStravaActivityInTransaction(transaction, userId, stravaActivityId));
    },

    async deleteStravaActivityInTransaction(transaction: ActivityImportTransaction, userId: number, stravaActivityId: string) {
      if (!/^\d{1,20}$/.test(stravaActivityId)) return { ok: false as const, status: 404 as const, error: 'Activity not found.' };
      return deleteStravaActivityInTransaction(transaction, userId, stravaActivityId);
    },

    async deleteAllStravaActivitiesForUser(userId: number) {
      return db.$transaction((transaction) => deleteAllStravaActivitiesInTransaction(transaction, userId));
    },

    async deleteAllStravaActivitiesInTransaction(transaction: ActivityImportTransaction, userId: number) {
      return deleteAllStravaActivitiesInTransaction(transaction, userId);
    },

    async importForUser(
      userId: number,
      input: unknown,
      provenance: { sourceProvider?: 'STRAVA'; connectionId?: string; expectedInboxFetchedAt?: Date; externalActivityId?: string; metadata?: Record<string, unknown> } = {},
    ): Promise<ActivityImportResult> {
      const validated = validateActivityImport(input);
      if (!validated.ok) return { ok: false, status: 400, error: validated.error };
      const value = validated.value;
      const fingerprint = createImportFingerprint(value);
      const user = await db.user.findUnique({ where: { id: userId }, select: { performanceProfileJson: true } });
      if (!user) return { ok: false, status: 404, error: 'Account not found.' };
      const profile = parsePerformanceProfileJson(user.performanceProfileJson);
      const summary = summarizeTelemetry(value.points, value.durationSec, profile.heartRateMaxBpm);
      const powerLoad = value.sport === 'BIKING' ? measuredPowerTssFromPoints(value.points, value.durationSec, profile.cycling.ftpWatts) : null;
      const startedAt = new Date(value.startedAt);
      const activityData = {
        athleteId: userId,
        startedAt,
        completedAt: value.finishedAt ? new Date(value.finishedAt) : new Date(startedAt.getTime() + value.durationSec * 1000),
        durationSec: value.durationSec,
        tss: powerLoad ? Math.round(powerLoad.tss) : summary.tss,
        compliancePct: null,
        zoneDistributionJson: JSON.stringify(summary.zoneDistributionSec),
        segmentsJson: JSON.stringify(summary.segments),
        metricsSource: provenance.sourceProvider === 'STRAVA' ? 'strava-import' : 'file-import',
        notes: null,
        actualSnapshotJson: null,
        importTitle: value.title,
        distanceMeters: value.distanceMeters,
        elevationGainMeters: value.elevationGainMeters,
        telemetryJson: JSON.stringify({
          version: value.laps?.length ? 2 : 1,
          ...(value.laps?.length ? { laps: value.laps } : {}),
          distanceMeters: value.distanceMeters,
          elevationGainMeters: value.elevationGainMeters,
        points: value.points,
        }),
        importFingerprint: fingerprint,
        externalSource: provenance.sourceProvider ?? null,
        externalActivityId: provenance.sourceProvider === 'STRAVA' ? provenance.externalActivityId ?? null : null,
        sourceMetadataJson: provenance.sourceProvider === 'STRAVA' ? JSON.stringify(sanitizeSourceMetadata(provenance.metadata)) : null,
      };
      if (value.analyzeWorkout && provenance.sourceProvider !== 'STRAVA' && value.sport === 'RUNNING') {
        Object.assign(activityData, { analysis: { create: newActivityAnalysisJob(activityData.telemetryJson, value.durationSec, user.performanceProfileJson ?? '{}') } });
      }

      const findDuplicate = async (): Promise<ActivityImportResult | null> => {
        const existing = await db.activity.findFirst({ where: { athleteId: userId, importFingerprint: fingerprint }, select: { id: true, sessionId: true } });
        if (!existing) return null;
        return { ok: true, activityId: existing.id as number, sessionId: existing.sessionId as number, duplicate: true };
      };
      const existing = await findDuplicate();
      if (existing) return existing;

      try {
        const result = await db.$transaction(async (transaction) => {
          if (provenance.sourceProvider === 'STRAVA') {
            const connectionId = provenance.connectionId;
            if (!connectionId || !transaction.$queryRaw) {
              return { ok: false as const, status: 409 as const, error: 'Strava is no longer connected. Connect it again in Settings, then try again.' };
            }
            const lockedConnection = await transaction.$queryRaw<Array<{ id: string }>>`
              SELECT "id" FROM "StravaConnection"
              WHERE "id" = ${connectionId} AND "userId" = ${userId}
              FOR SHARE
            `;
            if (lockedConnection.length === 0) {
              return { ok: false as const, status: 409 as const, error: 'Strava is no longer connected. Connect it again in Settings, then try again.' };
            }
            if (!transaction.stravaInboxActivity?.findUnique || !provenance.externalActivityId || !provenance.expectedInboxFetchedAt) {
              return { ok: false as const, status: 409 as const, error: 'This Strava activity has changed. Open it again to see the latest version.' };
            }
            const currentInboxActivity = await transaction.stravaInboxActivity.findUnique({
              where: { connectionId_stravaActivityId: { connectionId, stravaActivityId: provenance.externalActivityId } },
              select: { fetchedAt: true },
            });
            if (!currentInboxActivity || currentInboxActivity.fetchedAt.getTime() !== provenance.expectedInboxFetchedAt.getTime()) {
              return { ok: false as const, status: 409 as const, error: 'This Strava activity has changed. Open it again to see the latest version.' };
            }
          }
          let sessionId: number;
          if (value.plannedSessionId) {
            const planned = await transaction.session.findFirst({
              where: { id: value.plannedSessionId, athleteId: userId, sport: value.sport, date: { not: null }, status: { not: 'completed' }, activity: { is: null } },
              select: { id: true, status: true },
            });
            if (!planned) return { ok: false as const, status: 409 as const, error: 'That planned workout is no longer available for this sport.' };
            sessionId = planned.id;
            // Claim the row checked above: a completion committed in between changes
            // its status, so the claim matches nothing instead of attaching.
            const claim = await transaction.session.updateMany({
              where: { id: sessionId, status: planned.status, activity: { is: null } },
              data: { status: 'completed' },
            });
            if (claim.count !== 1) return { ok: false as const, status: 409 as const, error: 'That planned workout is no longer available for this sport.' };
            const activity = await transaction.activity.create({
              data: { ...activityData, sessionId, importedSessionStatus: planned.status },
            });
            return { ok: true as const, activityId: activity.id, sessionId };
          }

          const started = new Date(value.startedAt);
          const session = await transaction.session.create({
            data: {
              athleteId: userId,
              date: started,
              timeLabel: format(started, 'HH:mm'),
              sport: value.sport,
              title: value.title,
              summary: createActivitySummary(value, provenance.sourceProvider),
              status: 'completed',
              source: 'activity-import',
              activity: { create: activityData },
            },
            select: { id: true, activity: { select: { id: true } } },
          });
          return { ok: true as const, activityId: session.activity.id, sessionId: session.id };
        });
        if (result.ok) return { ...result, duplicate: false };
        if (!provenance.sourceProvider && result.status === 409) return await findDuplicate() ?? result;
        return result;
      } catch (error) {
        if (isUniqueConflict(error)) {
          const duplicate = !provenance.sourceProvider ? await findDuplicate() : null;
          return duplicate ?? { ok: false, status: 409, error: 'This activity has already been imported.' };
        }
        throw error;
      }
    },
  };
}

function summarizeTelemetry(points: ActivitySeriesPoint[], durationSec: number, heartRateMax: number | null) {
  const ranges = calculateOlympiatoppenHeartRateZones(heartRateMax);
  const zoneDistributionSec = [0, 0, 0, 0, 0];
  if (!ranges) return { zoneDistributionSec, tss: null, segments: [] };
  const segments: Array<{ key: string; zone: number; durationSec: number; label: string; color: string; tint: string }> = [];
  let tss = 0;
  let hasHeartRate = false;
  const weights = [0.55, 0.7, 0.85, 0.98, 1.1];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const hr = point.heartRateBpm;
    if (hr === null || hr === undefined) continue;
    const next = points[index + 1]?.elapsedSec ?? durationSec;
    const seconds = Math.max(0, Math.min(15, next - point.elapsedSec));
    if (!seconds) continue;
    hasHeartRate = true;
    const zone = ([1, 2, 3, 4, 5] as const).find((candidate) =>
      hr >= ranges[candidate].low && hr <= ranges[candidate].high,
    ) ?? (hr < ranges[1].low ? 1 : 5);
    zoneDistributionSec[zone - 1] += seconds;
    tss += (seconds / 3600) * weights[zone - 1] ** 2 * 100;
    const previous = segments.at(-1);
    if (previous?.zone === zone) previous.durationSec += seconds;
    else {
      const meta = getTempoZoneMeta(zone);
      segments.push({ key: `zone-${zone}-${segments.length}`, zone, durationSec: seconds, label: `${meta.label} ${meta.name}`, color: meta.solid, tint: meta.tint });
    }
  }
  return { zoneDistributionSec, tss: hasHeartRate ? Math.round(tss) : null, segments };
}

function createActivitySummary(value: ActivityImportInput, sourceProvider?: string) {
  const parts = [sourceProvider === 'STRAVA' ? 'Imported Strava activity' : 'Imported activity file'];
  if (value.distanceMeters !== null) parts.push(`${(value.distanceMeters / 1000).toFixed(2)}\u00A0km`);
  if (value.elevationGainMeters !== null) parts.push(`${Math.round(value.elevationGainMeters)}\u00A0m elevation gain`);
  return parts.join(', ');
}

function sanitizeSourceMetadata(value?: Record<string, unknown>) {
  if (!value) return {};
  const allowed = [
    'sportType', 'workoutType', 'deviceName', 'trainer', 'commute', 'calories',
    'movingTimeSec', 'elevationHighMeters', 'elevationLowMeters', 'timezone', 'kilojoules', 'deviceWatts',
    'averageHeartrate', 'maxHeartrate', 'averageSpeed', 'maxSpeed', 'averageWatts',
    'maxWatts', 'weightedAverageWatts', 'averageCadence', 'averageTemp', 'sufferScore',
  ];
  return Object.fromEntries(allowed.flatMap((key) => {
    const candidate = value[key];
    return typeof candidate === 'string' || typeof candidate === 'boolean' ||
      (typeof candidate === 'number' && Number.isFinite(candidate))
      ? [[key, candidate]]
      : [];
  }));
}

function parseSourceMetadata(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const sanitized = sanitizeSourceMetadata(parsed as Record<string, unknown>);
    return Object.keys(sanitized).length > 0 ? sanitized : null;
  } catch {
    return null;
  }
}

function createImportFingerprint(value: ActivityImportInput) {
  return createHash('sha256').update(JSON.stringify({
    sport: value.sport,
    startedAt: value.startedAt,
    durationSec: value.durationSec,
    distanceMeters: value.distanceMeters,
    points: value.points,
  })).digest('hex');
}

function parseTelemetry(value: unknown): ImportedActivityHistory['telemetry'] {
  return parseActivityTelemetry(value);
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function dateValue(value: unknown) {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : null;
}

function optionalBoundedNumber(value: unknown, min: number, max: number): number | null | 'invalid' {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : 'invalid';
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}

export const activityImportService = createActivityImportService();

async function deleteImportedActivityInTransaction(transaction: ActivityImportTransaction, userId: number, activityId: number) {
  const activity = await transaction.activity.findFirst({
    where: { id: activityId, athleteId: userId, metricsSource: { in: ['file-import', 'strava-import'] } },
    select: {
      id: true,
      sessionId: true,
      importedSessionStatus: true,
      session: { select: { id: true, athleteId: true, source: true } },
    },
  });
  if (!activity) return { ok: false as const, status: 404 as const, error: 'Activity not found.' };

  const session = recordValue(activity.session);
  if (numberValue(session.athleteId) !== userId) {
    return { ok: false as const, status: 404 as const, error: 'Activity not found.' };
  }
  const sessionId = numberValue(activity.sessionId);
  if (stringValue(session.source) === 'activity-import' && activity.importedSessionStatus == null) {
    await transaction.session.delete({ where: { id: sessionId } });
    return { ok: true as const, deletedSession: true };
  }

  await transaction.activity.delete({ where: { id: activityId } });
  await transaction.session.update({
    where: { id: sessionId },
    data: { status: stringValue(activity.importedSessionStatus) || 'planned' },
  });
  return { ok: true as const, deletedSession: false };
}

async function deleteStravaActivityInTransaction(transaction: ActivityImportTransaction, userId: number, stravaActivityId: string) {
  const activity = await transaction.activity.findFirst({
    where: { athleteId: userId, externalSource: 'STRAVA', externalActivityId: stravaActivityId },
    select: { id: true },
  });
  return activity
    ? deleteImportedActivityInTransaction(transaction, userId, numberValue(activity.id))
    : { ok: false as const, status: 404 as const, error: 'Activity not found.' };
}

async function deleteAllStravaActivitiesInTransaction(transaction: ActivityImportTransaction, userId: number) {
  const activities = await transaction.activity.findMany({
    where: { athleteId: userId, externalSource: 'STRAVA', metricsSource: 'strava-import' },
    select: { id: true },
  });
  for (const activity of activities) {
    await deleteImportedActivityInTransaction(transaction, userId, numberValue(activity.id));
  }
  return activities.length;
}
