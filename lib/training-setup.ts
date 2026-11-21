import type { PerformanceProfile } from './performance-profile.ts';
import { getRunningPaceZones } from './profile-training-zones.ts';

export const trainingSports = ['running', 'cycling', 'swimming'] as const;
export type TrainingSport = typeof trainingSports[number];

export function parseTrainingSports(input: unknown): TrainingSport[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.some((sport) => !trainingSports.includes(sport))) return null;
  return trainingSports.filter((sport) => input.includes(sport));
}

export type TrainingSetupTarget = 'heart-rate' | TrainingSport;

const workoutSports = { running: 'RUNNING', cycling: 'BIKING', swimming: 'SWIMMING' } satisfies Record<TrainingSport, string>;

export function getTrainingSetupTarget(
  profile: PerformanceProfile,
  sports: readonly TrainingSport[] | null,
  workoutSport?: string,
): TrainingSetupTarget | null {
  const missingSports = (sports ?? trainingSports).filter((sport) => !hasTrainingSportTargets(profile, sport));
  return missingSports.find((sport) => workoutSports[sport] === workoutSport)
    ?? (profile.heartRateMaxBpm === null ? 'heart-rate' : missingSports[0] ?? null);
}

function hasTrainingSportTargets(profile: PerformanceProfile, sport: TrainingSport) {
  if (sport === 'running') {
    const runningZones = getRunningPaceZones(profile);
    return [1, 2, 3, 4, 5].every((zone) => Boolean(runningZones[zone as 1 | 2 | 3 | 4 | 5]));
  }
  return sport === 'cycling' ? profile.cycling.ftpWatts !== null : profile.swimming.cssSecPer100m !== null;
}
