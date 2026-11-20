import { intensityColor } from '@/lib/intensity-color';
import type { RidePlan } from '@/lib/ride/ride-plan';
import { stepIntensityZone, type RideChartBucket } from '@/lib/ride/ride-chart';

const HEIGHT = 200;
const WIDTH = 1000;

function clockLabel(totalSec: number): string {
  const minutes = Math.round(totalSec / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` : `${minutes}m`;
}

/**
 * Workout profile: blocks colored by intensity relative to FTP, the recorded power
 * trace, a heart-rate line on its own scale, and a "now" cursor. Text labels sit in
 * HTML so they do not stretch with the SVG.
 */
export function WorkoutProfileChart({ plan, positionSec, buckets, domainSec, heartRateMaxBpm = null, activeStepIndex = null, className = 'h-40 sm:h-48' }: {
  plan: RidePlan;
  positionSec: number | null;
  buckets: RideChartBucket[];
  domainSec: number;
  heartRateMaxBpm?: number | null;
  activeStepIndex?: number | null;
  className?: string;
}) {
  const domain = Math.max(1, domainSec);
  const maxTarget = Math.max(...plan.steps.map((step) => Math.max(step.startWatts ?? 0, step.endWatts ?? 0)), 0);
  const maxPower = Math.max(...buckets.map((bucket) => bucket.power ?? 0), 0);
  const scaleMax = Math.max(maxTarget, maxPower, plan.ftpWatts ?? 0, 100) * 1.12;
  const y = (watts: number) => HEIGHT - (Math.min(watts, scaleMax) / scaleMax) * HEIGHT;
  const x = (sec: number) => (sec / domain) * WIDTH;
  // Free-ride steps draw at a height from their zone so the shape still reads.
  const zoneWatts = (zone: number) => scaleMax * (0.2 + Math.min(5, Math.max(1, zone)) * 0.1);

  const hrValues = buckets.map((bucket) => bucket.heartRate).filter((value): value is number => value !== null);
  const hrTop = Math.max(heartRateMaxBpm ?? 0, ...hrValues, 180);
  const hrBottom = Math.min(80, ...hrValues);
  const hrY = (bpm: number) => HEIGHT - ((bpm - hrBottom) / Math.max(1, hrTop - hrBottom)) * HEIGHT * 0.92;

  const segments = (pick: (bucket: RideChartBucket) => number | null, toY: (value: number) => number, stepped: boolean) => {
    const paths: string[] = [];
    let current = '';
    for (const bucket of buckets) {
      const value = pick(bucket);
      if (value === null) { if (current) paths.push(current); current = ''; continue; }
      const x0 = x(bucket.x);
      const x1 = x(bucket.x + bucket.width);
      const yy = toY(value).toFixed(1);
      current += stepped ? `${current ? 'L' : 'M'}${x0.toFixed(1)},${yy}L${x1.toFixed(1)},${yy}` : `${current ? 'L' : 'M'}${((x0 + x1) / 2).toFixed(1)},${yy}`;
    }
    if (current) paths.push(current);
    return paths;
  };
  const powerPaths = segments((bucket) => bucket.power, y, true);
  const hrPaths = segments((bucket) => bucket.heartRate, hrY, false);
  const ticks = [0.25, 0.5, 0.75].map((fraction) => Math.round((domain * fraction) / 60) * 60);
  const hasTrace = powerPaths.length > 0 || hrPaths.length > 0;

  return (
    <figure className={`relative w-full ${className}`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`Workout profile, ${clockLabel(plan.totalSec)}${hasTrace ? ', with recorded power and heart rate' : ''}`} className="absolute inset-0 h-full w-full overflow-visible">
        {ticks.map((tick) => <line key={tick} x1={x(tick)} x2={x(tick)} y1={0} y2={HEIGHT} stroke="var(--border)" vectorEffect="non-scaling-stroke" />)}
        {plan.steps.map((step, index) => {
          const start = step.startWatts ?? zoneWatts(step.zone);
          const end = step.endWatts ?? zoneWatts(step.zone);
          const x0 = x(step.startSec);
          const x1 = x(step.startSec + step.durationSec);
          const done = positionSec !== null && step.startSec + step.durationSec <= positionSec;
          const active = index === activeStepIndex;
          const color = step.kind === 'pause' ? 'var(--text-muted)' : intensityColor(stepIntensityZone(step, plan.ftpWatts));
          return (
            <polygon
              key={step.id}
              points={`${x0},${HEIGHT} ${x0},${y(start)} ${x1},${y(end)} ${x1},${HEIGHT}`}
              fill={color}
              opacity={active ? 0.85 : step.startWatts === null ? 0.28 : done ? 0.3 : 0.6}
              stroke="var(--background)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {plan.ftpWatts ? <line x1={0} x2={WIDTH} y1={y(plan.ftpWatts)} y2={y(plan.ftpWatts)} stroke="var(--text-muted)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" /> : null}
        {hrPaths.map((d, index) => <path key={`hr${index}`} d={d} fill="none" stroke="var(--ride-hr)" strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
        {powerPaths.map((d, index) => <path key={`p${index}`} d={d} fill="none" stroke="var(--text)" strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
        {positionSec !== null ? (
          <>
            <rect x={0} y={0} width={x(positionSec)} height={HEIGHT} fill="var(--background)" opacity={0.18} />
            <line x1={x(positionSec)} x2={x(positionSec)} y1={0} y2={HEIGHT} stroke="var(--brand)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </svg>
      {plan.ftpWatts ? (
        <span className="data pointer-events-none absolute right-1 -translate-y-full pb-0.5 text-[11px] text-[var(--text-muted)]" style={{ top: `${(y(plan.ftpWatts) / HEIGHT) * 100}%` }}>FTP {plan.ftpWatts} W</span>
      ) : null}
      <div aria-hidden="true" className="data pointer-events-none absolute inset-x-0 -bottom-5 text-[11px] text-[var(--text-muted)]">
        {ticks.map((tick) => <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${(tick / domain) * 100}%` }}>{clockLabel(tick)}</span>)}
        <span className="absolute right-0">{clockLabel(domain)}</span>
      </div>
      {hasTrace ? (
        <figcaption className="pointer-events-none absolute left-1 top-1 flex gap-3 text-[11px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-3 bg-[var(--text)]" />Power</span>
          {hrPaths.length ? <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-3 bg-[var(--ride-hr)]" />Heart rate</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
