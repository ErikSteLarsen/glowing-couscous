/** Elapsed-time boundaries survive sampling changes; no provider array indexes. */
export type ActivityLap = { startSec: number; endSec: number; timerSec: number | null; origin: 'device' | 'unknown' };

export function validateActivityLaps(value: unknown, durationSec: number): ActivityLap[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500) return null;
  const laps: ActivityLap[] = [];
  let end = 0;
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') return null;
    const lap = candidate as Record<string, unknown>;
    if (!Number.isInteger(lap.startSec) || !Number.isInteger(lap.endSec) ||
      Number(lap.startSec) < end || Number(lap.endSec) <= Number(lap.startSec) || Number(lap.endSec) > durationSec) return null;
    const timerSec = lap.timerSec == null ? null : lap.timerSec;
    if (timerSec !== null && (typeof timerSec !== 'number' || !Number.isFinite(timerSec) || timerSec < 0 || timerSec > Number(lap.endSec) - Number(lap.startSec) + 1)) return null;
    laps.push({ startSec: Number(lap.startSec), endSec: Number(lap.endSec), timerSec, origin: lap.origin === 'device' ? 'device' : 'unknown' });
    end = Number(lap.endSec);
  }
  return laps;
}
