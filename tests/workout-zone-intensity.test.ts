import assert from 'node:assert/strict';
import test from 'node:test';
import { adjustWorkoutTarget } from '../lib/workout-target-adjustment.ts';
import { chartHeightPercent, chartIntensityFraction, presetTarget, zoneForTarget } from '../lib/workout-zone-intensity.ts';
import { intensityColor } from '../lib/intensity-color.ts';
import { formatResolvedWorkoutTarget, formatWorkoutTarget } from '../lib/workout-target-resolution.ts';
import { createEmptyPerformanceProfile, type PerformanceProfile } from '../lib/performance-profile.ts';

const emptyProfile = createEmptyPerformanceProfile();
const profile: PerformanceProfile = {
  ...emptyProfile,
  heartRateMaxBpm: 195,
  cycling: { ftpWatts: 250, thresholdHrBpm: 170 },
  running: { ...emptyProfile.running, thresholdPaceSecPerKm: 300, thresholdHrBpm: 175 },
  swimming: { cssSecPer100m: 100, thresholdHrBpm: 165 },
};

test('sport presets start inside their zone with usable values', () => {
  const bike = presetTarget('BIKING', 2, profile);
  const run = presetTarget('RUNNING', 3, profile);
  const swim = presetTarget('SWIMMING', 4, null);
  assert.equal(bike.metric, 'power');
  assert.equal(bike.mode, 'absolute');
  assert.equal(zoneForTarget(bike, 'BIKING', profile), 2);
  assert.equal(run.metric, 'pace');
  assert.equal(zoneForTarget(run, 'RUNNING', profile), 3);
  assert.equal(swim.mode, 'relative');
  assert.equal(zoneForTarget(swim, 'SWIMMING', null), 4);
  assert.equal(formatWorkoutTarget(presetTarget('RUNNING', 2, null)), '70% threshold speed');
});

test('adjustments change zones and chart height within a zone', () => {
  const start = presetTarget('RUNNING', 2, null);
  const higher = adjustWorkoutTarget(start, 1)!;
  assert.equal(zoneForTarget(start, 'RUNNING', null), 2);
  assert.equal(chartHeightPercent(higher, 2, 'RUNNING', null) > chartHeightPercent(start, 2, 'RUNNING', null), true);
  assert.equal(chartIntensityFraction(higher, 2, 'RUNNING', null) > chartIntensityFraction(start, 2, 'RUNNING', null), true);
  assert.notEqual(intensityColor(2, chartIntensityFraction(higher, 2, 'RUNNING', null)), intensityColor(2, chartIntensityFraction(start, 2, 'RUNNING', null)));
  let crossing = start;
  for (let index = 0; index < 12; index += 1) crossing = adjustWorkoutTarget(crossing, 1)!;
  assert.equal(zoneForTarget(crossing, 'RUNNING', null), 3);
  assert.equal(chartHeightPercent(null, 1, 'RUNNING', null, true) > 0, true);
});

test('the intensity ramp joins adjacent zones and keeps their named midpoints', () => {
  for (const zone of [1, 2, 3, 4, 5]) {
    assert.equal(intensityColor(zone, 0.5), `var(--color-zone-${zone})`);
    if (zone < 5) assert.equal(intensityColor(zone, 1), intensityColor(zone + 1, 0));
  }
  assert.notEqual(intensityColor(3, 0.25), intensityColor(3, 0.75));
});

test('heart-rate presets use Olympiatoppen HRmax zones and preserve explicit threshold targets', () => {
  const running = presetTarget('RUNNING', 2, profile, 'hr');
  const cycling = presetTarget('BIKING', 2, profile, 'hr');
  assert.deepEqual(running, { metric: 'hr', mode: 'absolute', reference: null, low: 141, high: 159 });
  assert.deepEqual(cycling, running);
  assert.equal(zoneForTarget(running, 'RUNNING', profile), 2);
  const threshold = presetTarget('RUNNING', 2, profile, 'hr', 'relative', 'threshold-hr');
  const maxHr = presetTarget('RUNNING', 2, profile, 'hr', 'relative', 'max-hr');
  assert.notEqual(formatResolvedWorkoutTarget(threshold, profile, 'RUNNING'), formatResolvedWorkoutTarget(threshold, profile, 'BIKING'));
  assert.equal(formatResolvedWorkoutTarget(maxHr, profile, 'RUNNING'), '141-159 bpm');
});
