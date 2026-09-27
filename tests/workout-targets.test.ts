import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyPerformanceProfile, normalizePerformanceProfile } from '../lib/performance-profile.ts';
import { expandRepeatedBlocks } from '../lib/workout-blocks.ts';
import { formatResolvedWorkoutTarget, formatWorkoutTarget, missingProfileAction, resolveWorkoutTarget } from '../lib/workout-target-resolution.ts';
import { getAvailableWorkoutTargets, normalizeWorkoutTarget, validateWorkoutTarget, type WorkoutTarget } from '../lib/workout-targets.ts';
import { presetTarget, reanchorProfilePaceTarget, zoneForTarget } from '../lib/workout-zone-intensity.ts';
import { adjustWorkoutTarget } from '../lib/workout-target-adjustment.ts';
import { deriveSessionMetrics } from '../lib/session-math.ts';
import { createSharedWorkoutProjection } from '../lib/share-link.ts';

test('target normalization preserves legacy absolute targets and validates decimal relative prescriptions', () => {
  assert.deepEqual(normalizeWorkoutTarget({ type: 'power', low: 250, high: 270 }), { metric: 'power', mode: 'absolute', reference: null, low: 250, high: 270 });
  const relative = normalizeWorkoutTarget({ metric: 'power', mode: 'relative', reference: 'ftp', low: '88.5', high: '92.25' });
  assert.deepEqual(relative, { metric: 'power', mode: 'relative', reference: 'ftp', low: 88.5, high: 92.25 });
  assert.equal(normalizeWorkoutTarget({ metric: 'power', mode: 'relative', reference: 'ftp', low: '1e2', high: 102 }), null);
  assert.equal(validateWorkoutTarget({ metric: 'rpe', mode: 'relative', reference: 'ftp', low: 7, high: 8 }), 'RPE targets are direct and cannot use a reference.');
});

test('sport target catalog exposes only sport-valid relative references', () => {
  assert.ok(getAvailableWorkoutTargets('BIKING').some((target) => target.reference === 'ftp'));
  assert.ok(getAvailableWorkoutTargets('RUNNING').some((target) => target.reference === 'threshold-pace'));
  assert.ok(getAvailableWorkoutTargets('SWIMMING').some((target) => target.reference === 'css'));
  assert.ok(getAvailableWorkoutTargets('RUNNING').some((target) => target.reference === 'threshold-hr'));
  assert.ok(getAvailableWorkoutTargets('RUNNING').some((target) => target.reference === 'profile-pace'));
  assert.ok(getAvailableWorkoutTargets('RUNNING').some((target) => target.reference === 'max-hr'));
  assert.equal(getAvailableWorkoutTargets('STRENGTH').some((target) => target.mode === 'relative'), false);
});

test('current profile resolves FTP, pace, CSS, HR, and profile-independent RPE without mutating prescriptions', () => {
  const profile = normalizePerformanceProfile({ cycling: { ftpWatts: 280, thresholdHrBpm: 170 }, running: { thresholdPaceSecPerKm: 300, thresholdHrBpm: 168 }, swimming: { cssSecPer100m: 100, thresholdHrBpm: 160 } });
  const ftp = { metric: 'power' as const, mode: 'relative' as const, reference: 'ftp' as const, low: 88, high: 92 };
  const pace = { metric: 'pace' as const, mode: 'relative' as const, reference: 'threshold-pace' as const, low: 102, high: 106 };
  const css = { metric: 'pace' as const, mode: 'relative' as const, reference: 'css' as const, low: 95, high: 100 };
  const hr = { metric: 'hr' as const, mode: 'relative' as const, reference: 'threshold-hr' as const, low: 86, high: 90 };
  assert.equal(formatWorkoutTarget(ftp), '88-92% FTP');
  assert.equal(formatResolvedWorkoutTarget(ftp, profile), '246-258 W');
  assert.equal(formatResolvedWorkoutTarget(pace, profile), '4:43-4:54 /km');
  assert.equal(formatResolvedWorkoutTarget(css, profile), '1:40-1:45 /100 m');
  assert.equal(formatResolvedWorkoutTarget(hr, profile), '146-153 bpm');
  assert.equal(resolveWorkoutTarget({ metric: 'rpe', mode: 'absolute', reference: null, low: 7, high: 8 }, profile), null);
  assert.equal(formatWorkoutTarget({ metric: 'rpe', mode: 'absolute', reference: null, low: 7, high: 8 }), 'RPE 7-8');
  assert.deepEqual(ftp, { metric: 'power', mode: 'relative', reference: 'ftp', low: 88, high: 92 });
});

