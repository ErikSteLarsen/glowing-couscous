import type { RideOs } from './ride/launch.ts';

export type WorkoutStartEligibility = { sport: string; status: string; hasSteps: boolean };
export type WorkoutStartRuntime = { os: RideOs; webBluetooth: boolean; inWattonautRide: boolean };

export type WorkoutStartMode = 'live' | 'ride' | 'app';

export type WorkoutStartIcon = 'desktop' | 'bluetooth' | 'timer' | 'bike';

export type WorkoutStartOption = {
  mode: WorkoutStartMode;
  icon: WorkoutStartIcon;
  label: string;
  /** A few words under the label, read at a glance. */
  hint: string;
  /** The full explanation, shown behind a disclosure. */
  detail: string;
};

/** What the chooser shows: the recommended option, if any, and the rest in order. */
export type WorkoutStartChoices = {
  recommended: (WorkoutStartOption & { reason: string }) | null;
  others: WorkoutStartOption[];
};

const blockTimer = {
  icon: 'timer',
  mode: 'live',
  label: 'Block timer',
  hint: 'A timer for each block',
  detail: 'A timer for each block. You move on to the next block yourself.',
} as const;

const openApp = {
  icon: 'desktop',
  mode: 'app',
  label: 'Open in Wattonaut Ride',
  hint: 'Desktop app for your trainer',
  detail: 'Connect your trainer and sensors in the desktop app.',
} as const;

const browserRide = {
  icon: 'bluetooth',
  mode: 'ride',
  label: 'Ride in this browser',
  hint: 'Trainer and sensors over Bluetooth',
  detail: 'Connect your trainer and sensors over Bluetooth, or ride without them.',
} as const;

const withoutDevices = {
  icon: 'bike',
  mode: 'ride',
  label: 'Ride without devices',
  hint: 'Targets and time, no sensors',
  detail: 'Wattonaut times each block and shows its target. Your ride time is saved at the end.',
} as const;

/** Swims have no guided mode: they are scheduled, read and marked done. */
export const swimStartNote = 'Swims can’t be started here yet. Schedule the workout, then mark it done after your swim.';

export function canStartWorkout({ sport, status, hasSteps }: WorkoutStartEligibility): boolean {
  return hasSteps && sport !== 'REST' && sport !== 'SWIMMING' && status !== 'completed' && status !== 'skipped';
}

function recommend([first, ...others]: WorkoutStartOption[], reason: string): WorkoutStartChoices {
  return { recommended: { ...first, reason }, others };
}

/**
 * Bike options put the best way to ride on this device first: the trainer over
 * Bluetooth when this browser can, then the desktop app, then the block timer.
 */
export function getWorkoutStartChoices(workout: WorkoutStartEligibility, runtime: WorkoutStartRuntime): WorkoutStartChoices {
  if (!canStartWorkout(workout)) return { recommended: null, others: [] };
  if (workout.sport !== 'BIKING') return { recommended: null, others: [blockTimer] };

  if (runtime.inWattonautRide) {
    return runtime.webBluetooth
      ? recommend([{ ...browserRide, label: 'Ride in Wattonaut Ride' }, blockTimer], 'Connect your trainer and sensors')
      : recommend([{ ...withoutDevices, label: 'Ride in Wattonaut Ride' }, blockTimer], 'Targets and time, no sensors');
  }

  const desktop = runtime.os !== 'other';
  if (runtime.webBluetooth) {
    return recommend(desktop ? [browserRide, openApp, blockTimer] : [browserRide, blockTimer], 'Connect your trainer over Bluetooth');
  }
  return desktop
    ? recommend([openApp, blockTimer, withoutDevices], 'This browser can’t use Bluetooth')
    : recommend([blockTimer, withoutDevices], blockTimer.hint);
}

/** Every option in display order. */
export function getWorkoutStartOptions(workout: WorkoutStartEligibility, runtime: WorkoutStartRuntime): WorkoutStartOption[] {
  const { recommended, others } = getWorkoutStartChoices(workout, runtime);
  return recommended ? [recommended, ...others] : others;
}
