import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyPerformanceProfile, normalizePerformanceProfile, parsePerformanceProfileJson, serializePerformanceProfile, validatePerformanceProfile } from '../lib/performance-profile.ts';
import { calculateOlympiatoppenHeartRateZones, calculateRaceBasedRunningPaceZones, getRunningPaceZones, racePaceSecondsPerKm, zoneForRunningPace } from '../lib/profile-training-zones.ts';

test('Olympiatoppen BPM boundaries match the published max-HR calculator', () => {
  assert.deepEqual(calculateOlympiatoppenHeartRateZones(195), {
    1: { low: 107, high: 140 },
    2: { low: 141, high: 159 },
    3: { low: 160, high: 169 },
    4: { low: 170, high: 179 },
    5: { low: 180, high: 195 },
  });
  assert.equal(calculateOlympiatoppenHeartRateZones(null), null);
});

test('race result produces editable pace bands in seconds per kilometre', () => {
  assert.deepEqual(calculateRaceBasedRunningPaceZones(300), {
    1: { fastestSecPerKm: 400, slowestSecPerKm: 462 },
    2: { fastestSecPerKm: 353, slowestSecPerKm: 400 },
    3: { fastestSecPerKm: 323, slowestSecPerKm: 353 },
    4: { fastestSecPerKm: 291, slowestSecPerKm: 323 },
    5: { fastestSecPerKm: 261, slowestSecPerKm: 291 },
  });
  const profile = normalizePerformanceProfile({ running: { raceDistanceMeters: 5000, raceTimeSec: 1500 } });
  assert.equal(racePaceSecondsPerKm(profile), 300);
  assert.deepEqual(getRunningPaceZones(profile)[1], { fastestSecPerKm: 400, slowestSecPerKm: 462 });
  assert.equal(zoneForRunningPace(429, profile), 1);
  assert.equal(zoneForRunningPace(300, profile), 4);
});

test('profile version 1 data remains readable and version 2 zones round-trip through JSON', () => {
  const legacy = normalizePerformanceProfile({ version: 1, cycling: { ftpWatts: 250 }, running: { thresholdPaceSecPerKm: 300 } });
  assert.equal(legacy.version, 2);
  assert.equal(legacy.heartRateMaxBpm, null);
  assert.equal(legacy.running.thresholdPaceSecPerKm, 300);
  assert.equal(legacy.running.raceDistanceMeters, null);

  const profile = normalizePerformanceProfile({
    heartRateMaxBpm: 195,
    running: {
      raceDistanceMeters: 5000,
      raceTimeSec: 1500,
      paceZoneOverrides: { 1: { fastestSecPerKm: 410, slowestSecPerKm: 470 } },
    },
  });
  const saved = serializePerformanceProfile(profile);
  assert.deepEqual(parsePerformanceProfileJson(saved), profile);
  assert.equal(validatePerformanceProfile(profile), null);
});

test('pace validation rejects partial race results and overlapping manual zones', () => {
  assert.match(validatePerformanceProfile({ ...createEmptyPerformanceProfile(), running: { ...createEmptyPerformanceProfile().running, raceDistanceMeters: 5000 } }) ?? '', /both a race distance and finish time/);
  const base = normalizePerformanceProfile({ running: { raceDistanceMeters: 5000, raceTimeSec: 1500 } });
  const invalid = {
    ...base,
    running: {
      ...base.running,
      paceZoneOverrides: {
        ...base.running.paceZoneOverrides,
        1: { fastestSecPerKm: 380, slowestSecPerKm: 440 },
      },
    },
  };
  assert.match(validatePerformanceProfile(invalid) ?? '', /Zone 1 must stay slower than Zone 2/);
});
