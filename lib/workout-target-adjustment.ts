import type { WorkoutTarget } from './workout-targets.ts';

export function targetAdjustmentStep(target: WorkoutTarget): number {
  if (target.mode === 'relative') return 1;
  if (target.metric === 'power') return 5;
  if (target.metric === 'pace') return 5;
  if (target.metric === 'hr') return 1;
  return 0.5;
}

export function adjustWorkoutTarget(target: WorkoutTarget, direction: -1 | 1): WorkoutTarget | null {
  const step = targetAdjustmentStep(target) * direction * (target.metric === 'pace' && target.mode === 'absolute' ? -1 : 1);
  const low = Math.round((target.low + step) * 100) / 100;
  const high = Math.round((target.high + step) * 100) / 100;
  if (low < (target.metric === 'rpe' ? 1 : 0) || (target.metric === 'rpe' && high > 10)) return null;
  if (target.reference === 'max-hr' && high > 100) return null;
  return { ...target, low, high };
}

export function targetAdjustmentLabel(target: WorkoutTarget): string {
  if (target.mode === 'relative') return '1 percentage point';
  if (target.metric === 'power') return '5 W';
  if (target.metric === 'pace') return '5 sec';
  if (target.metric === 'hr') return '1 bpm';
  return '0.5 RPE';
}
