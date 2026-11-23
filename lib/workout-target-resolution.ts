import type { PerformanceProfile } from './performance-profile.ts';
import { isProfilePaceZoneReference, profilePaceZoneFromReference, type WorkoutTarget } from './workout-targets.ts';
import { getRunningPaceZones } from './profile-training-zones.ts';

export type ResolvedWorkoutTarget = { low: number; high: number; unit: 'W' | 'bpm' | 'pace' };

export function resolveWorkoutTarget(target: WorkoutTarget, profile: PerformanceProfile | null | undefined, sport?: string): ResolvedWorkoutTarget | null {
  if (target.metric === 'rpe') return null;
  if (target.mode === 'absolute') return { low: target.low, high: target.high, unit: target.metric === 'power' ? 'W' : target.metric === 'hr' ? 'bpm' : 'pace' };
  if (!profile) return null;
  if (target.reference === 'ftp' && profile.cycling.ftpWatts) return scaled(target, profile.cycling.ftpWatts, 'W');
  if (target.reference === 'max-hr' && profile.heartRateMaxBpm) {
    const low = target.low <= 55
      ? Math.floor(profile.heartRateMaxBpm * target.low / 100)
      : Math.floor(profile.heartRateMaxBpm * target.low / 100) + 1;
    const high = target.high >= 100
      ? profile.heartRateMaxBpm
      : Math.floor(profile.heartRateMaxBpm * target.high / 100);
    return { low, high, unit: 'bpm' };
  }
  if (target.reference === 'threshold-hr') {
    const value = sport === 'BIKING' ? profile.cycling.thresholdHrBpm : sport === 'RUNNING' ? profile.running.thresholdHrBpm : sport === 'SWIMMING' ? profile.swimming.thresholdHrBpm : profile.cycling.thresholdHrBpm ?? profile.running.thresholdHrBpm ?? profile.swimming.thresholdHrBpm;
    return value ? scaled(target, value, 'bpm') : null;
  }
  if (isProfilePaceZoneReference(target.reference) && sport === 'RUNNING') {
    const zone = profilePaceZoneFromReference(target.reference);
    const range = zone ? getRunningPaceZones(profile)[zone] : null;
    if (!range) return null;
    const paceAtPosition = (position: number) => range.slowestSecPerKm - (range.slowestSecPerKm - range.fastestSecPerKm) * position / 100;
    return { low: Math.round(paceAtPosition(target.high)), high: Math.round(paceAtPosition(target.low)), unit: 'pace' };
  }
  if (target.reference === 'threshold-pace') {
    const value = profile.running.thresholdPaceSecPerKm ?? (profile.running.raceDistanceMeters && profile.running.raceTimeSec ? Math.round(profile.running.raceTimeSec * 1000 / profile.running.raceDistanceMeters) : null);
    if (value) return paceScaled(target, value);
  }
  if (target.reference === 'css' && profile.swimming.cssSecPer100m) return paceScaled(target, profile.swimming.cssSecPer100m);
  return null;
}

export function formatWorkoutTarget(target: WorkoutTarget, sport?: string): string {
  const range = target.metric === 'pace' && target.mode === 'absolute'
    ? `${formatPace(target.low)}${target.low === target.high ? '' : `-${formatPace(target.high)}`}`
    : target.low === target.high ? formatNumber(target.low) : `${formatNumber(target.low)}-${formatNumber(target.high)}`;
  if (target.metric === 'rpe') return `RPE ${range}`;
  if (target.mode === 'relative') {
    const profileZone = profilePaceZoneFromReference(target.reference);
    const reference = target.reference === 'ftp' ? 'FTP' : target.reference === 'threshold-pace' ? 'threshold speed' : profileZone ? `Zone ${profileZone} profile pace` : target.reference === 'profile-pace' ? 'profile pace zones' : target.reference === 'css' ? 'CSS' : target.reference === 'max-hr' ? 'Olympiatoppen HRmax' : 'threshold HR';
    return `${range}% ${reference}`;
  }
  if (target.metric === 'pace') return `${range}\u00A0${sport === 'SWIMMING' ? '/100 m' : '/km'}`;
  return `${range}\u00A0${target.metric === 'power' ? 'W' : 'bpm'}`;
}

export function formatResolvedWorkoutTarget(target: WorkoutTarget, profile: PerformanceProfile | null | undefined, sport?: string): string | null {
  const resolved = resolveWorkoutTarget(target, profile, sport);
  if (!resolved) return null;
  if (resolved.unit === 'pace') return `${formatPace(resolved.low)}${resolved.low === resolved.high ? '' : `-${formatPace(resolved.high)}`}${target.reference === 'css' ? '\u00A0/100 m' : '\u00A0/km'}`;
  return `${formatNumber(resolved.low)}${resolved.low === resolved.high ? '' : `-${formatNumber(resolved.high)}`}\u00A0${resolved.unit}`;
}

export function missingProfileAction(target: WorkoutTarget): string | null {
  if (target.mode !== 'relative') return null;
  if (target.reference === 'ftp') return 'Add your FTP to see watts.';
  if (target.reference === 'threshold-pace') return 'Add your threshold pace to see pace.';
  if (target.reference === 'profile-pace' || isProfilePaceZoneReference(target.reference)) return 'Add a race result or pace zones to see your running paces.';
  if (target.reference === 'css') return 'Add your CSS to see pace.';
  if (target.reference === 'max-hr') return 'Add your maximum heart rate to see heart rate in bpm.';
  return 'Add your threshold heart rate to see bpm.';
}

function scaled(target: WorkoutTarget, reference: number, unit: 'W' | 'bpm'): ResolvedWorkoutTarget { return { low: Math.round(reference * target.low / 100), high: Math.round(reference * target.high / 100), unit }; }
function paceScaled(target: WorkoutTarget, reference: number): ResolvedWorkoutTarget { return { low: Math.round(reference / (target.high / 100)), high: Math.round(reference / (target.low / 100)), unit: 'pace' }; }
function formatPace(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function formatNumber(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); }
