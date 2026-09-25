import assert from 'node:assert/strict';
import test from 'node:test';
import { adjustWorkoutTarget } from '../lib/workout-target-adjustment.ts';

test('intensity increases watts and decreases pace seconds while preserving target width', () => {
  assert.deepEqual(adjustWorkoutTarget({ metric: 'power', mode: 'absolute', reference: null, low: 180, high: 200 }, 1), { metric: 'power', mode: 'absolute', reference: null, low: 185, high: 205 });
  assert.deepEqual(adjustWorkoutTarget({ metric: 'pace', mode: 'absolute', reference: null, low: 300, high: 320 }, 1), { metric: 'pace', mode: 'absolute', reference: null, low: 295, high: 315 });
});

test('relative and heart rate steps respect lower bounds', () => {
  assert.deepEqual(adjustWorkoutTarget({ metric: 'hr', mode: 'relative', reference: 'threshold-hr', low: 80, high: 85 }, -1)?.low, 79);
  assert.equal(adjustWorkoutTarget({ metric: 'hr', mode: 'absolute', reference: null, low: 0, high: 5 }, -1), null);
  assert.equal(adjustWorkoutTarget({ metric: 'hr', mode: 'relative', reference: 'max-hr', low: 99, high: 100 }, 1), null);
});
