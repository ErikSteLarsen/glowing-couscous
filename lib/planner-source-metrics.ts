import { deriveSessionMetrics } from './session-math.ts';

export type PlannerSourceMetricBlock = {
  durationSec: number;
  reps?: number | null;
  skipped?: boolean;
};

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