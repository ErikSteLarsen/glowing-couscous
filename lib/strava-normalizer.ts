import type { ActivitySeriesPoint } from './activity-series.ts';

export type StravaRecord = Record<string, unknown>;
export type StravaStream = { data?: unknown };
export type StravaStreams = Record<string, StravaStream>;

export type StravaActivitySummary = {
  id: string;
  title: string;
  sportType: string;
  sport: string;
  startedAt: string;
  durationSec: number;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  metadata: Record<string, unknown>;
};

export type NormalizedStravaActivity = {
  title: string;
  sport: string;
  startedAt: string;
  durationSec: number;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  points: ActivitySeriesPoint[];
  metadata: Record<string, unknown>;
};

const streamFields: Array<[keyof ActivitySeriesPoint, string, number, number]> = [
  ['distanceMeters', 'distance', 0, 2_000_000],
  ['elevationMeters', 'altitude', -1_000, 10_000],
  ['heartRateBpm', 'heartrate', 20, 260],
  ['cadenceRpm', 'cadence', 0, 300],
  ['speedMetersPerSecond', 'velocity_smooth', 0, 50],
  ['powerWatts', 'watts', 0, 5_000],
  ['gradePercent', 'grade_smooth', -100, 100],
  ['temperatureCelsius', 'temp', -100, 100],
];

export function normalizeStravaSport(sportType: string) {
  const normalized = sportType.toLowerCase().replace(/[^a-z]/g, '');
  if (['run', 'trailrun', 'virtualrun', 'treadmill', 'ultrarun'].includes(normalized)) return 'RUNNING';
  if (['ride', 'virtualride', 'mountainbikeride', 'gravelride', 'ebikeride', 'emountainbikeride', 'handcycleride', 'velomobile'].includes(normalized)) return 'BIKING';
  if (['swim', 'virtualswim'].includes(normalized)) return 'SWIMMING';
  if (['weighttraining', 'workout', 'crossfit', 'hiit'].includes(normalized)) return 'STRENGTH';
  if (['yoga', 'pilates', 'mobility'].includes(normalized)) return 'STRETCHING';
  return 'OTHER';
}

export function normalizeStravaMetadata(activity: StravaRecord) {
  const mapping: Array<[string, string]> = [
    ['sportType', 'sport_type'], ['workoutType', 'workout_type'], ['deviceName', 'device_name'],
    ['trainer', 'trainer'], ['commute', 'commute'], ['calories', 'calories'],
    ['movingTimeSec', 'moving_time'], ['elevationHighMeters', 'elev_high'], ['elevationLowMeters', 'elev_low'],
    ['averageHeartrate', 'average_heartrate'], ['maxHeartrate', 'max_heartrate'],
    ['averageSpeed', 'average_speed'], ['maxSpeed', 'max_speed'], ['averageWatts', 'average_watts'],
    ['maxWatts', 'max_watts'], ['weightedAverageWatts', 'weighted_average_watts'], ['kilojoules', 'kilojoules'],
    ['deviceWatts', 'device_watts'], ['averageCadence', 'average_cadence'],
    ['averageTemp', 'average_temp'], ['sufferScore', 'suffer_score'], ['timezone', 'timezone'],
  ];
  const result: Record<string, unknown> = {};
  for (const [target, source] of mapping) {
    const value = activity[source];
    if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) result[target] = value;
  }
  return result;
}

export function toStravaActivitySummary(activity: StravaRecord): StravaActivitySummary {
  const id = activity.id;
  const sportType = asString(activity.sport_type, asString(activity.type, 'Workout'));
  const start = asString(activity.start_date, asString(activity.start_date_local));
  const startMs = Date.parse(start);
  return {
    id: String(id ?? ''),
    title: asString(activity.name, 'Strava activity').slice(0, 140),
    sportType,
    sport: normalizeStravaSport(sportType),
    startedAt: Number.isFinite(startMs) ? new Date(startMs).toISOString() : '',
    durationSec: Math.max(0, Math.round(asNumber(activity.elapsed_time) ?? asNumber(activity.moving_time) ?? 0)),
    distanceMeters: positiveNumber(activity.distance),
    elevationGainMeters: positiveNumber(activity.total_elevation_gain),
    metadata: normalizeStravaMetadata(activity),
  };
}

export function normalizeStravaActivity(activity: StravaRecord, streams: StravaStreams): NormalizedStravaActivity {
  const summary = toStravaActivitySummary(activity);
  const times = arrayStream(streams.time);
  const points: ActivitySeriesPoint[] = times.flatMap((seconds, index) => {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return [];
    const point: ActivitySeriesPoint = { elapsedSec: Math.round(seconds) };
    for (const [field, streamName, min, max] of streamFields) {
      const value = arrayStream(streams[streamName])[index];
      if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) {
        Object.assign(point, { [field]: value });
      }
    }
    return [point];
  });

  if (points.length === 0) points.push(summaryFallbackPoint(summary.metadata));
  const boundedPoints = capPoints(points);
  return {
    title: summary.title || 'Strava activity',
    sport: summary.sport,
    startedAt: summary.startedAt,
    durationSec: Math.max(1, summary.durationSec),
    distanceMeters: summary.distanceMeters,
    elevationGainMeters: summary.elevationGainMeters,
    points: boundedPoints,
    metadata: summary.metadata,
  };
}

function capPoints(points: ActivitySeriesPoint[], maxPoints = 20_000) {
  if (points.length <= maxPoints) return points;
  return Array.from({ length: maxPoints }, (_, index) =>
    points[Math.round(index * (points.length - 1) / (maxPoints - 1))],
  );
}

function summaryFallbackPoint(metadata: Record<string, unknown>): ActivitySeriesPoint {
  const point: ActivitySeriesPoint = { elapsedSec: 0 };
  setIfWithin(point, 'heartRateBpm', metadata.averageHeartrate, 20, 260);
  setIfWithin(point, 'speedMetersPerSecond', metadata.averageSpeed, 0, 50);
  setIfWithin(point, 'powerWatts', metadata.averageWatts, 0, 5_000);
  setIfWithin(point, 'cadenceRpm', metadata.averageCadence, 0, 300);
  return point;
}

function setIfWithin<K extends keyof ActivitySeriesPoint>(
  target: ActivitySeriesPoint,
  key: K,
  candidate: unknown,
  min: number,
  max: number,
) {
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= min && candidate <= max) {
    target[key] = candidate as ActivitySeriesPoint[K];
  }
}

function arrayStream(stream: StravaStream | undefined) {
  return Array.isArray(stream?.data) ? stream.data : [];
}

function positiveNumber(value: unknown) {
  const number = asNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function asString(value: unknown, fallback = '') { return typeof value === 'string' ? value : fallback; }
function asNumber(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
