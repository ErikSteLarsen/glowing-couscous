import { applyBias, type RidePlan, type RidePlanStep } from './ride-plan.ts';
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

/** Generous average glyph width of the chart's numerals, in em. */
const LABEL_CHAR_EM = 0.62;
const LABEL_PADDING_PX = 7;
const LABEL_LINE_EM = 1.25;
/** Space under and over a label inside its block. */
const LABEL_MARGIN_PX = 8;

/** A block's length as short as it reads: "45s", "5m", "2:30", "75m". */
export function shortDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const seconds = totalSec % 60;
  const minutes = Math.floor(totalSec / 60);
  return seconds ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${minutes}m`;
}

/**
 * The lines to write inside a block of the profile: its length and effort on one line
 * ("5m – 300 W"), else on two, else the effort alone, else the bare watts, else nothing. The effort
 * is a ramp ("150–250 W") or, without watts, the zone ("Z2"); a pause has only its length.
 */
export function blockLabelLines(
  step: Pick<RidePlanStep, 'kind' | 'zone' | 'durationSec' | 'startWatts' | 'endWatts'>,
  room: { widthPx: number; heightPx: number; fontPx: number },
  biasPct = 0,
): string[] {
  const duration = shortDuration(step.durationSec);
  let forms: string[][];
  if (step.startWatts !== null && step.endWatts !== null) {
    const start = applyBias(step.startWatts, biasPct);
    const end = applyBias(step.endWatts, biasPct);
    const watts = start === end ? `${start}` : `${start}–${end}`;
    forms = [[`${duration} – ${watts} W`], [duration, `${watts} W`], [`${watts} W`], [duration, watts], [watts]];
  } else if (step.kind === 'pause') {
    forms = [[duration]];
  } else {
    forms = [[`${duration} – Z${step.zone}`], [duration, `Z${step.zone}`], [`Z${step.zone}`]];
  }
  const fits = (lines: string[]) =>
    Math.max(...lines.map((line) => line.length)) * LABEL_CHAR_EM * room.fontPx + LABEL_PADDING_PX <= room.widthPx
    && lines.length * LABEL_LINE_EM * room.fontPx + LABEL_MARGIN_PX <= room.heightPx;
  return forms.find(fits) ?? [];
}
