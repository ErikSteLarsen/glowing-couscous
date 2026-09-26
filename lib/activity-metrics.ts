import type { ActivitySeriesPoint } from './activity-series.ts';

export type ActivitySegment = {
  key: string;
  zone: number;
  durationSec: number;
  label: string;
  color: string;
  tint: string;
};

export type ActivityTelemetry = {
  version: 1;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  points: ActivitySeriesPoint[];
};

export function parseActivityTelemetry(value: unknown): ActivityTelemetry | null {
  if (typeof value !== 'string') return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1 || !Array.isArray(record.points)) return null;

    return {
      version: 1,
      distanceMeters: finiteNumberOrNull(record.distanceMeters),
      elevationGainMeters: finiteNumberOrNull(record.elevationGainMeters),
      points: record.points.flatMap((value) => {
        if (!value || typeof value !== 'object') return [];
        const point = value as Record<string, unknown>;
        if (!Number.isInteger(point.elapsedSec) || (point.elapsedSec as number) < 0) return [];

        const cleanPoint: ActivitySeriesPoint = { elapsedSec: point.elapsedSec as number };
        for (const key of [
          'distanceMeters', 'heartRateBpm', 'speedMetersPerSecond', 'powerWatts',
          'cadenceRpm', 'elevationMeters', 'gradePercent', 'temperatureCelsius',
        ] as const) {
          const candidate = point[key];
          if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            cleanPoint[key] = candidate;
          }
        }
        return [cleanPoint];
      }),
    };
  } catch {
    return null;
  }
}

export function parseActivitySegments(value: string | null | undefined): ActivitySegment[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isActivitySegment);
  } catch {
    return [];
  }
}

function isActivitySegment(value: unknown): value is ActivitySegment {
  if (!value || typeof value !== 'object') return false;
  const segment = value as Record<string, unknown>;
  return (
    typeof segment.key === 'string' &&
    typeof segment.zone === 'number' &&
    typeof segment.durationSec === 'number' &&
    typeof segment.label === 'string' &&
    typeof segment.color === 'string' &&
    typeof segment.tint === 'string'
  );
}

function finiteNumberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
