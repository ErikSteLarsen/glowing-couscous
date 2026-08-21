import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceExecution,
  completeCurrentExecution,
  createExecutionState,
  isExecutionComplete,
  previousExecution,
  restartExecution,
} from '../lib/athlete-execution.ts';

test('execution starts at the first block with no completed blocks', () => {
  assert.deepEqual(createExecutionState(3), { currentIndex: 0, completed: [false, false, false] });
  assert.deepEqual(createExecutionState(0), { currentIndex: 0, completed: [] });
});

test('advance completes one block and stops at the final boundary', () => {
  const first = advanceExecution(createExecutionState(2));
  assert.deepEqual(first, { currentIndex: 1, completed: [true, false] });
  assert.deepEqual(advanceExecution(first), { currentIndex: 1, completed: [true, true] });
  assert.equal(isExecutionComplete(advanceExecution(first)), true);
});

test('previous never moves before the first block and preserves completion', () => {
  const state = advanceExecution(createExecutionState(3));
  assert.deepEqual(previousExecution(state), { currentIndex: 0, completed: [true, false, false] });
  assert.deepEqual(previousExecution(previousExecution(state)), { currentIndex: 0, completed: [true, false, false] });
});

test('complete current and restart transitions are immutable', () => {
  const state = createExecutionState(2);
  const completed = completeCurrentExecution(state);
  assert.deepEqual(state, { currentIndex: 0, completed: [false, false] });
  assert.deepEqual(completed, { currentIndex: 0, completed: [true, false] });
  assert.deepEqual(restartExecution(advanceExecution(completed)), { currentIndex: 0, completed: [false, false] });
});
