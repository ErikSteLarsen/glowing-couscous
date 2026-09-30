import type { PerformanceProfile } from './performance-profile.ts';
import { getRunningPaceZones } from './profile-training-zones.ts';

export const trainingSports = ['running', 'cycling', 'swimming'] as const;
export type TrainingSport = typeof trainingSports[number];

export function parseTrainingSports(input: unknown): TrainingSport[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.some((sport) => !trainingSports.includes(sport))) return null;
  return trainingSports.filter((sport) => input.includes(sport));
}

export function trainingSetupComplete(profile: PerformanceProfile, sports: TrainingSport[]) {
  return profile.heartRateMaxBpm !== null && sports.length > 0 && sports.every((sport) => hasTrainingSportTargets(profile, sport));
}

export function hasTrainingSportTargets(profile: PerformanceProfile, sport: TrainingSport) {
  if (sport === 'running') {
    const runningZones = getRunningPaceZones(profile);
    return [1, 2, 3, 4, 5].every((zone) => Boolean(runningZones[zone as 1 | 2 | 3 | 4 | 5]));
  }
  return sport === 'cycling' ? profile.cycling.ftpWatts !== null : profile.swimming.cssSecPer100m !== null;
}

export function parseTrainingTime(input: string): number | null {
  const parts = input.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const values = parts.map(Number);
  if (values.at(-1)! > 59 || (values.length === 3 && values[1] > 59)) return null;
  const seconds = values.length === 3 ? values[0] * 3600 + values[1] * 60 + values[2] : values[0] * 60 + values[1];
  return seconds > 0 && seconds <= 86400 ? seconds : null;
}

export function formatTrainingTime(seconds: number | null): string {
  if (seconds === null) return '';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
