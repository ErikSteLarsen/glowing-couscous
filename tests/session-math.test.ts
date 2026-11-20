import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveSessionMetrics } from '../lib/session-math.ts';

test('deriveSessionMetrics totals duration, tss, and zone distribution from blocks', () => {
  const result = deriveSessionMetrics([
    { kind: 'warmup', zone: 1, durationSec: 600 },
    { kind: 'work', zone: 4, durationSec: 480 },
    { kind: 'recovery', zone: 2, durationSec: 120 },
    { kind: 'cooldown', zone: 1, durationSec: 300 },
  ]);

  assert.equal(result.durationSec, 1500);
  assert.equal(result.segments.length, 4);
  assert.deepEqual(result.zoneDistributionSec, [900, 120, 0, 480, 0]);
  assert.ok(result.tss > 0);
});

test('planned bike load combines power, ramps and zone fallback before rounding', () => {
  const blocks: Parameters<typeof deriveSessionMetrics>[0] = [
    { kind: 'warmup', zone: 1, durationSec: 900, target: { metric: 'power', mode: 'relative', reference: 'ftp', low: 40, high: 100 } },
    { kind: 'work', zone: 1, durationSec: 900, reps: 2, target: { metric: 'power', mode: 'absolute', reference: null, low: 200, high: 300 } },
    { kind: 'recovery', zone: 2, durationSec: 900 },
    { kind: 'pause', zone: 5, durationSec: 300, target: { metric: 'power', mode: 'relative', reference: 'ftp', low: 100, high: 100 } },
  ];

  // 13 from the ramp, 50 at the midpoint of the repeated effort, 12.25 from the recovery.
  assert.equal(deriveSessionMetrics(blocks, 'BIKING', { ftpWatts: 250 }).tss, 75);
  assert.equal(deriveSessionMetrics(blocks, 'BIKING').tss, 40);
  assert.equal(deriveSessionMetrics(blocks, 'RUNNING', { ftpWatts: 250 }).tss, 35);
  assert.equal(deriveSessionMetrics(blocks, 'BIKING', { loadBasis: 'zones' }).tss, 35);
});
