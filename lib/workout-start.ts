import type { RideOs } from './ride/launch.ts';

export type WorkoutStartEligibility = { sport: string; status: string; hasSteps: boolean };
export type WorkoutStartRuntime = { os: RideOs; webBluetooth: boolean; inTempoRide: boolean };

const followAlong = {
  mode: 'live',
  label: 'Follow along',
  description: 'A timer for each block. You move on to the next block yourself.',
} as const;

const openApp = {
  mode: 'app',
  label: 'Open in Wattonaut Ride',
  description: 'Connect your trainer and sensors in the desktop app.',
} as const;

const browserRide = {
  mode: 'ride',
  label: 'Ride in this browser',
  description: 'Connect your trainer and sensors over Bluetooth, or ride without them.',
} as const;

const targetsOnly = {
  mode: 'ride',
  label: 'Ride without devices',
  description: 'Wattonaut times each block and shows its target. Your ride time is saved at the end.',
} as const;

type WorkoutStartOption = { mode: 'live' | 'ride' | 'app'; label: string; description: string };

/** Swims have no guided mode: they are scheduled, read and marked done. */
export const swimStartNote = 'Swims can’t be started here yet. Schedule the workout, then mark it done after your swim.';

export function canStartWorkout({ sport, status, hasSteps }: WorkoutStartEligibility): boolean {
  return hasSteps && sport !== 'REST' && sport !== 'SWIMMING' && status !== 'completed' && status !== 'skipped';
}

export function getWorkoutStartOptions(workout: WorkoutStartEligibility, runtime: WorkoutStartRuntime): WorkoutStartOption[] {
  if (!canStartWorkout(workout)) return [];
  if (workout.sport !== 'BIKING') return [followAlong];

  if (runtime.inTempoRide) {
    return [
      { ...(runtime.webBluetooth ? browserRide : targetsOnly), label: 'Ride in Wattonaut Ride' },
      followAlong,
    ];
  }

  const browserOptions = runtime.webBluetooth ? [browserRide, followAlong] : [followAlong, targetsOnly];
  return runtime.os === 'other' ? browserOptions : [openApp, ...browserOptions];
}
