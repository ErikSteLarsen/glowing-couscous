import { powerStepTss, powerTargetEndpoints } from '../planned-power-load.ts';
import type { TempoZone } from '../tempo-blocks.ts';
import { ZONE_BANDS } from '../workout-zone-intensity.ts';
import type { CatalogItem, CatalogStep, CatalogStepKind, CatalogWorkout } from './types.ts';

/** One ridden step after repeats are unrolled. Ramps run from `startPct` to `endPct`. */
export type CatalogFlatStep = {
  index: number;
  kind: CatalogStepKind;
  durationSec: number;
  startSec: number;
  lowPct: number;
  highPct: number;
  startPct: number;
  endPct: number;
  ramp: boolean;
  cadence: [number, number] | null;
  cue: string | null;
  /** Index of the source item in `workout.items`, and the repetition within a set (1-based) when repeated. */
  itemIndex: number;
  set: { repetition: number; of: number } | null;
};

export type CatalogMetrics = {
  durationSec: number;
  /** Normalized-power estimate from the planned %FTP profile (a 4th-power mean, no 30 s smoothing). */
  npPct: number;
  /** Intensity factor, NP / FTP. */
  intensityFactor: number;
  tss: number;
  averagePct: number;
  maxPct: number;
  /** Seconds in Tempo's five power zones (Z1–Z5), from the shared %FTP zone bands. */
  zoneSec: [number, number, number, number, number];
  workSec: number;
  intervalCount: number;
};

export function isCatalogRepeat(item: CatalogItem): item is Extract<CatalogItem, { repeat: number }> {
  return 'repeat' in item;
}

/**
 * Ramps follow the ride plan: warm-ups with a range rise low → high, cool-downs fall
 * high → low, and every other ranged step is ridden at its midpoint.
 */
export function stepEndpoints(step: Pick<CatalogStep, 'kind' | 'lowPct' | 'highPct'>): { startPct: number; endPct: number; ramp: boolean } {
  const { start, end } = powerTargetEndpoints(step.kind, step.lowPct, step.highPct);
  return { startPct: start, endPct: end, ramp: start !== end };
}

export function expandCatalogItems(items: readonly CatalogItem[]): CatalogFlatStep[] {
  const steps: CatalogFlatStep[] = [];
  let startSec = 0;
  const push = (step: CatalogStep, itemIndex: number, set: CatalogFlatStep['set']) => {
    steps.push({
      index: steps.length,
      kind: step.kind,
      durationSec: step.durationSec,
      startSec,
      lowPct: step.lowPct,
      highPct: step.highPct,
      ...stepEndpoints(step),
      cadence: step.cadence ? [step.cadence[0], step.cadence[1]] : null,
      cue: step.cue?.trim() || null,
      itemIndex,
      set,
    });
    startSec += step.durationSec;
  };
  items.forEach((item, itemIndex) => {
    if (isCatalogRepeat(item)) {
      for (let repetition = 1; repetition <= item.repeat; repetition += 1) {
        for (const step of item.steps) push(step, itemIndex, { repetition, of: item.repeat });
      }
    } else {
      push(item, itemIndex, null);
    }
  });
  return steps;
}

/** Shared %FTP power zone for a value, using the same bands as the workout editor. */
export function zoneForPct(pct: number): TempoZone {
  const bands = ZONE_BANDS.power;
  if (pct < bands[2].low) return 1;
  if (pct < bands[3].low) return 2;
  if (pct < bands[4].low) return 3;
  if (pct < bands[5].low) return 4;
  return 5;
}

/** Mean of x^n over a linear ramp from a to b. */
function rampPowerMean(a: number, b: number, n: number): number {
  if (a === b) return a ** n;
  return (b ** (n + 1) - a ** (n + 1)) / ((n + 1) * (b - a));
}

/** Seconds of a linear ramp that fall within [low, high). */
function rampSecondsWithin(step: Pick<CatalogFlatStep, 'startPct' | 'endPct' | 'durationSec'>, low: number, high: number): number {
  const { startPct: a, endPct: b, durationSec } = step;
  if (a === b) return a >= low && a < high ? durationSec : 0;
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  const overlap = Math.max(0, Math.min(max, high) - Math.max(min, low));
  return (overlap / (max - min)) * durationSec;
}

export function computeCatalogMetrics(items: readonly CatalogItem[]): CatalogMetrics {
  const steps = expandCatalogItems(items);
  const durationSec = steps.reduce((sum, step) => sum + step.durationSec, 0);
  let fourth = 0;
  let linear = 0;
  let tss = 0;
  let maxPct = 0;
  const zoneSec: CatalogMetrics['zoneSec'] = [0, 0, 0, 0, 0];
  const bands = ZONE_BANDS.power;
  const edges = [0, bands[2].low, bands[3].low, bands[4].low, bands[5].low, Number.POSITIVE_INFINITY];
  for (const step of steps) {
    const a = step.startPct / 100;
    const b = step.endPct / 100;
    tss += powerStepTss(step.durationSec, a, b);
    fourth += rampPowerMean(a, b, 4) * step.durationSec;
    linear += rampPowerMean(a, b, 1) * step.durationSec;
    maxPct = Math.max(maxPct, step.startPct, step.endPct);
    for (let zone = 0; zone < 5; zone += 1) zoneSec[zone] += rampSecondsWithin(step, edges[zone], edges[zone + 1]);
  }
  const np = durationSec > 0 ? (fourth / durationSec) ** 0.25 : 0;
  const workSteps = steps.filter((step) => step.kind === 'work');
  return {
    durationSec,
    npPct: Math.round(np * 1000) / 10,
    intensityFactor: Math.round(np * 100) / 100,
    tss: Math.round(tss),
    averagePct: durationSec > 0 ? Math.round((linear / durationSec) * 1000) / 10 : 0,
    maxPct,
    zoneSec: zoneSec.map((seconds) => Math.round(seconds)) as CatalogMetrics['zoneSec'],
    workSec: workSteps.reduce((sum, step) => sum + step.durationSec, 0),
    intervalCount: workSteps.length,
  };
}

export function catalogWorkoutMetrics(workout: Pick<CatalogWorkout, 'items'>): CatalogMetrics {
  return computeCatalogMetrics(workout.items);
}

/** Watts for a %FTP value, rounded to whole watts. */
export function wattsForPct(pct: number, ftpWatts: number): number {
  return Math.round((pct / 100) * ftpWatts);
}
