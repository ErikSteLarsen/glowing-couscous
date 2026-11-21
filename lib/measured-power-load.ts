import { powerStepTss } from './planned-power-load.ts';

/** 30-second rolling-average normalized power over one-second samples; null when no sample has power. */
export function normalizedPowerFrom(length: number, powerAt: (index: number) => number | null): number | null {
  let windowSum = 0;
  let fourthPowerSum = 0;
  let hasPower = false;
  for (let index = 0; index < length; index += 1) {
    const value = powerAt(index);
    hasPower ||= value !== null;
    windowSum += value ?? 0;
    if (index >= 30) windowSum -= powerAt(index - 30) ?? 0;
    if (index >= 29) fourthPowerSum += (windowSum / 30) ** 4;
  }
  if (!hasPower) return null;
  return length < 30 ? windowSum / length : (fourthPowerSum / (length - 29)) ** 0.25;
}

/**
 * Measured power load: duration × IF² × 100, the same squared-FTP-fraction integral planned cycling load uses.
 * Unrounded; null when power or FTP is unavailable.
 */
export function measuredPowerTss(durationSec: number, normalizedPowerWatts: number | null, ftpWatts: number | null | undefined) {
  if (normalizedPowerWatts === null || !ftpWatts || ftpWatts <= 0 || !Number.isFinite(ftpWatts)) return null;
  const intensityFactor = normalizedPowerWatts / ftpWatts;
  return { intensityFactor, tss: powerStepTss(durationSec, intensityFactor, intensityFactor) };
}

/** Longest gap a reading is held across, matching the heart-rate load; longer gaps count as no power. */
const MAX_HOLD_SEC = 15;

/** Power load from sparse elapsed-time samples, holding each reading until the next one (up to 15 s). */
export function measuredPowerTssFromPoints(
  points: Array<{ elapsedSec: number; powerWatts?: number | null }>,
  durationSec: number,
  ftpWatts: number | null | undefined,
) {
  if (!ftpWatts || !points.some((point) => typeof point.powerWatts === 'number')) return null;
  const perSecond: Array<number | null> = new Array(durationSec).fill(null);
  for (let index = 0; index < points.length; index += 1) {
    const value = points[index].powerWatts ?? null;
    const start = Math.max(0, points[index].elapsedSec);
    const end = Math.min(durationSec, points[index + 1]?.elapsedSec ?? durationSec, start + MAX_HOLD_SEC);
    for (let second = start; second < end; second += 1) perSecond[second] = value;
  }
  return measuredPowerTss(durationSec, normalizedPowerFrom(durationSec, (index) => perSecond[index]), ftpWatts);
}
