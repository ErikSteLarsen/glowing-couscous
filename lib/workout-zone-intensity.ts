import type { PerformanceProfile } from './performance-profile.ts';
import type { TempoZone } from './tempo-blocks.ts';
import type { WorkoutTarget, WorkoutTargetMetric, WorkoutTargetReference } from './workout-targets.ts';
import { isProfilePaceZoneReference, profilePaceZoneFromReference, profilePaceZoneReference } from './workout-targets.ts';
import { calculateOlympiatoppenHeartRateZones, getRunningPaceZones, hasCompleteRunningPaceZones, OLYMPIATOPPEN_HEART_RATE_PERCENT_BANDS, racePaceSecondsPerKm, zoneForRunningPace } from './profile-training-zones.ts';
import { resolveWorkoutTarget } from './workout-target-resolution.ts';

export type ZoneBand = { low: number; high: number };
export const ZONE_BANDS: Record<WorkoutTargetMetric, Record<TempoZone, ZoneBand>> = {
  power: { 1: { low: 50, high: 65 }, 2: { low: 65, high: 75 }, 3: { low: 75, high: 90 }, 4: { low: 90, high: 105 }, 5: { low: 105, high: 125 } },
  pace: { 1: { low: 50, high: 65 }, 2: { low: 65, high: 75 }, 3: { low: 75, high: 90 }, 4: { low: 90, high: 105 }, 5: { low: 105, high: 125 } },
  hr: { 1: { low: 60, high: 75 }, 2: { low: 75, high: 85 }, 3: { low: 85, high: 92 }, 4: { low: 92, high: 100 }, 5: { low: 100, high: 110 } },
  rpe: { 1: { low: 1, high: 3 }, 2: { low: 3, high: 4 }, 3: { low: 4, high: 6 }, 4: { low: 6, high: 8 }, 5: { low: 8, high: 10 } },
};

export function defaultTargetMetric(sport: string): WorkoutTargetMetric {
  return sport === 'BIKING' ? 'power' : sport === 'RUNNING' || sport === 'SWIMMING' ? 'pace' : 'rpe';
}

export function referenceValue(sport: string, metric: WorkoutTargetMetric, profile: PerformanceProfile | null, reference?: WorkoutTargetReference | null): number | null {
  if (!profile) return null;
  if (metric === 'power') return sport === 'BIKING' ? profile.cycling.ftpWatts : null;
  if (metric === 'pace') {
    if (sport === 'RUNNING') {
      const racePace = racePaceSecondsPerKm(profile);
      if (reference === 'profile-pace' || isProfilePaceZoneReference(reference)) return null;
      if (reference === 'threshold-pace') return profile.running.thresholdPaceSecPerKm ?? racePace;
      return profile.running.thresholdPaceSecPerKm ?? racePace;
    }
    return sport === 'SWIMMING' ? profile.swimming.cssSecPer100m : null;
  }
  if (metric === 'hr') {
    if (reference === 'max-hr') return profile.heartRateMaxBpm;
    if (reference === 'threshold-hr') return sport === 'BIKING' ? profile.cycling.thresholdHrBpm : sport === 'RUNNING' ? profile.running.thresholdHrBpm : sport === 'SWIMMING' ? profile.swimming.thresholdHrBpm : null;
    return profile.heartRateMaxBpm ?? (sport === 'BIKING' ? profile.cycling.thresholdHrBpm : sport === 'RUNNING' ? profile.running.thresholdHrBpm : sport === 'SWIMMING' ? profile.swimming.thresholdHrBpm : null);
  }
  return null;
}

