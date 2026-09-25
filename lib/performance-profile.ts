import type { TempoZone } from './tempo-blocks.ts';
import { getRunningPaceZones } from './profile-training-zones.ts';

export type RunningPaceZone = {
  fastestSecPerKm: number | null;
  slowestSecPerKm: number | null;
};

export type RunningPaceZones = Record<TempoZone, RunningPaceZone>;

export type PerformanceProfile = {
  version: 2;
  heartRateMaxBpm: number | null;
  cycling: { ftpWatts: number | null; thresholdHrBpm: number | null };
  running: {
    thresholdPaceSecPerKm: number | null;
    thresholdHrBpm: number | null;
    raceDistanceMeters: number | null;
    raceTimeSec: number | null;
    paceZoneOverrides: RunningPaceZones;
  };
  swimming: { cssSecPer100m: number | null; thresholdHrBpm: number | null };
};

const raceDistances = new Set([3000, 5000, 10000, 21097, 42195]);
const zones: TempoZone[] = [1, 2, 3, 4, 5];

export function createEmptyPerformanceProfile(): PerformanceProfile {
  return {
    version: 2,
    heartRateMaxBpm: null,
    cycling: { ftpWatts: null, thresholdHrBpm: null },
    running: {
      thresholdPaceSecPerKm: null,
      thresholdHrBpm: null,
      raceDistanceMeters: null,
      raceTimeSec: null,
      paceZoneOverrides: emptyRunningPaceZones(),
    },
    swimming: { cssSecPer100m: null, thresholdHrBpm: null },
  };
}

export function normalizePerformanceProfile(input: unknown): PerformanceProfile {
  const value = asRecord(input);
  const cycling = asRecord(value.cycling);
  const running = asRecord(value.running);
  const swimming = asRecord(value.swimming);
  const paceZoneInput = asRecord(running.paceZoneOverrides);
  return {
    version: 2,
    heartRateMaxBpm: boundedInteger(value.heartRateMaxBpm, 100, 250),
    cycling: { ftpWatts: positiveNumber(cycling.ftpWatts), thresholdHrBpm: positiveNumber(cycling.thresholdHrBpm) },
    running: {
      thresholdPaceSecPerKm: positiveNumber(running.thresholdPaceSecPerKm),
      thresholdHrBpm: positiveNumber(running.thresholdHrBpm),
      raceDistanceMeters: allowedRaceDistance(running.raceDistanceMeters),
      raceTimeSec: boundedInteger(running.raceTimeSec, 180, 86400),
      paceZoneOverrides: Object.fromEntries(zones.map((zone) => [zone, normalizePaceZone(paceZoneInput[String(zone)])])) as RunningPaceZones,
    },
    swimming: { cssSecPer100m: positiveNumber(swimming.cssSecPer100m), thresholdHrBpm: positiveNumber(swimming.thresholdHrBpm) },
  };
}

export function validatePerformanceProfile(input: unknown): string | null {
  const value = asRecord(input);
  const running = asRecord(value.running);
  const heartRateMax = value.heartRateMaxBpm;
  if (heartRateMax !== null && heartRateMax !== undefined && heartRateMax !== '' && boundedInteger(heartRateMax, 100, 250) === null) {
    return 'Maximum heart rate must be a whole number between 100 and 250 bpm.';
  }

  const distance = running.raceDistanceMeters;
  const time = running.raceTimeSec;
  const hasDistance = distance !== null && distance !== undefined && distance !== '';
  const hasTime = time !== null && time !== undefined && time !== '';
  if (hasDistance !== hasTime) return 'Enter both a race distance and finish time to calculate running zones.';
  if (hasDistance && allowedRaceDistance(distance) === null) return 'Choose a supported race distance.';
  if (hasTime && boundedInteger(time, 180, 86400) === null) return 'Race time must be between 3 minutes and 24 hours.';
  if (hasDistance && hasTime) {
    const paceSecPerKm = Number(time) * 1000 / Number(distance);
    if (paceSecPerKm < 120 || paceSecPerKm > 1800) return 'Race pace must be between 2:00 and 30:00 per kilometre.';
  }

  const profile = normalizePerformanceProfile(input);
  const overrideInput = asRecord(running.paceZoneOverrides);
  for (const zone of zones) {
    const raw = asRecord(overrideInput[String(zone)]);
    const fastest = raw.fastestSecPerKm;
    const slowest = raw.slowestSecPerKm;
    const hasFastest = fastest !== null && fastest !== undefined && fastest !== '';
    const hasSlowest = slowest !== null && slowest !== undefined && slowest !== '';
    if (hasFastest !== hasSlowest) return `Enter both pace bounds for Zone ${zone}, or reset that zone to its calculated default.`;
    if (hasFastest && !normalizePaceZone(raw)) return `Zone ${zone} paces must be whole seconds per kilometre, from 2:00 to 30:00, with the faster pace first.`;
  }

  const paceZones = getRunningPaceZones(profile);
  for (const zone of zones.slice(1)) {
    const previous = paceZones[(zone - 1) as TempoZone];
    const current = paceZones[zone];
    if (previous && current && previous.fastestSecPerKm < current.slowestSecPerKm) {
      return `Zone ${zone - 1} must stay slower than Zone ${zone}.`;
    }
  }
  return null;
}

export function parsePerformanceProfileJson(input: string | null | undefined): PerformanceProfile {
  if (!input) return createEmptyPerformanceProfile();
  try {
    return normalizePerformanceProfile(JSON.parse(input));
  } catch {
    return createEmptyPerformanceProfile();
  }
}

export function serializePerformanceProfile(profile: unknown): string {
  return JSON.stringify(normalizePerformanceProfile(profile));
}

function positiveNumber(input: unknown): number | null {
  if (input === null || input === undefined || input === '') return null;
  const value = Number(input);
  return Number.isFinite(value) && value > 0 && value <= 1000000 ? value : null;
}

function emptyRunningPaceZones(): RunningPaceZones {
  return Object.fromEntries(zones.map((zone) => [zone, { fastestSecPerKm: null, slowestSecPerKm: null }])) as RunningPaceZones;
}

function normalizePaceZone(input: unknown): RunningPaceZone {
  const value = asRecord(input);
  const fastestSecPerKm = boundedInteger(value.fastestSecPerKm, 120, 1800);
  const slowestSecPerKm = boundedInteger(value.slowestSecPerKm, 120, 1800);
  if (fastestSecPerKm === null || slowestSecPerKm === null || fastestSecPerKm > slowestSecPerKm) {
    return { fastestSecPerKm: null, slowestSecPerKm: null };
  }
  return { fastestSecPerKm, slowestSecPerKm };
}

function allowedRaceDistance(input: unknown): number | null {
  const distance = boundedInteger(input, 1, 1000000);
  return distance !== null && raceDistances.has(distance) ? distance : null;
}

function boundedInteger(input: unknown, min: number, max: number): number | null {
  if (input === null || input === undefined || input === '') return null;
  const value = Number(input);
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? input as Record<string, unknown> : {};
}
