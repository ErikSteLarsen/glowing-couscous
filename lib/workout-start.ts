import type { RideOs } from './ride/launch.ts';

export type WorkoutStartEligibility = { sport: string; status: string; hasSteps: boolean };
export type WorkoutStartRuntime = { os: RideOs; webBluetooth: boolean; inTempoRide: boolean };

const followAlong = {
  mode: 'live',
  label: 'Follow along',
  description: 'Use a step timer and advance through the workout yourself.',
} as const;

const openApp = {
  mode: 'app',
  label: 'Open in Tempo Ride',
  description: 'Use Bluetooth devices in the desktop app.',
} as const;

const browserRide = {
  mode: 'ride',
  label: 'Ride in this browser',
  description: 'Use Bluetooth devices or ride to the targets.',
} as const;

const targetsOnly = {
  mode: 'ride',
  label: 'Ride with targets only',
  description: 'Time bike intervals automatically and save your ride duration.',
} as const;

type WorkoutStartOption = { mode: 'live' | 'ride' | 'app'; label: string; description: string };

export function canStartWorkout({ sport, status, hasSteps }: WorkoutStartEligibility): boolean {
  return hasSteps && sport !== 'REST' && status !== 'completed' && status !== 'skipped';
}

export function getWorkoutStartOptions(workout: WorkoutStartEligibility, runtime: WorkoutStartRuntime): WorkoutStartOption[] {
  if (!canStartWorkout(workout)) return [];
  if (workout.sport !== 'BIKING') return [followAlong];

  if (runtime.inTempoRide) {
    return [
      { ...(runtime.webBluetooth ? browserRide : targetsOnly), label: 'Ride in Tempo Ride' },
      followAlong,
    ];
  }

  const browserOptions = runtime.webBluetooth ? [browserRide, followAlong] : [followAlong, targetsOnly];
  return runtime.os === 'other' ? browserOptions : [openApp, ...browserOptions];
}