export function presetTarget(sport: string, zone: TempoZone, profile: PerformanceProfile | null, metric = defaultTargetMetric(sport), mode?: 'absolute' | 'relative', reference?: WorkoutTargetReference | null): WorkoutTarget {
  const band = ZONE_BANDS[metric][zone];
  const center = (band.low + band.high) / 2;
  if (metric === 'rpe') return { metric, mode: 'absolute', reference: null, low: center, high: center };
  if (metric === 'hr' && profile?.heartRateMaxBpm && reference === 'max-hr') {
    const hrBand = OLYMPIATOPPEN_HEART_RATE_PERCENT_BANDS[zone];
    return { metric, mode: 'relative', reference: 'max-hr', low: hrBand.low, high: hrBand.high };
  }
  if (metric === 'hr' && mode !== 'relative' && profile?.heartRateMaxBpm) {
    const hrZone = calculateOlympiatoppenHeartRateZones(profile.heartRateMaxBpm)?.[zone];
    if (hrZone) return { metric, mode: 'absolute', reference: null, low: hrZone.low, high: hrZone.high };
  }
  if (metric === 'pace' && sport === 'RUNNING') {
    const paceZone = getRunningPaceZones(profile)[zone];
    const profileZones = hasCompleteRunningPaceZones(profile);
    const useProfileZone = reference === 'profile-pace'
      || isProfilePaceZoneReference(reference)
      || (!mode && !reference && profileZones)
      || (mode === 'relative' && reference === 'threshold-pace' && !referenceValue(sport, metric, profile, 'threshold-pace') && profileZones);
    if (paceZone && useProfileZone) {
      return { metric, mode: 'relative', reference: profilePaceZoneReference(zone), low: 50, high: 50 };
    }
    if (paceZone && (mode === 'absolute' || (!mode && !profileZones) || (mode === 'relative' && reference === 'threshold-pace' && !referenceValue(sport, metric, profile, 'threshold-pace')))) {
      return { metric, mode: 'absolute', reference: null, low: paceZone.fastestSecPerKm, high: paceZone.slowestSecPerKm };
    }
  }
  const value = referenceValue(sport, metric, profile, reference);
  if (value && mode !== 'relative') {
    const absolute = metric === 'pace' ? Math.round(value / (center / 100)) : Math.round(value * center / 100);
    return { metric, mode: 'absolute', reference: null, low: absolute, high: absolute };
  }
  const targetReference = reference ?? (metric === 'power' ? 'ftp' : metric === 'hr' ? 'threshold-hr' : sport === 'SWIMMING' ? 'css' : 'threshold-pace');
  return { metric, mode: 'relative', reference: targetReference, low: center, high: center };
}

export function targetEffortPercent(target: WorkoutTarget, sport: string, profile: PerformanceProfile | null): number | null {
  const center = (target.low + target.high) / 2;
  if (target.metric === 'rpe' || target.mode === 'relative') return center;
  if (target.metric === 'hr' && profile?.heartRateMaxBpm) return center / profile.heartRateMaxBpm * 100;
  const reference = referenceValue(sport, target.metric, profile);
  if (!reference || center <= 0) return null;
  return target.metric === 'pace' ? reference / center * 100 : center / reference * 100;
}

export function zoneForTarget(target: WorkoutTarget, sport: string, profile: PerformanceProfile | null): TempoZone | null {
  if (target.metric === 'hr' && target.mode === 'relative' && target.reference === 'max-hr' && profile?.heartRateMaxBpm) {
    return heartRateZoneForBpm(profile.heartRateMaxBpm * ((target.low + target.high) / 200), profile.heartRateMaxBpm);
  }
  if (target.metric === 'hr' && target.mode === 'absolute' && profile?.heartRateMaxBpm) {
    return heartRateZoneForBpm((target.low + target.high) / 2, profile.heartRateMaxBpm);
  }
  if (target.metric === 'pace' && sport === 'RUNNING' && isProfilePaceZoneReference(target.reference)) {
    const resolved = resolveWorkoutTarget(target, profile, sport);
    return resolved ? zoneForRunningPace((resolved.low + resolved.high) / 2, profile) : null;
  }
  if (target.metric === 'pace' && target.mode === 'absolute' && sport === 'RUNNING') {
    const customZone = zoneForRunningPace((target.low + target.high) / 2, profile);
    if (customZone) return customZone;
  }
  const effort = targetEffortPercent(target, sport, profile);
  if (effort === null) return null;
  const bands = ZONE_BANDS[target.metric];
  if (effort < bands[2].low) return 1;
  if (effort < bands[3].low) return 2;
  if (effort < bands[4].low) return 3;
  if (effort < bands[5].low) return 4;
  return 5;
}

