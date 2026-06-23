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
