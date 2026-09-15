import type { PerformanceProfile } from './performance-profile.ts';
import type { WorkoutTarget } from './workout-targets.ts';

export type ResolvedWorkoutTarget = { low: number; high: number; unit: 'W' | 'bpm' | 'pace' };

export function resolveWorkoutTarget(target: WorkoutTarget, profile: PerformanceProfile | null | undefined): ResolvedWorkoutTarget | null {
  if (target.metric === 'rpe') return null;
  if (target.mode === 'absolute') return { low: target.low, high: target.high, unit: target.metric === 'power' ? 'W' : target.metric === 'hr' ? 'bpm' : 'pace' };
  if (!profile) return null;
  if (target.reference === 'ftp' && profile.cycling.ftpWatts) return scaled(target, profile.cycling.ftpWatts, 'W');
  if (target.reference === 'threshold-hr') {
    const value = profile.cycling.thresholdHrBpm ?? profile.running.thresholdHrBpm ?? profile.swimming.thresholdHrBpm;
    return value ? scaled(target, value, 'bpm') : null;
  }
  if (target.reference === 'threshold-pace' && profile.running.thresholdPaceSecPerKm) return paceScaled(target, profile.running.thresholdPaceSecPerKm);
  if (target.reference === 'css' && profile.swimming.cssSecPer100m) return paceScaled(target, profile.swimming.cssSecPer100m);
  return null;
}

export function formatWorkoutTarget(target: WorkoutTarget): string {
  const range = `${formatNumber(target.low)}-${formatNumber(target.high)}`;
  if (target.metric === 'rpe') return `RPE ${range}`;
  if (target.mode === 'relative') {
    const reference = target.reference === 'ftp' ? 'FTP' : target.reference === 'threshold-pace' ? 'threshold speed' : target.reference === 'css' ? 'CSS' : 'threshold HR';
    return `${range}% ${reference}`;
  }
  return `${range} ${target.metric === 'power' ? 'W' : target.metric === 'hr' ? 'bpm' : 'pace'}`;
}

export function formatResolvedWorkoutTarget(target: WorkoutTarget, profile: PerformanceProfile | null | undefined): string | null {
  const resolved = resolveWorkoutTarget(target, profile);
  if (!resolved) return null;
  if (resolved.unit === 'pace') return `${formatPace(resolved.low)}-${formatPace(resolved.high)}${target.reference === 'css' ? ' /100 m' : ' /km'}`;
  return `${formatNumber(resolved.low)}-${formatNumber(resolved.high)} ${resolved.unit}`;
}

export function missingProfileAction(target: WorkoutTarget): string | null {
  if (target.mode !== 'relative') return null;
  if (target.reference === 'ftp') return 'Add FTP to preview watts.';
  if (target.reference === 'threshold-pace') return 'Add threshold pace to preview pace.';
  if (target.reference === 'css') return 'Add CSS to preview pace.';
  return 'Add threshold HR to preview bpm.';
}

function scaled(target: WorkoutTarget, reference: number, unit: 'W' | 'bpm'): ResolvedWorkoutTarget { return { low: Math.round(reference * target.low / 100), high: Math.round(reference * target.high / 100), unit }; }
function paceScaled(target: WorkoutTarget, reference: number): ResolvedWorkoutTarget { return { low: Math.round(reference / (target.high / 100)), high: Math.round(reference / (target.low / 100)), unit: 'pace' }; }
function formatPace(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function formatNumber(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); }
