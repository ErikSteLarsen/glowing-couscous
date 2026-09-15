export type PerformanceProfile = {
  version: 1;
  cycling: { ftpWatts: number | null; thresholdHrBpm: number | null };
  running: { thresholdPaceSecPerKm: number | null; thresholdHrBpm: number | null };
  swimming: { cssSecPer100m: number | null; thresholdHrBpm: number | null };
};

export function createEmptyPerformanceProfile(): PerformanceProfile {
  return {
    version: 1,
    cycling: { ftpWatts: null, thresholdHrBpm: null },
    running: { thresholdPaceSecPerKm: null, thresholdHrBpm: null },
    swimming: { cssSecPer100m: null, thresholdHrBpm: null },
  };
}

export function normalizePerformanceProfile(input: unknown): PerformanceProfile {
  const value = asRecord(input);
  const cycling = asRecord(value.cycling);
  const running = asRecord(value.running);
  const swimming = asRecord(value.swimming);
  return {
    version: 1,
    cycling: { ftpWatts: positiveNumber(cycling.ftpWatts), thresholdHrBpm: positiveNumber(cycling.thresholdHrBpm) },
    running: {
      thresholdPaceSecPerKm: positiveNumber(running.thresholdPaceSecPerKm),
      thresholdHrBpm: positiveNumber(running.thresholdHrBpm),
    },
    swimming: { cssSecPer100m: positiveNumber(swimming.cssSecPer100m), thresholdHrBpm: positiveNumber(swimming.thresholdHrBpm) },
  };
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

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? input as Record<string, unknown> : {};
}
