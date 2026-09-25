import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceExecution,
  advanceTimedExecution,
  blockExecutionDurationSec,
  completeCurrentExecution,
  createExecutionState,
  isExecutionComplete,
  previousExecution,
  remainingExecutionSeconds,
  restartExecution,
  skipCurrentExecution,
} from '../lib/athlete-execution.ts';

test('execution starts at the first block with no completed blocks', () => {
  assert.deepEqual(createExecutionState(3), { currentIndex: 0, completed: [false, false, false], skipped: [false, false, false] });
  assert.deepEqual(createExecutionState(0), { currentIndex: 0, completed: [], skipped: [] });
});

test('advance completes one block and stops at the final boundary', () => {
  const first = advanceExecution(createExecutionState(2));
  assert.deepEqual(first, { currentIndex: 1, completed: [true, false], skipped: [false, false] });
  assert.deepEqual(advanceExecution(first), { currentIndex: 1, completed: [true, true], skipped: [false, false] });
  assert.equal(isExecutionComplete(advanceExecution(first)), true);
});

test('previous rewinds the previous block and clears progress after it', () => {
  const state = advanceExecution(createExecutionState(3));
  assert.deepEqual(previousExecution(state), { currentIndex: 0, completed: [false, false, false], skipped: [false, false, false] });
  assert.deepEqual(previousExecution(previousExecution(state)), { currentIndex: 0, completed: [false, false, false], skipped: [false, false, false] });
});

test('complete current and restart transitions are immutable', () => {
  const state = createExecutionState(2);
  const completed = completeCurrentExecution(state);
  assert.deepEqual(state, { currentIndex: 0, completed: [false, false], skipped: [false, false] });
  assert.deepEqual(completed, { currentIndex: 0, completed: [true, false], skipped: [false, false] });
  assert.deepEqual(restartExecution(advanceExecution(completed)), { currentIndex: 0, completed: [false, false], skipped: [false, false] });
});

test('skip advances without counting a block as completed', () => {
  const skipped = skipCurrentExecution(createExecutionState(2));

  assert.deepEqual(skipped, { currentIndex: 1, completed: [false, false], skipped: [true, false] });
  assert.equal(isExecutionComplete(skipped), false);
  assert.equal(isExecutionComplete(skipCurrentExecution(skipped)), true);
});

test('live durations include repeats and remaining time excludes handled blocks', () => {
  assert.equal(blockExecutionDurationSec({ durationSec: 45, reps: 4 }), 180);
  assert.equal(blockExecutionDurationSec({ durationSec: 45, reps: null }), 45);

  const state = advanceExecution(createExecutionState(3));
  assert.equal(remainingExecutionSeconds(state, 20, [60, 90, 120]), 140);
  assert.equal(remainingExecutionSeconds(skipCurrentExecution(state), 120, [60, 90, 120]), 120);
});

test('timer catches up through elapsed blocks after the page was backgrounded', () => {
  const result = advanceTimedExecution(createExecutionState(3), 75, [60, 90, 120]);

  assert.deepEqual(result, {
    state: { currentIndex: 1, completed: [true, false, false], skipped: [false, false, false] },
    remainingSec: 15,
  });
  assert.deepEqual(advanceTimedExecution(createExecutionState(1), 90, [60]), {
    state: { currentIndex: 0, completed: [true], skipped: [false] },
    remainingSec: 0,
  });
});
