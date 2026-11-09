import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyPerformanceProfile, normalizePerformanceProfile } from '../lib/performance-profile.ts';
import { expandRepeatedBlocks } from '../lib/workout-blocks.ts';
import { formatResolvedWorkoutTarget, formatWorkoutTarget, missingProfileAction, resolveWorkoutTarget } from '../lib/workout-target-resolution.ts';
import { getAvailableWorkoutTargets, normalizeWorkoutTarget, validateWorkoutTarget } from '../lib/workout-targets.ts';
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
  assert.equal(getAvailableWorkoutTargets('STRENGTH').some((target) => target.mode === 'relative'), false);
});

test('current profile resolves FTP, pace, CSS, HR, and profile-independent RPE without mutating prescriptions', () => {
  const profile = normalizePerformanceProfile({ cycling: { ftpWatts: 280, thresholdHrBpm: 170 }, running: { thresholdPaceSecPerKm: 300, thresholdHrBpm: 168 }, swimming: { cssSecPer100m: 100, thresholdHrBpm: 160 } });
  const ftp = { metric: 'power' as const, mode: 'relative' as const, reference: 'ftp' as const, low: 88, high: 92 };
  const pace = { metric: 'pace' as const, mode: 'relative' as const, reference: 'threshold-pace' as const, low: 102, high: 106 };
  const css = { metric: 'pace' as const, mode: 'relative' as const, reference: 'css' as const, low: 95, high: 100 };
  const hr = { metric: 'hr' as const, mode: 'relative' as const, reference: 'threshold-hr' as const, low: 86, high: 90 };
  assert.equal(formatWorkoutTarget(ftp), '88-92% FTP');
  assert.equal(formatResolvedWorkoutTarget(ftp, profile, 'BIKING'), '246-258 W');
  assert.equal(formatResolvedWorkoutTarget(pace, profile, 'RUNNING'), '4:43-4:54 /km');
  assert.equal(formatResolvedWorkoutTarget(css, profile, 'SWIMMING'), '1:40-1:45 /100 m');
  assert.equal(formatResolvedWorkoutTarget(hr, profile, 'BIKING'), '146-153 bpm');
  assert.equal(resolveWorkoutTarget({ metric: 'rpe', mode: 'absolute', reference: null, low: 7, high: 8 }, profile, 'RUNNING'), null);
  assert.equal(formatWorkoutTarget({ metric: 'rpe', mode: 'absolute', reference: null, low: 7, high: 8 }), 'RPE 7-8');
  assert.deepEqual(ftp, { metric: 'power', mode: 'relative', reference: 'ftp', low: 88, high: 92 });
});

test('missing values never resolve to zero and live profile updates refresh the same generic target', () => {
  const target = { metric: 'power' as const, mode: 'relative' as const, reference: 'ftp' as const, low: 88, high: 92 };
  assert.equal(resolveWorkoutTarget(target, createEmptyPerformanceProfile(), 'BIKING'), null);
  assert.equal(missingProfileAction(target), 'Add FTP to preview watts.');
  assert.equal(formatResolvedWorkoutTarget(target, normalizePerformanceProfile({ cycling: { ftpWatts: 300 } }), 'BIKING'), '264-276 W');
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
});