export function reanchorProfilePaceTarget(target: WorkoutTarget, profile: PerformanceProfile | null, zone: TempoZone): WorkoutTarget {
  if (target.metric !== 'pace' || target.mode !== 'relative' || !isProfilePaceZoneReference(target.reference)) return target;
  const anchorZone = profilePaceZoneFromReference(target.reference);
  if (!anchorZone || anchorZone === zone) return target;
  const resolved = resolveWorkoutTarget(target, profile, 'RUNNING');
  const range = getRunningPaceZones(profile)[zone];
  if (!resolved || !range) return target;
  const positionForPace = (pace: number) => (range.slowestSecPerKm - pace) / Math.max(1, range.slowestSecPerKm - range.fastestSecPerKm) * 100;
  const low = roundTargetPercent(positionForPace(resolved.high));
  const high = roundTargetPercent(positionForPace(resolved.low));
  if (low < 0 || high > 100 || low > high) return target;
  return { ...target, reference: profilePaceZoneReference(zone), low, high };
}

export function chartHeightPercent(target: WorkoutTarget | null, zone: TempoZone, sport: string, profile: PerformanceProfile | null, pause = false): number {
  if (pause) return 14;
  return heightForFraction(chartIntensityFraction(target, zone, sport, profile), zone);
}

export function chartIntensityFraction(target: WorkoutTarget | null, zone: TempoZone, sport: string, profile: PerformanceProfile | null): number {
  const center = target ? (target.low + target.high) / 2 : null;
  if (center !== null && target?.metric === 'hr' && profile?.heartRateMaxBpm && (target.mode === 'absolute' || target.reference === 'max-hr')) {
    const range = calculateOlympiatoppenHeartRateZones(profile.heartRateMaxBpm)?.[zone];
    const heartRate = target.mode === 'relative' ? profile.heartRateMaxBpm * center / 100 : center;
    if (range) return boundedFraction((heartRate - range.low) / Math.max(1, range.high - range.low));
  }
  if (center !== null && target?.metric === 'pace' && sport === 'RUNNING' && (target.mode === 'absolute' || isProfilePaceZoneReference(target.reference))) {
    const range = getRunningPaceZones(profile)[zone];
    const resolved = target.mode === 'relative' ? resolveWorkoutTarget(target, profile, sport) : null;
    const pace = resolved ? (resolved.low + resolved.high) / 2 : center;
    if (range) return boundedFraction((range.slowestSecPerKm - pace) / Math.max(1, range.slowestSecPerKm - range.fastestSecPerKm));
  }
  const effort = target ? targetEffortPercent(target, sport, profile) : null;
  const band = ZONE_BANDS[target?.metric ?? defaultTargetMetric(sport)][zone];
  return effort === null ? .5 : boundedFraction((effort - band.low) / (band.high - band.low));
}

function heightForFraction(fraction: number, zone: TempoZone): number {
  const bounded = boundedFraction(fraction);
  return Math.round((30 + ((zone - 1) + bounded) * 14) * 10) / 10;
}

function boundedFraction(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundTargetPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function heartRateZoneForBpm(bpm: number, maxHeartRate: number): TempoZone | null {
  const ranges = calculateOlympiatoppenHeartRateZones(maxHeartRate);
  if (!ranges) return null;
  const match = ([1, 2, 3, 4, 5] as TempoZone[]).find((zone) => bpm >= ranges[zone].low && bpm <= ranges[zone].high);
  return match ?? (bpm < ranges[1].low ? 1 : 5);
}
