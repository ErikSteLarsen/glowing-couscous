import { intensityColor } from '@/lib/intensity-color';
import { ZONE_BANDS } from '@/lib/workout-zone-intensity';
import { wattsForPct, zoneForPct, type CatalogFlatStep } from '@/lib/workout-catalog/metrics';

const WIDTH = 1000;
const HEIGHT = 200;

export function pctColor(pct: number): string {
  const zone = zoneForPct(pct);
  const band = ZONE_BANDS.power[zone];
  return intensityColor(zone, (pct - band.low) / (band.high - band.low));
}

function clockLabel(totalSec: number): string {
  const minutes = Math.round(totalSec / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` : `${minutes}m`;
}

type ProfileStep = Pick<CatalogFlatStep, 'startSec' | 'durationSec' | 'startPct' | 'endPct' | 'kind' | 'ramp'>;

/**
 * Workout shape in %FTP: width is time, height is intensity, color follows the shared
 * zone ramp. Warm-up and cool-down ramps draw as slopes with a matching color sweep.
 * `mini` uses one fixed scale so cards compare at a glance; `full` adds FTP and time axes.
 */
export function CatalogProfile({
  steps,
  idPrefix,
  variant = 'mini',
  ftpWatts = null,
  className,
  label,
}: {
  steps: ProfileStep[];
  idPrefix: string;
  variant?: 'mini' | 'full';
  ftpWatts?: number | null;
  className?: string;
  label: string;
}) {
  const totalSec = Math.max(1, steps.reduce((sum, step) => sum + step.durationSec, 0));
  const maxPct = Math.max(0, ...steps.map((step) => Math.max(step.startPct, step.endPct)));
  const top = variant === 'mini' ? Math.max(125, maxPct * 1.04) : Math.max(130, Math.ceil((maxPct * 1.08) / 10) * 10);
  const x = (sec: number) => (sec / totalSec) * WIDTH;
  const y = (pct: number) => HEIGHT - (Math.min(pct, top) / top) * HEIGHT;
  const gridPcts = variant === 'full' ? [50, 75, 100, 125, 150, 200, 250, 300].filter((pct) => pct < top) : [];
  const ticks = variant === 'full' ? timeTicks(totalSec) : [];

  const svg = (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={variant === 'full' ? 'absolute inset-0 h-full w-full overflow-visible' : `block w-full ${className ?? 'h-12'}`}
    >
      <defs>
        {steps.map((step, index) => step.ramp ? (
          <linearGradient key={index} id={`${idPrefix}-ramp-${index}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={pctColor(step.startPct)} />
            <stop offset="100%" stopColor={pctColor(step.endPct)} />
          </linearGradient>
        ) : null)}
      </defs>
      {gridPcts.map((pct) => (
        <line key={pct} x1={0} x2={WIDTH} y1={y(pct)} y2={y(pct)} stroke="var(--border)" strokeDasharray={pct === 100 ? '4 5' : undefined} vectorEffect="non-scaling-stroke" />
      ))}
      {ticks.map((tick) => <line key={`t${tick}`} x1={x(tick)} x2={x(tick)} y1={0} y2={HEIGHT} stroke="var(--border)" vectorEffect="non-scaling-stroke" opacity={0.6} />)}
      {steps.map((step, index) => {
        const x0 = x(step.startSec);
        const x1 = x(step.startSec + step.durationSec);
        return (
          <path
            key={index}
            d={`M${x0},${HEIGHT}L${x0},${y(step.startPct)}L${x1},${y(step.endPct)}L${x1},${HEIGHT}Z`}
            fill={step.ramp ? `url(#${idPrefix}-ramp-${index})` : pctColor((step.startPct + step.endPct) / 2)}
            fillOpacity={step.kind === 'recovery' || step.kind === 'cooldown' || step.kind === 'warmup' ? 0.72 : 0.92}
            stroke="var(--profile-gap, var(--surface))"
            strokeWidth={variant === 'full' ? 1.5 : 1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {variant === 'full' ? <line x1={0} x2={WIDTH} y1={y(100)} y2={y(100)} stroke="var(--text-secondary)" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  );

  if (variant === 'mini') return svg;

  return (
    <figure className={`relative ml-11 mb-6 ${className ?? 'h-56 sm:h-64'}`}>
      {svg}
      <div aria-hidden="true" className="data pointer-events-none absolute inset-y-0 -left-11 w-10 text-right text-[11px] leading-none text-[var(--text-muted)]">
        {gridPcts.map((pct) => (
          <span key={pct} className={`absolute right-0 -translate-y-1/2 ${pct === 100 ? 'text-[var(--text-secondary)]' : ''}`} style={{ top: `${(y(pct) / HEIGHT) * 100}%` }}>
            {ftpWatts ? `${wattsForPct(pct, ftpWatts)}` : `${pct}%`}
          </span>
        ))}
      </div>
      <span aria-hidden="true" className="data pointer-events-none absolute right-0 -translate-y-full pb-1 text-[11px] text-[var(--text-secondary)]" style={{ top: `${(y(100) / HEIGHT) * 100}%` }}>
        FTP{ftpWatts ? ` ${ftpWatts} W` : ''}
      </span>
      <div aria-hidden="true" className="data pointer-events-none absolute inset-x-0 top-full pt-2 text-[11px] leading-none text-[var(--text-muted)]">
        {ticks.map((tick) => <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${(tick / totalSec) * 100}%` }}>{clockLabel(tick)}</span>)}
        <span className="absolute right-0">{clockLabel(totalSec)}</span>
      </div>
    </figure>
  );
}

function timeTicks(totalSec: number): number[] {
  const steps = [300, 600, 900, 1200, 1800, 3600];
  const interval = steps.find((candidate) => totalSec / candidate <= 7) ?? 3600;
  const ticks: number[] = [];
  for (let tick = interval; tick < totalSec - interval * 0.9; tick += interval) ticks.push(tick);
  return ticks;
}
