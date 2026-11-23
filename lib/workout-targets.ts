import type { SportType } from './sport.ts';

export type WorkoutTargetMetric = 'power' | 'pace' | 'hr' | 'rpe';
export type WorkoutTargetMode = 'absolute' | 'relative';
export type ProfilePaceZoneReference = 'profile-pace-zone-1' | 'profile-pace-zone-2' | 'profile-pace-zone-3' | 'profile-pace-zone-4' | 'profile-pace-zone-5';
export type WorkoutTargetReference = 'ftp' | 'threshold-pace' | 'css' | 'threshold-hr' | 'max-hr' | 'profile-pace' | ProfilePaceZoneReference;

export type WorkoutTarget = {
  metric: WorkoutTargetMetric;
  mode: WorkoutTargetMode;
  reference: WorkoutTargetReference | null;
  low: number;
  high: number;
};

const enduranceSports: readonly SportType[] = ['RUNNING', 'BIKING', 'SWIMMING'];

export function getAvailableWorkoutTargets(sport: string): Array<{
  metric: WorkoutTargetMetric;
  mode: WorkoutTargetMode;
  reference: WorkoutTargetReference | null;
  label: string;
}> {
  const options: Array<{ metric: WorkoutTargetMetric; mode: WorkoutTargetMode; reference: WorkoutTargetReference | null; label: string }> = [
    { metric: 'rpe', mode: 'absolute', reference: null, label: 'RPE' },
  ];
  if (sport === 'BIKING') options.push({ metric: 'power', mode: 'absolute', reference: null, label: 'Watts' }, { metric: 'power', mode: 'relative', reference: 'ftp', label: '% FTP' });
  if (sport === 'RUNNING') options.push({ metric: 'pace', mode: 'absolute', reference: null, label: 'Pace' }, { metric: 'pace', mode: 'relative', reference: 'threshold-pace', label: '% threshold speed' }, { metric: 'pace', mode: 'relative', reference: 'profile-pace', label: 'Your profile pace zones' });
  if (sport === 'SWIMMING') options.push({ metric: 'pace', mode: 'absolute', reference: null, label: 'Pace /100 m' }, { metric: 'pace', mode: 'relative', reference: 'css', label: '% CSS' });
  if (enduranceSports.includes(sport as SportType)) options.push({ metric: 'hr', mode: 'absolute', reference: null, label: 'Heart rate' }, { metric: 'hr', mode: 'relative', reference: 'threshold-hr', label: '% threshold HR' }, { metric: 'hr', mode: 'relative', reference: 'max-hr', label: 'Olympiatoppen HRmax zones' });
  return options;
}

export function normalizeWorkoutTarget(input: unknown): WorkoutTarget | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const metric = value.metric ?? value.type;
  const mode = value.mode ?? 'absolute';
  const reference = value.reference ?? null;
  const low = decimalNumber(value.low);
  const high = decimalNumber(value.high);
  if (!isMetric(metric) || !isMode(mode) || low === null || high === null) return null;
  const target: WorkoutTarget = { metric, mode, reference: isReference(reference) ? reference : null, low, high };
  return validateWorkoutTarget(target) === null ? target : null;
}

export function validateWorkoutTarget(target: WorkoutTarget, sport?: string): string | null {
  if (!Number.isFinite(target.low) || !Number.isFinite(target.high) || target.low < 0 || target.high < 0) return 'Targets can’t be negative.';
  if (target.low > target.high) return 'The low target can’t be higher than the high target.';
  if (target.metric === 'rpe') {
    if (target.mode !== 'absolute' || target.reference !== null) return 'RPE targets can’t be based on your Profile.';
    if (target.low < 1 || target.high > 10) return 'RPE targets must be between 1 and 10.';
  } else if (target.mode === 'absolute') {
    if (target.reference !== null) return 'Fixed targets can’t be based on your Profile.';
  } else if (!target.reference) {
    return 'Choose what this target is a percentage of.';
  }
  if (isProfilePaceZoneReference(target.reference) && (target.metric !== 'pace' || target.mode !== 'relative' || (sport && sport !== 'RUNNING'))) {
    return 'Profile pace zones only work for running.';
  }
  if (sport && target.mode === 'relative' && !isProfilePaceZoneReference(target.reference) && !getAvailableWorkoutTargets(sport).some((option) => option.metric === target.metric && option.mode === target.mode && option.reference === target.reference)) {
    return 'This target is not available for the selected sport.';
  }
  return null;
}

export function serializeDecimal(value: number): string | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const normalized = String(value);
  return /^[0-9]+(?:\.[0-9]{1,4})?$/.test(normalized) ? normalized : null;
}

function decimalNumber(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : null;
  if (typeof input !== 'string' || !/^[0-9]+(?:\.[0-9]{1,4})?$/.test(input)) return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function isMetric(input: unknown): input is WorkoutTargetMetric { return input === 'power' || input === 'pace' || input === 'hr' || input === 'rpe'; }
function isMode(input: unknown): input is WorkoutTargetMode { return input === 'absolute' || input === 'relative'; }
function isReference(input: unknown): input is WorkoutTargetReference { return input === 'ftp' || input === 'threshold-pace' || input === 'css' || input === 'threshold-hr' || input === 'max-hr' || input === 'profile-pace' || isProfilePaceZoneReference(input); }

export function profilePaceZoneReference(zone: number): WorkoutTargetReference | null {
  return zone >= 1 && zone <= 5 ? `profile-pace-zone-${zone}` as WorkoutTargetReference : null;
}

export function profilePaceZoneFromReference(reference: WorkoutTargetReference | null | undefined): 1 | 2 | 3 | 4 | 5 | null {
  const match = typeof reference === 'string' ? reference.match(/^profile-pace-zone-([1-5])$/) : null;
  return match ? Number(match[1]) as 1 | 2 | 3 | 4 | 5 : null;
}

export function isProfilePaceZoneReference(reference: unknown): reference is ProfilePaceZoneReference {
  return typeof reference === 'string' && /^profile-pace-zone-[1-5]$/.test(reference);
}

export function targetOptionReference(reference: WorkoutTargetReference | null): WorkoutTargetReference | null {
  return isProfilePaceZoneReference(reference) ? 'profile-pace' : reference;
}
