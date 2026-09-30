import { deriveSessionMetrics } from './session-math.ts';
import type { TempoBlock, TempoZone } from './tempo-blocks.ts';
import type { WorkoutTargetReference } from './workout-targets.ts';

export type PlannerSourceMetricBlock = {
  durationSec: number;
  reps?: number | null;
  skipped?: boolean;
};

type PlannerSessionMetricBlock = PlannerSourceMetricBlock & {
  kind: string;
  zone: number;
  targetType: string | null;
  targetMode?: string | null;
  targetReference?: string | null;
  targetLow: number | null;
  targetHigh: number | null;
  targetLowDecimal?: string | null;
  targetHighDecimal?: string | null;
};

export function derivePlannerSessionMetrics(blocks: PlannerSessionMetricBlock[]) {
  return deriveSessionMetrics(blocks.map((block): TempoBlock => ({
    kind: block.kind === 'warmup' || block.kind === 'recovery' || block.kind === 'cooldown' || block.kind === 'pause'
      ? block.kind
      : 'work',
    zone: block.zone >= 1 && block.zone <= 5 ? Math.round(block.zone) as TempoZone : 2,
    durationSec: block.durationSec,
    reps: block.reps,
    target: block.targetType && block.targetLow !== null && block.targetHigh !== null
      ? {
          metric: block.targetType === 'pace' || block.targetType === 'hr' || block.targetType === 'rpe' ? block.targetType : 'power',
          mode: block.targetMode === 'relative' ? 'relative' : 'absolute',
          reference: block.targetReference as WorkoutTargetReference | null,
          low: Number(block.targetLowDecimal ?? block.targetLow),
          high: Number(block.targetHighDecimal ?? block.targetHigh),
        }
      : null,
  })));
}

export function derivePlannerSourceDurationSec(blocks: PlannerSourceMetricBlock[]) {
  return deriveSessionMetrics(
    blocks
      .filter((block) => !block.skipped)
      .map((block) => ({
        kind: 'work' as const,
        zone: 1 as const,
        durationSec: block.durationSec,
        reps: block.reps ?? null,
        target: null,
      })),
  ).durationSec;
}
