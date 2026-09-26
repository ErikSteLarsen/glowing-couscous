export type ActivityMetric =
  | 'heartRate'
  | 'pace'
  | 'speed'
  | 'power'
  | 'cadence'
  | 'elevation'
  | 'grade'
  | 'temperature';

export type ActivitySeriesPoint = {
  elapsedSec: number;
  distanceMeters?: number | null;
  heartRateBpm?: number | null;
  speedMetersPerSecond?: number | null;
  powerWatts?: number | null;
  cadenceRpm?: number | null;
  elevationMeters?: number | null;
  gradePercent?: number | null;
  temperatureCelsius?: number | null;
};

export type ActivityMetricBucket = {
  index: number;
  from: number;
  to: number;
  average: number;
  min: number;
  max: number;
  sampleCount: number;
  heightPercent: number;
};

export type BucketedActivityMetric = {
  metric: ActivityMetric;
  label: string;
  unit: string;
  axis: 'time' | 'distance';
  interval: number;
  average: number;
  min: number;
  max: number;
  buckets: ActivityMetricBucket[];
};

type MetricDefinition = {
  label: string;
  unit: string;
  axis: 'time' | 'distance';
  baseInterval: number;
  inverse?: boolean;
  read(point: ActivitySeriesPoint): number | null | undefined;
};

const definitions: Record<ActivityMetric, MetricDefinition> = {
  heartRate: {
    label: 'Heart rate', unit: 'bpm', axis: 'time', baseInterval: 60,
    read: (point) => point.heartRateBpm,
  },
  pace: {
    label: 'Pace', unit: 'min/km', axis: 'time', baseInterval: 60, inverse: true,
    read: (point) => {
      const speed = point.speedMetersPerSecond;
      return speed && speed > 0 ? 1000 / speed : null;
    },
  },
  speed: {
    label: 'Speed', unit: 'km/h', axis: 'time', baseInterval: 60,
    read: (point) => point.speedMetersPerSecond === undefined || point.speedMetersPerSecond === null
      ? null
      : point.speedMetersPerSecond * 3.6,
  },
  power: {
    label: 'Power', unit: 'W', axis: 'time', baseInterval: 60,
    read: (point) => point.powerWatts,
  },
  cadence: {
    label: 'Cadence', unit: 'rpm', axis: 'time', baseInterval: 60,
    read: (point) => point.cadenceRpm,
  },
  elevation: {
    label: 'Elevation', unit: 'm', axis: 'distance', baseInterval: 50,
    read: (point) => point.elevationMeters,
  },
  grade: {
    label: 'Grade', unit: '%', axis: 'distance', baseInterval: 50,
    read: (point) => point.gradePercent,
  },
  temperature: {
    label: 'Temperature', unit: '°C', axis: 'time', baseInterval: 300,
    read: (point) => point.temperatureCelsius,
  },
};

const DEFAULT_MAX_BARS = 120;

/**
 * Converts dense sensor streams into a readable bar sequence. Time metrics use
 * minute buckets (five minutes for temperature); terrain metrics use distance
 * buckets. Long activities widen the bucket just enough to cap chart density.
 */
export function bucketActivityMetric(
  points: ActivitySeriesPoint[],
  metric: ActivityMetric,
  options: { durationSec?: number | null; distanceMeters?: number | null; maxBars?: number } = {},
): BucketedActivityMetric {
  const definition = definitions[metric];
  const maxBars = Number.isInteger(options.maxBars) && (options.maxBars ?? 0) > 0
    ? Math.min(options.maxBars!, 500)
    : DEFAULT_MAX_BARS;
  const valid = points
    .map((point) => ({ point, value: definition.read(point) }))
    .filter((entry): entry is { point: ActivitySeriesPoint; value: number } =>
      typeof entry.value === 'number' && Number.isFinite(entry.value) &&
      Number.isFinite(entry.point.elapsedSec) && entry.point.elapsedSec >= 0,
    )
    .sort((left, right) => left.point.elapsedSec - right.point.elapsedSec);

  const axis = metric === 'elevation' || metric === 'grade'
    ? valid.some(({ point }) => Number.isFinite(point.distanceMeters)) ? 'distance' : 'time'
    : definition.axis;
  const metricEntries = axis === 'distance'
    ? valid.filter(({ point }) => Number.isFinite(point.distanceMeters))
    : valid;
  const extent = getExtent(metricEntries, axis, options);
  const interval = chooseInterval(extent, definition.baseInterval, maxBars);
  const grouped = new Map<number, { values: number[]; from: number; to: number }>();

  for (const { point, value } of metricEntries) {
    const position = axis === 'distance' && Number.isFinite(point.distanceMeters)
      ? point.distanceMeters!
      : point.elapsedSec;
    const isEndSample = extent > 0 && position >= extent;
    const bucketPosition = isEndSample
      ? Math.max(0, extent - Math.min(interval * 1e-9, 1e-6))
      : position;
    const index = Math.floor(Math.max(bucketPosition, 0) / interval);
    const group = grouped.get(index) ?? { values: [], from: index * interval, to: (index + 1) * interval };
    group.values.push(value);
    grouped.set(index, group);
  }

  const rawBuckets = [...grouped.entries()].sort(([left], [right]) => left - right).map(([index, group]) => ({
    index,
    from: group.from,
    to: group.to,
    average: mean(group.values),
    min: Math.min(...group.values),
    max: Math.max(...group.values),
    sampleCount: group.values.length,
  }));
  const overallValues = metricEntries.map(({ value }) => value);
  const minimum = overallValues.length ? Math.min(...overallValues) : 0;
  const maximum = overallValues.length ? Math.max(...overallValues) : 0;
  const buckets = rawBuckets.map((bucket) => ({
    ...bucket,
    heightPercent: heightFor(bucket.average, minimum, maximum, definition.inverse === true),
  }));

  return {
    metric,
    label: definition.label,
    unit: definition.unit,
    axis,
    interval,
    average: overallValues.length ? mean(overallValues) : 0,
    min: minimum,
    max: maximum,
    buckets,
  };
}

export function formatActivityMetricValue(metric: ActivityMetric, value: number): string {
  if (metric === 'pace') {
    const seconds = Math.round(value);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} /km`;
  }
  const rounded = metric === 'temperature' || metric === 'grade' ? value.toFixed(1) : Math.round(value).toString();
  const suffix = metric === 'temperature' ? '°C' : definitions[metric].unit;
  return `${rounded} ${suffix}`;
}

function chooseInterval(
  extent: number,
  base: number,
  maxBars: number,
) {
  if (extent <= 0) return base;
  const intervalCount = Math.max(1, Math.ceil(extent / (base * maxBars)));
  return intervalCount * base;
}

function getExtent(
  entries: Array<{ point: ActivitySeriesPoint; value: number }>,
  axis: 'time' | 'distance',
  options: { durationSec?: number | null; distanceMeters?: number | null },
) {
  if (axis === 'time') {
    return Math.max(options.durationSec ?? 0, entries.at(-1)?.point.elapsedSec ?? 0);
  }
  return Math.max(
    options.distanceMeters ?? 0,
    ...entries.map(({ point }) => point.distanceMeters ?? 0),
  );
}

function heightFor(value: number, minimum: number, maximum: number, inverse: boolean) {
  if (maximum <= minimum) return 54;
  const normalized = (value - minimum) / (maximum - minimum);
  const visual = inverse ? 1 - normalized : normalized;
  return Math.round(18 + visual * 82);
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}