test('missing values never resolve to zero and live profile updates refresh the same generic target', () => {
  const target = { metric: 'power' as const, mode: 'relative' as const, reference: 'ftp' as const, low: 88, high: 92 };
  assert.equal(resolveWorkoutTarget(target, createEmptyPerformanceProfile()), null);
  assert.equal(missingProfileAction(target), 'Add FTP to preview watts.');
  assert.equal(formatResolvedWorkoutTarget(target, normalizePerformanceProfile({ cycling: { ftpWatts: 300 } })), '264-276 W');
});

test('new running and heart-rate presets resolve from private profile values', () => {
  const profile = normalizePerformanceProfile({
    heartRateMaxBpm: 195,
    running: { raceDistanceMeters: 5000, raceTimeSec: 1500 },
  });
  const pace = presetTarget('RUNNING', 1, profile);
  const heartRate = presetTarget('RUNNING', 2, profile, 'hr', 'relative', 'max-hr');
  assert.deepEqual(pace, { metric: 'pace', mode: 'relative', reference: 'profile-pace-zone-1', low: 50, high: 50 });
  assert.equal(formatResolvedWorkoutTarget(pace, profile, 'RUNNING'), '7:11 /km');
  const secondProfile = normalizePerformanceProfile({
    running: {
      raceDistanceMeters: 5000,
      raceTimeSec: 1500,
      paceZoneOverrides: { 1: { fastestSecPerKm: 430, slowestSecPerKm: 490 } },
    },
  });
  assert.equal(formatResolvedWorkoutTarget(pace, secondProfile, 'RUNNING'), '7:40 /km');
  let increased: WorkoutTarget = pace;
  for (let index = 0; index < 51; index += 1) increased = adjustWorkoutTarget(increased, 1)!;
  assert.equal(zoneForTarget(increased, 'RUNNING', profile), 2);
  const reanchored = reanchorProfilePaceTarget(increased, profile, 2);
  assert.equal(reanchored.reference, 'profile-pace-zone-2');
  assert.equal(formatResolvedWorkoutTarget(reanchored, profile, 'RUNNING'), formatResolvedWorkoutTarget(increased, profile, 'RUNNING'));
  assert.deepEqual(heartRate, { metric: 'hr', mode: 'relative', reference: 'max-hr', low: 72, high: 82 });
  assert.equal(formatResolvedWorkoutTarget(heartRate, profile, 'RUNNING'), '141-159 bpm');
});

test('repetition expansion drives duration, zones, TSS, and timeline segments', () => {
  const blocks = [{ kind: 'work' as const, zone: 4 as const, durationSec: 120, reps: 3 }];
  assert.equal(expandRepeatedBlocks(blocks).length, 3);
  const metrics = deriveSessionMetrics(blocks);
  assert.equal(metrics.durationSec, 360);
  assert.deepEqual(metrics.zoneDistributionSec, [0, 0, 0, 360, 0]);
  assert.equal(metrics.segments.length, 3);
  assert.equal(metrics.tss, 10);
});

test('sanitized shares preserve generic relative targets and never carry profile values', () => {
  const projection = createSharedWorkoutProjection({
    sourceKind: 'template', sport: 'BIKING', title: 'FTP set', blocks: [{ kind: 'work', zone: 4, durationSec: 600, targetType: 'power', targetMode: 'relative', targetReference: 'ftp', targetLow: 88, targetHigh: 92, targetLowDecimal: '88', targetHighDecimal: '92', sortOrder: 0 }],
  });
  assert.deepEqual(projection.blocks[0].target, { metric: 'power', mode: 'relative', reference: 'ftp', low: 88, high: 92 });
  assert.equal(JSON.stringify(projection).includes('ftpWatts'), false);
  assert.equal(JSON.stringify(projection).includes('280'), false);
  const personalZones = createSharedWorkoutProjection({
    sourceKind: 'session',
    sport: 'RUNNING',
    title: 'Profile zones',
    blocks: [
      { kind: 'work', zone: 1, durationSec: 600, targetType: 'pace', targetMode: 'relative', targetReference: 'profile-pace-zone-1', targetLow: 50, targetHigh: 50, targetLowDecimal: '50', targetHighDecimal: '50', sortOrder: 0 },
      { kind: 'work', zone: 2, durationSec: 600, targetType: 'hr', targetMode: 'relative', targetReference: 'max-hr', targetLow: 72, targetHigh: 82, targetLowDecimal: '72', targetHighDecimal: '82', sortOrder: 1 },
    ],
  });
  assert.equal(personalZones.blocks[0].target?.reference, 'profile-pace-zone-1');
  assert.equal(personalZones.blocks[1].target?.reference, 'max-hr');
  assert.equal(JSON.stringify(personalZones).includes('raceTimeSec'), false);
  assert.equal(JSON.stringify(personalZones).includes('heartRateMaxBpm'), false);
});
