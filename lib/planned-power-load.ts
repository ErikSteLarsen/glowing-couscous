import type { TempoBlockKind } from './tempo-blocks.ts';
import type { WorkoutTarget } from './workout-targets.ts';

export function powerTargetEndpoints(kind: TempoBlockKind, low: number, high: number) {
  if (kind === 'warmup') return { start: low, end: high };
  if (kind === 'cooldown') return { start: high, end: low };
  const midpoint = (low + high) / 2;
  return { start: midpoint, end: midpoint };
}

/** Integrates squared FTP fraction over a steady target or linear ramp. */
export function powerStepTss(durationSec: number, start: number, end: number) {
  const meanSquare = (start ** 2 + start * end + end ** 2) / 3;
  return (durationSec / 3600) * meanSquare * 100;
}

export function blockPowerTss(
  kind: TempoBlockKind,
  durationSec: number,
  target: WorkoutTarget | null | undefined,
  ftpWatts: number | null | undefined,
) {
  if (target?.metric !== 'power') return null;
  const scale = target.mode === 'relative'
    ? target.reference === 'ftp' ? 100 : null
    : ftpWatts;
  if (!scale || scale <= 0 || !Number.isFinite(scale)) return null;
  const { start, end } = powerTargetEndpoints(kind, target.low, target.high);
  return powerStepTss(durationSec, start / scale, end / scale);
}
