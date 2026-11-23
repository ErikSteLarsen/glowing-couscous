import { pctColor } from '@/lib/workout-profile';

const WIDTH = 1000;
const HEIGHT = 200;

/** A catalog step, or a saved workout's `WorkoutProfileStep`; ramps are drawn when start and end differ. */
type ProfileStep = { startSec: number; durationSec: number; startPct: number; endPct: number; kind: string };

/**
 * Card-sized workout shape in %FTP on one fixed scale, so cards compare at a glance.
 * Public and saved workouts both use it; saved workouts without power targets pass
 * their zone-equivalent heights from `buildWorkoutProfile`.
 * Full-size profiles use `components/WorkoutProfile.tsx`.
 */
export function CatalogProfile({
  steps,
  idPrefix,
  className,
  label,
}: {
  steps: ProfileStep[];
  idPrefix: string;
  className?: string;
  label: string;
}) {
  const totalSec = Math.max(1, steps.reduce((sum, step) => sum + step.durationSec, 0));
  const maxPct = Math.max(0, ...steps.map((step) => Math.max(step.startPct, step.endPct)));
  const top = Math.max(125, maxPct * 1.04);
  const x = (sec: number) => (sec / totalSec) * WIDTH;
  const y = (pct: number) => HEIGHT - (Math.min(pct, top) / top) * HEIGHT;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={`block w-full ${className ?? 'h-12'}`}
    >
      <defs>
        {steps.map((step, index) => step.startPct !== step.endPct ? (
          <linearGradient key={index} id={`${idPrefix}-ramp-${index}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={pctColor(step.startPct)} />
            <stop offset="100%" stopColor={pctColor(step.endPct)} />
          </linearGradient>
        ) : null)}
      </defs>
      {steps.map((step, index) => {
        const x0 = x(step.startSec);
        const x1 = x(step.startSec + step.durationSec);
        return (
          <path
            key={index}
            d={`M${x0},${HEIGHT}L${x0},${y(step.startPct)}L${x1},${y(step.endPct)}L${x1},${HEIGHT}Z`}
            fill={step.startPct !== step.endPct ? `url(#${idPrefix}-ramp-${index})` : pctColor((step.startPct + step.endPct) / 2)}
            fillOpacity={step.kind === 'recovery' || step.kind === 'cooldown' || step.kind === 'warmup' || step.kind === 'pause' ? 0.72 : 0.92}
            stroke="var(--profile-gap, var(--surface))"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
