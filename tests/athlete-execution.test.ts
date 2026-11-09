import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceExecution,
  completeCurrentExecution,
  createExecutionState,
  createExecutionSteps,
  isExecutionComplete,
  previousExecution,
  restartExecution,
} from '../lib/athlete-execution.ts';
import { createSessionEditorBlock, createEmptySessionEditorDraft, deriveSessionEditorMetrics } from '../lib/session-editor.ts';
import { createEmptyPerformanceProfile } from '../lib/performance-profile.ts';

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


test('live steps follow repeated, non-skipped workout content with unique ordered identities', () => {
  const blocks = [
    createSessionEditorBlock({ clientId: 'warmup', kind: 'warmup', zone: 1, durationSec: 600 }),
    createSessionEditorBlock({ clientId: 'interval', kind: 'work', zone: 4, durationSec: 300, reps: 4, note: 'Hold steady' }),
    createSessionEditorBlock({ clientId: 'omitted', kind: 'recovery', zone: 1, durationSec: 90, reps: 2, skipped: true }),
    createSessionEditorBlock({ clientId: 'cooldown', kind: 'cooldown', zone: 1, durationSec: 300 }),
  ];
  const steps = createExecutionSteps(blocks);
  assert.deepEqual(steps.map((step) => step.id), ['warmup:0', 'interval:0', 'interval:1', 'interval:2', 'interval:3', 'cooldown:0']);
  assert.match(steps[1].label, /Rep 1 of 4/);
  assert.match(steps[4].label, /Rep 4 of 4/);
  assert.equal(steps[3].note, 'Hold steady');
  assert.equal(steps.reduce((sum, step) => sum + step.durationSec, 0), 2100);
  assert.equal(steps.reduce((sum, step) => sum + step.durationSec, 0), deriveSessionEditorMetrics({ ...createEmptySessionEditorDraft(), blocks }).durationSec);
  assert.equal(blocks[1].reps, 4, 'the prescription is unchanged');
  assert.deepEqual(createExecutionSteps(blocks.map((block) => ({ ...block, skipped: true }))), []);
});

test('live targets preserve relative decimal prescriptions and optionally resolve a personal reference', () => {
  const blocks = [createSessionEditorBlock({
    clientId: 'work', durationSec: 300,
    target: { metric: 'power', mode: 'relative', reference: 'ftp', low: 90.5, high: 100 },
  })];
  assert.equal(createExecutionSteps(blocks)[0].targetLabel, '90.5-100% FTP');
  const profile = createEmptyPerformanceProfile();
  profile.cycling.ftpWatts = 250;
  assert.equal(createExecutionSteps(blocks, profile)[0].targetLabel, '90.5-100% FTP · 226-250 W');
  assert.equal(blocks[0].target?.low, 90.5);
});
