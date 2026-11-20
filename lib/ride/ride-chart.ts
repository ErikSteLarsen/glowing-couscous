import type { RidePlan, RidePlanStep } from './ride-plan.ts';
import type { RideRecording } from './recorder.ts';

export type RideChartBucket = { x: number; width: number; power: number | null; target: number | null; heartRate: number | null };

/** Current position on the plan timeline; skipped steps jump ahead, free riding extends past the end. */
export function planPositionSec(recording: Pick<RideRecording, 'stepIndex' | 'stepElapsedSec' | 'timerSec' | 'laps'>, plan: RidePlan): number {
  const step = plan.steps[recording.stepIndex];
  if (step) return step.startSec + recording.stepElapsedSec;
  const freeLap = recording.laps.at(-1);
  return plan.totalSec + (freeLap && freeLap.stepIndex >= plan.steps.length ? recording.timerSec - freeLap.startSec : 0);
}

/**
 * Recorded power mapped onto the plan timeline (via laps) and averaged into at most
 * `maxBuckets` columns, so the trace lines up with the workout profile after skips.
 */
export function powerBuckets(recording: RideRecording, plan: RidePlan, domainSec: number, maxBuckets = 300): RideChartBucket[] {
  const width = Math.max(1, Math.ceil(domainSec / maxBuckets));
  const sums = new Map<number, { power: number; powerCount: number; target: number; targetCount: number; hr: number; hrCount: number }>();
  for (const lap of recording.laps) {
    const step = plan.steps[lap.stepIndex];
    const base = step ? step.startSec : plan.totalSec;
    const end = lap.endSec ?? recording.timerSec;
    for (let t = lap.startSec; t < end && t < recording.samples.length; t += 1) {
      const sample = recording.samples[t];
      const bucket = Math.floor((base + t - lap.startSec) / width);
      const entry = sums.get(bucket) ?? { power: 0, powerCount: 0, target: 0, targetCount: 0, hr: 0, hrCount: 0 };
      if (sample.p !== null) { entry.power += sample.p; entry.powerCount += 1; }
      if (sample.tgt !== null) { entry.target += sample.tgt; entry.targetCount += 1; }
      if (sample.hr !== null && sample.hr > 0) { entry.hr += sample.hr; entry.hrCount += 1; }
      sums.set(bucket, entry);
    }
  }
  return [...sums.entries()].sort(([left], [right]) => left - right).map(([bucket, entry]) => ({
    x: bucket * width,
    width,
    power: entry.powerCount ? Math.round(entry.power / entry.powerCount) : null,
    target: entry.targetCount ? Math.round(entry.target / entry.targetCount) : null,
    heartRate: entry.hrCount ? Math.round(entry.hr / entry.hrCount) : null,
  }));
}

/** On target within ±5% (or ±10 W at low power). */
export function complianceTone(power: number | null, target: number | null): 'on' | 'over' | 'under' | 'none' {
  if (power === null || target === null || target <= 0) return 'none';
  const tolerance = Math.max(10, target * 0.05);
  if (power > target + tolerance) return 'over';
  if (power < target - tolerance) return 'under';
  return 'on';
}

/** Coggan-style power zone of a step relative to FTP (Z1 < 55%, Z2 < 75%, Z3 < 90%, Z4 < 105%, else Z5); falls back to the authored zone. */
export function stepIntensityZone(step: Pick<RidePlanStep, 'startWatts' | 'endWatts' | 'zone'>, ftpWatts: number | null): number {
  if (!ftpWatts || step.startWatts === null || step.endWatts === null) return step.zone;
  const fraction = (step.startWatts + step.endWatts) / 2 / ftpWatts;
  return fraction < 0.55 ? 1 : fraction < 0.75 ? 2 : fraction < 0.9 ? 3 : fraction < 1.05 ? 4 : 5;
}
