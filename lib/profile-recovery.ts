import type { PerformanceProfile } from './performance-profile.ts';
import type { TempoZone } from './tempo-blocks.ts';

export type ProfileRecovery = {
  name: string; profile: PerformanceProfile; raceTimeDraft: string;
  customizedZones: Record<TempoZone, boolean>;
  paceDrafts: Record<TempoZone, { fastest: string; slowest: string }>;
};

export function parseProfileRecovery(payload: string): ProfileRecovery | null {
  try {
    const value = JSON.parse(payload) as ProfileRecovery;
    if (!value || typeof value.name !== 'string' || typeof value.raceTimeDraft !== 'string' || value.profile?.version !== 2) return null;
    const numeric = (candidate: unknown) => candidate === null || (typeof candidate === 'number' && Number.isFinite(candidate));
    const profile = value.profile;
    if (!numeric(profile.heartRateMaxBpm) || !profile.cycling || !profile.running || !profile.swimming) return null;
    if (![profile.cycling.ftpWatts, profile.cycling.thresholdHrBpm, profile.running.thresholdPaceSecPerKm, profile.running.thresholdHrBpm, profile.running.raceDistanceMeters, profile.running.raceTimeSec, profile.swimming.cssSecPer100m, profile.swimming.thresholdHrBpm].every(numeric)) return null;
    for (const zone of [1, 2, 3, 4, 5] as const) {
      if (typeof value.customizedZones?.[zone] !== 'boolean' || typeof value.paceDrafts?.[zone]?.fastest !== 'string' || typeof value.paceDrafts?.[zone]?.slowest !== 'string') return null;
      const override = profile.running.paceZoneOverrides?.[zone];
      if (!override || !numeric(override.fastestSecPerKm) || !numeric(override.slowestSecPerKm)) return null;
    }
    return value;
  } catch { return null; }
}
