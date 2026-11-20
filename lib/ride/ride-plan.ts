import { powerTargetEndpoints } from '../planned-power-load.ts';
import type { SessionEditorBlock } from '../session-editor.ts';
import type { PerformanceProfile } from '../performance-profile.ts';
import { expandRepeatedBlocks } from '../workout-blocks.ts';
import { resolveWorkoutTarget } from '../workout-target-resolution.ts';

export type RidePlanStep = {
  /** Matches `ExecutionStep.id` so both views describe the same repetition. */
  id: string;
  kind: SessionEditorBlock['kind'];
  zone: number;
  startSec: number;
  durationSec: number;
  /** Resolved watt range, or null for free ride (no power target or no FTP). */
  lowWatts: number | null;
  highWatts: number | null;
  /** Ramp endpoints. Equal for steady steps; null for free ride. */
  startWatts: number | null;
  endWatts: number | null;
};

export type RidePlan = { steps: RidePlanStep[]; totalSec: number; ftpWatts: number | null };

/**
 * Builds ERG targets from the same ordered repetitions as `createExecutionSteps`.
 * Steady steps target the range midpoint. Warm-ups with a range ramp low to high and
 * cool-downs ramp high to low, which is how a range on those blocks reads on a trainer.
 */
export function createRidePlan(blocks: SessionEditorBlock[], profile?: PerformanceProfile | null): RidePlan {
  let startSec = 0;
  const steps = expandRepeatedBlocks(blocks.filter((block) => !block.skipped)).map((block) => {
    const resolved = block.target?.metric === 'power' ? resolveWorkoutTarget(block.target, profile, 'BIKING') : null;
    const low = resolved?.unit === 'W' ? resolved.low : null;
    const high = resolved?.unit === 'W' ? resolved.high : null;
    const endpoints = low !== null && high !== null ? powerTargetEndpoints(block.kind, low, high) : null;
    const steadyWatts = endpoints && endpoints.start === endpoints.end ? Math.round(endpoints.start) : null;
    const step: RidePlanStep = {
      id: `${block.clientId}:${block.occurrence}`,
      kind: block.kind,
      zone: block.zone,
      startSec,
      durationSec: Math.max(0, Math.round(block.durationSec)),
      lowWatts: low,
      highWatts: high,
      startWatts: steadyWatts ?? endpoints?.start ?? null,
      endWatts: steadyWatts ?? endpoints?.end ?? null,
    };
    startSec += step.durationSec;
    return step;
  });
  return { steps, totalSec: startSec, ftpWatts: profile?.cycling.ftpWatts ?? null };
}

export function applyBias(watts: number, biasPct: number): number {
  return Math.max(0, Math.round(watts * (1 + biasPct / 100)));
}

/** ERG target for a position inside a step, after the rider's intensity bias. */
export function targetWattsAt(step: RidePlanStep | undefined, offsetSec: number, biasPct = 0): number | null {
  if (!step || step.startWatts === null || step.endWatts === null) return null;
  const fraction = step.durationSec > 0 ? Math.min(1, Math.max(0, offsetSec / step.durationSec)) : 0;
  return applyBias(step.startWatts + (step.endWatts - step.startWatts) * fraction, biasPct);
}

/** Ramps are pushed in small increments rather than every second. */
export function ergTargetChanged(previous: number | null, next: number | null, step = 5): boolean {
  if (previous === null || next === null) return previous !== next;
  return Math.abs(next - previous) >= step;
}

export function planHasPowerTargets(plan: RidePlan): boolean {
  return plan.steps.some((step) => step.startWatts !== null);
}
