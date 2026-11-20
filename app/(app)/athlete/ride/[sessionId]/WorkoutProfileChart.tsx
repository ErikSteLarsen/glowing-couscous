import { intensityColor } from '@/lib/intensity-color';
import type { RidePlan } from '@/lib/ride/ride-plan';
import { complianceTone, type RideChartBucket } from '@/lib/ride/ride-chart';

const TONE_COLOR = { on: 'var(--status-success)', over: 'var(--status-warning)', under: 'var(--status-danger)', none: 'var(--text)' } as const;
const HEIGHT = 160;

/** Workout profile (target watts or zone height) with recorded power and a "now" cursor. */
export function WorkoutProfileChart({ plan, positionSec, buckets, domainSec }: {
  plan: RidePlan;
  positionSec: number;
  buckets: RideChartBucket[];
  domainSec: number;
}) {
  const domain = Math.max(1, domainSec);
  const maxTarget = Math.max(...plan.steps.map((step) => Math.max(step.startWatts ?? 0, step.endWatts ?? 0)), 0);
  const maxPower = Math.max(...buckets.map((bucket) => bucket.power ?? 0), 0);
  const scaleMax = Math.max(maxTarget, maxPower, plan.ftpWatts ?? 0, 100) * 1.1;
  const y = (watts: number) => HEIGHT - (Math.min(watts, scaleMax) / scaleMax) * HEIGHT;
  const x = (sec: number) => (sec / domain) * 1000;
  // Free-ride steps draw at a height from their zone so the shape still reads.
  const zoneWatts = (zone: number) => scaleMax * (0.2 + Math.min(5, Math.max(1, zone)) * 0.1);

  return (
    <svg viewBox={`0 0 1000 ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Workout profile with recorded power" className="h-40 w-full sm:h-48">
      {plan.ftpWatts ? <line x1={0} x2={1000} y1={y(plan.ftpWatts)} y2={y(plan.ftpWatts)} stroke="var(--border-strong)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" /> : null}
      {plan.steps.map((step) => {
        const start = step.startWatts ?? zoneWatts(step.zone);
        const end = step.endWatts ?? zoneWatts(step.zone);
        const x0 = x(step.startSec);
        const x1 = x(step.startSec + step.durationSec);
        return (
          <polygon
            key={step.id}
            points={`${x0},${HEIGHT} ${x0},${y(start)} ${x1},${y(end)} ${x1},${HEIGHT}`}
            fill={step.kind === 'pause' ? 'var(--text-muted)' : intensityColor(step.zone)}
            opacity={step.startWatts === null ? 0.25 : 0.45}
          />
        );
      })}
      {buckets.map((bucket) => bucket.power === null ? null : (
        <rect
          key={bucket.x}
          x={x(bucket.x)}
          width={Math.max(1, x(bucket.width) - 0.5)}
          y={y(bucket.power)}
          height={Math.max(1, HEIGHT - y(bucket.power))}
          fill={TONE_COLOR[complianceTone(bucket.power, bucket.target)]}
          opacity={0.85}
        />
      ))}
      <line x1={x(positionSec)} x2={x(positionSec)} y1={0} y2={HEIGHT} stroke="var(--brand)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
