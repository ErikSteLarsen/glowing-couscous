import { ActivityMetricBars } from '@/components/tempo/ActivityMetricBars';
import type { ActivityMetric, ActivitySeriesPoint } from '@/lib/activity-series';

export function ActivityMetricPreview({
  points,
  durationSec,
  distanceMeters,
  sport,
}: {
  points: ActivitySeriesPoint[];
  durationSec: number;
  distanceMeters: number | null;
  sport: string;
}) {
  const available = (metric: keyof ActivitySeriesPoint) => points.some((point) => typeof point[metric] === 'number' && Number.isFinite(point[metric]));
  const metrics: ActivityMetric[] = [
    ...(available('heartRateBpm') ? ['heartRate' as const] : []),
    ...(available('speedMetersPerSecond') ? [sport === 'RUNNING' ? 'pace' as const : 'speed' as const] : []),
    ...(available('elevationMeters') ? ['elevation' as const] : []),
    ...(available('gradePercent') ? ['grade' as const] : []),
    ...(available('powerWatts') ? ['power' as const] : []),
    ...(available('cadenceRpm') ? ['cadence' as const] : []),
    ...(available('temperatureCelsius') ? ['temperature' as const] : []),
  ];
  if (!metrics.length) {
    return <p className="border-y border-[var(--border)] py-3 text-[13px] text-[var(--text-secondary)]">This activity has no heart rate, pace, elevation, power, cadence or temperature data to chart.</p>;
  }
  return (
    <div className="grid gap-x-5 gap-y-6 xl:grid-cols-2">
      {metrics.map((metric) => (
        <ActivityMetricBars key={metric} points={points} metric={metric} durationSec={durationSec} distanceMeters={distanceMeters} />
      ))}
    </div>
  );
}
