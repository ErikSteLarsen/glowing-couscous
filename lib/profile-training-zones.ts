import type { PerformanceProfile } from './performance-profile.ts';
import type { TempoZone } from './tempo-blocks.ts';

export type NumericZoneRange = { low: number; high: number };
export type RunningPaceZoneRange = { fastestSecPerKm: number; slowestSecPerKm: number };

export const OLYMPIATOPPEN_HEART_RATE_PERCENT_BANDS: Record<TempoZone, NumericZoneRange> = {
  1: { low: 55, high: 72 },
  2: { low: 72, high: 82 },
  3: { low: 82, high: 87 },
  4: { low: 87, high: 92 },
  5: { low: 92, high: 100 },
};

const zones: TempoZone[] = [1, 2, 3, 4, 5];
const RACE_SPEED_BANDS: Record<TempoZone, NumericZoneRange> = {
  1: { low: 65, high: 75 },
  2: { low: 75, high: 85 },
  3: { low: 85, high: 93 },
  4: { low: 93, high: 103 },
  5: { low: 103, high: 115 },
};

/** Mirrors Olympiatoppen's HRmax calculator, including its floor/+1 bpm edges. */
export function calculateOlympiatoppenHeartRateZones(maxHeartRate: number | null | undefined): Record<TempoZone, NumericZoneRange> | null {
  if (!maxHeartRate || !Number.isInteger(maxHeartRate) || maxHeartRate < 100 || maxHeartRate > 250) return null;
  const edges = [55, 72, 82, 87, 92, 100].map((percent) => Math.floor(maxHeartRate * percent / 100));
  return {
    1: { low: edges[0], high: edges[1] },
    2: { low: edges[1] + 1, high: edges[2] },
    3: { low: edges[2] + 1, high: edges[3] },
    4: { low: edges[3] + 1, high: edges[4] },
    5: { low: edges[4] + 1, high: edges[5] },
  };
}

export function racePaceSecondsPerKm(profile: Pick<PerformanceProfile, 'running'>): number | null {
  const { raceDistanceMeters, raceTimeSec } = profile.running;
  if (!raceDistanceMeters || !raceTimeSec) return null;
  return Math.round(raceTimeSec * 1000 / raceDistanceMeters);
}

/**
 * Creates editable starting ranges from average race speed. These running pace
 * estimates are app defaults, not pace bands published by Olympiatoppen.
 */
export function calculateRaceBasedRunningPaceZones(racePaceSecPerKm: number | null | undefined): Record<TempoZone, RunningPaceZoneRange> | null {
  if (!racePaceSecPerKm || !Number.isFinite(racePaceSecPerKm) || racePaceSecPerKm <= 0) return null;
  return Object.fromEntries(zones.map((zone) => {
    const band = RACE_SPEED_BANDS[zone];
    return [zone, {
      fastestSecPerKm: Math.round(racePaceSecPerKm * 100 / band.high),
      slowestSecPerKm: Math.round(racePaceSecPerKm * 100 / band.low),
    }];
  })) as Record<TempoZone, RunningPaceZoneRange>;
}

export function getRunningPaceZones(profile: PerformanceProfile | null | undefined): Partial<Record<TempoZone, RunningPaceZoneRange>> {
  if (!profile) return {};
  const calculated = calculateRaceBasedRunningPaceZones(racePaceSecondsPerKm(profile));
  const ranges: Partial<Record<TempoZone, RunningPaceZoneRange>> = {};
  for (const zone of zones) {
    const override = profile.running.paceZoneOverrides[zone];
    const fastestSecPerKm = override.fastestSecPerKm ?? calculated?.[zone].fastestSecPerKm;
    const slowestSecPerKm = override.slowestSecPerKm ?? calculated?.[zone].slowestSecPerKm;
    if (fastestSecPerKm !== undefined && fastestSecPerKm !== null && slowestSecPerKm !== undefined && slowestSecPerKm !== null) {
      ranges[zone] = { fastestSecPerKm, slowestSecPerKm };
    }
  }
  return ranges;
}

export function hasCompleteRunningPaceZones(profile: PerformanceProfile | null | undefined): boolean {
  const ranges = getRunningPaceZones(profile);
  return zones.every((zone) => Boolean(ranges[zone]));
}

export function zoneForRunningPace(paceSecPerKm: number, profile: PerformanceProfile | null | undefined): TempoZone | null {
  const ranges = getRunningPaceZones(profile);
  if (!zones.every((zone) => Boolean(ranges[zone]))) return null;
  const matching = zones.find((zone) => {
    const range = ranges[zone]!;
    return paceSecPerKm >= range.fastestSecPerKm && paceSecPerKm <= range.slowestSecPerKm;
  });
  if (matching) return matching;
  if (paceSecPerKm < ranges[5]!.fastestSecPerKm) return 5;
  if (paceSecPerKm > ranges[1]!.slowestSecPerKm) return 1;
  return zones.reduce((closest, zone) => {
    const center = (ranges[zone]!.fastestSecPerKm + ranges[zone]!.slowestSecPerKm) / 2;
    const closestCenter = (ranges[closest]!.fastestSecPerKm + ranges[closest]!.slowestSecPerKm) / 2;
    return Math.abs(paceSecPerKm - center) < Math.abs(paceSecPerKm - closestCenter) ? zone : closest;
  }, 1 as TempoZone);
}

export function formatPaceSecondsPerKm(secondsPerKm: number): string {
  const rounded = Math.round(secondsPerKm);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export function parsePaceSecondsPerKm(input: string): number | null {
  const match = input.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  const total = Number(match[1]) * 60 + Number(match[2]);
  return total >= 120 && total <= 1800 ? total : null;
}
