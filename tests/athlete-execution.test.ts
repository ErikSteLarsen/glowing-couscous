import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceExecution,
  advanceTimedExecution,
  blockExecutionDurationSec,
  completeCurrentExecution,
  createExecutionState,
  createExecutionSteps,
  executionElapsedSeconds,
  getExecutionTimerRemainingMs,
  idleExecutionTimer,
  isExecutionComplete,
  parseExecutionProgress,
  parseExecutionTimer,
  pauseExecutionTimer,
  previousExecution,
  remainingExecutionSeconds,
  resolveExecutionTimer,
  restartExecution,
  serializeExecutionProgress,
  settleExecution,
  skipCurrentExecution,
  startExecutionBlock,
  startExecutionTimer,
} from '../lib/athlete-execution.ts';
import { createSessionEditorBlock, createEmptySessionEditorDraft, deriveSessionEditorMetrics } from '../lib/session-editor.ts';
import { createEmptyPerformanceProfile } from '../lib/performance-profile.ts';

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

test('saved live progress resumes only for the same ordered workout steps', () => {
  const blocks = [
    createSessionEditorBlock({ clientId: 'warmup', kind: 'warmup', zone: 1, durationSec: 600 }),
    createSessionEditorBlock({ clientId: 'work', kind: 'work', zone: 4, durationSec: 300, reps: 2 }),
  ];
  const steps = createExecutionSteps(blocks, 'BIKING');
  const halfway = advanceExecution(createExecutionState(steps.length));
  const saved = serializeExecutionProgress(steps, halfway);

  assert.deepEqual(parseExecutionProgress(saved, steps), halfway, 'returning to the workout resumes completed markers and current step');
  assert.equal(parseExecutionProgress(saved, createExecutionSteps(blocks.slice(0, 1), 'BIKING')), null, 'removed or reordered executable steps invalidate old progress');
  assert.equal(parseExecutionProgress(saved, createExecutionSteps([...blocks].reverse(), 'BIKING')), null, 'reordered executable steps invalidate old progress');
  const changedWorkout = createExecutionSteps(blocks.map((block) => block.clientId === 'warmup' ? { ...block, durationSec: 660 } : block), 'BIKING');
  assert.equal(parseExecutionProgress(saved, changedWorkout), null, 'changed prescriptions invalidate old progress');
  assert.equal(parseExecutionProgress('{not json', steps), null, 'corrupt browser data starts a fresh stepper');
  assert.equal(parseExecutionProgress(JSON.stringify({ version: 1, steps: 'current', state: { currentIndex: 99, completed: [false, false, false] } }), steps), null, 'out-of-range browser state is rejected');
  assert.deepEqual(restartExecution(halfway), createExecutionState(steps.length), 'explicit restart clears all guidance progress');
});

test('timed steps use timestamps for start, pause, resume, and expiration', () => {
  const steps = [
    { id: 'interval:0', label: 'Work', durationSec: 5, targetLabel: null, prescribedTarget: null, note: '' },
    { id: 'interval:1', label: 'Work', durationSec: 5, targetLabel: null, prescribedTarget: null, note: '' },
  ];
  const state = createExecutionState(steps.length);
  const started = startExecutionTimer(idleExecutionTimer, steps[0].durationSec, 10_000);
  assert.equal(getExecutionTimerRemainingMs(started, 5, 12_000), 3_000);

  const paused = pauseExecutionTimer(started, 12_000);
  assert.deepEqual(paused, { kind: 'paused', remainingMs: 3_000, durationSec: 5 });
  assert.equal(getExecutionTimerRemainingMs(paused, 5, 50_000), 3_000, 'a paused timer does not lose time while away');
  const resumed = startExecutionTimer(paused, 5, 50_000);
  assert.equal(getExecutionTimerRemainingMs(resumed, 5, 52_999), 1);
  assert.deepEqual(resolveExecutionTimer(resumed, 53_000), { kind: 'elapsed', durationSec: 5 });
  assert.deepEqual(state.completed, [false, false], 'timer expiry alone does not mark work complete');
  assert.deepEqual(pauseExecutionTimer(resumed, 53_000), { kind: 'elapsed', durationSec: 5 }, 'pausing at the deadline resolves to elapsed');
  assert.deepEqual(startExecutionTimer(idleExecutionTimer, 0, 10_000), idleExecutionTimer, 'untimed steps cannot start a countdown');

  const persisted = serializeExecutionProgress(steps, state, resumed);
  const restored = parseExecutionTimer(persisted, steps, state);
  assert.deepEqual(restored, resumed, 'reload resumes from the stored deadline instead of an accumulated tick count');
  assert.deepEqual(resolveExecutionTimer(restored, 53_000), { kind: 'elapsed', durationSec: 5 }, 'time away still counts for an active countdown');
  const afterManualAdvance = advanceExecution(state);
  assert.deepEqual(parseExecutionTimer(serializeExecutionProgress(steps, afterManualAdvance), steps, afterManualAdvance), idleExecutionTimer, 'manual step changes reset the timer');
  assert.deepEqual(parseExecutionTimer(persisted, steps, { ...state, completed: [true, false] }), idleExecutionTimer, 'completed steps do not restore an active timer');
});


test('live steps follow repeated, non-skipped workout content with unique ordered identities', () => {
  const blocks = [
    createSessionEditorBlock({ clientId: 'warmup', kind: 'warmup', zone: 1, durationSec: 600 }),
    createSessionEditorBlock({ clientId: 'interval', kind: 'work', zone: 4, durationSec: 300, reps: 4, note: 'Hold steady' }),
    createSessionEditorBlock({ clientId: 'omitted', kind: 'recovery', zone: 1, durationSec: 90, reps: 2, skipped: true }),
    createSessionEditorBlock({ clientId: 'cooldown', kind: 'cooldown', zone: 1, durationSec: 300 }),
  ];
  const steps = createExecutionSteps(blocks, 'BIKING');
  assert.deepEqual(steps.map((step) => step.id), ['warmup:0', 'interval:0', 'interval:1', 'interval:2', 'interval:3', 'cooldown:0']);
  assert.match(steps[1].label, /Rep 1 of 4/);
  assert.match(steps[4].label, /Rep 4 of 4/);
  assert.equal(steps[3].note, 'Hold steady');
  assert.equal(steps.reduce((sum, step) => sum + step.durationSec, 0), 2100);
  assert.equal(steps.reduce((sum, step) => sum + step.durationSec, 0), deriveSessionEditorMetrics({ ...createEmptySessionEditorDraft(), blocks }).durationSec);
  assert.equal(blocks[1].reps, 4, 'the prescription is unchanged');
  assert.deepEqual(createExecutionSteps(blocks.map((block) => ({ ...block, skipped: true })), 'BIKING'), []);
});

test('live targets preserve relative decimal prescriptions and optionally resolve a personal reference', () => {
  const blocks = [createSessionEditorBlock({
    clientId: 'work', durationSec: 300,
    target: { metric: 'power', mode: 'relative', reference: 'ftp', low: 90.5, high: 100 },
  })];
  assert.equal(createExecutionSteps(blocks, 'BIKING')[0].targetLabel, '90.5-100% FTP');
  const profile = createEmptyPerformanceProfile();
  profile.cycling.ftpWatts = 250;
  assert.equal(createExecutionSteps(blocks, 'BIKING', profile)[0].targetLabel, '90.5-100% FTP\u00A0– 226-250\u00A0W');
  assert.equal(blocks[0].target?.low, 90.5);
});

test('live heart-rate previews use the session sport and never borrow another threshold', () => {
  const blocks = [createSessionEditorBlock({ target: { metric: 'hr', mode: 'relative', reference: 'threshold-hr', low: 90, high: 100 } })];
  const profile = createEmptyPerformanceProfile();
  profile.cycling.thresholdHrBpm = 170;
  profile.running.thresholdHrBpm = 180;
  profile.swimming.thresholdHrBpm = 160;
  assert.equal(createExecutionSteps(blocks, 'RUNNING', profile)[0].targetLabel, '90-100% threshold HR\u00A0– 162-180\u00A0bpm');
  assert.equal(createExecutionSteps(blocks, 'BIKING', profile)[0].targetLabel, '90-100% threshold HR\u00A0– 153-170\u00A0bpm');
  assert.equal(createExecutionSteps(blocks, 'SWIMMING', profile)[0].targetLabel, '90-100% threshold HR\u00A0– 144-160\u00A0bpm');
  profile.running.thresholdHrBpm = null;
  assert.equal(createExecutionSteps(blocks, 'RUNNING', profile)[0].targetLabel, '90-100% threshold HR');
});

test('execution steps keep the bare prescription so a rider without FTP can still ride to %FTP', () => {
  const blocks = [
    createSessionEditorBlock({ clientId: 'work', durationSec: 300, target: { metric: 'power', mode: 'relative', reference: 'ftp', low: 75, high: 75 } }),
    createSessionEditorBlock({ clientId: 'easy', durationSec: 300 }),
  ];
  const [work, easy] = createExecutionSteps(blocks, 'BIKING');
  assert.equal(work.prescribedTarget, '75% FTP');
  assert.equal(easy.prescribedTarget, null);
  const profile = createEmptyPerformanceProfile();
  profile.cycling.ftpWatts = 200;
  assert.equal(createExecutionSteps(blocks, 'BIKING', profile)[0].prescribedTarget, '75% FTP');
});

const timedSteps = [
  { id: 'effort:0', label: 'Effort', durationSec: 180, targetLabel: null, prescribedTarget: null, note: '' },
  { id: 'recovery:0', label: 'Recovery', durationSec: 120, targetLabel: null, prescribedTarget: null, note: '' },
  { id: 'open:0', label: 'Drills', durationSec: 0, targetLabel: null, prescribedTarget: null, note: '' },
  { id: 'cooldown:0', label: 'Cool-down', durationSec: 60, targetLabel: null, prescribedTarget: null, note: '' },
];

test('a running block timer moves straight into the next block when time runs out', () => {
  const start = 1_000_000;
  const state = createExecutionState(timedSteps.length);
  const timer = startExecutionBlock(timedSteps[0], start);
  assert.deepEqual(settleExecution(timedSteps, state, timer, start + 179_000), { state, timer });

  const settled = settleExecution(timedSteps, state, timer, start + 181_000);
  assert.equal(settled.state.currentIndex, 1);
  assert.equal(settled.state.completed[0], true);
  // The recovery starts when the effort ended, not when the page noticed.
  assert.deepEqual(settled.timer, { kind: 'running', endsAt: start + 300_000, durationSec: 120 });
  assert.equal(executionElapsedSeconds(timedSteps, settled.state, 119), 181);
});

test('time away from the page is caught up, an untimed block waits, and the last block ends the workout', () => {
  const start = 2_000_000;
  const away = settleExecution(timedSteps, createExecutionState(timedSteps.length), startExecutionBlock(timedSteps[0], start), start + 10 * 60_000);
  assert.equal(away.state.currentIndex, 2);
  assert.deepEqual(away.timer, { kind: 'open', durationSec: 0 });
  assert.deepEqual(settleExecution(timedSteps, away.state, away.timer, start + 60 * 60_000), away);

  const last = advanceExecution(away.state);
  const finished = settleExecution(timedSteps, last, startExecutionBlock(timedSteps[3], start), start + 61_000);
  assert.equal(isExecutionComplete(finished.state), true);
  assert.deepEqual(finished.timer, idleExecutionTimer);
});

test('a paused or open block timer survives a reload', () => {
  const state = { ...createExecutionState(timedSteps.length), currentIndex: 2 };
  const open = serializeExecutionProgress(timedSteps, state, { kind: 'open', durationSec: 0 });
  assert.deepEqual(parseExecutionTimer(open, timedSteps, state), { kind: 'open', durationSec: 0 });
  const timedState = { ...state, currentIndex: 0 };
  assert.deepEqual(parseExecutionTimer(serializeExecutionProgress(timedSteps, timedState, { kind: 'open', durationSec: 0 }), timedSteps, timedState), idleExecutionTimer);
});

test('blocks show Olympiatoppen heart-rate ranges from the maximum heart rate', () => {
  const profile = { ...createEmptyPerformanceProfile(), heartRateMaxBpm: 190 };
  const zoneOnly = createSessionEditorBlock({ kind: 'work', zone: 2, durationSec: 600, target: null });
  const olt = createSessionEditorBlock({ kind: 'work', zone: 5, durationSec: 180, target: { metric: 'hr', mode: 'relative', reference: 'max-hr', low: 92, high: 100 } });
  const [easy, hard] = createExecutionSteps([zoneOnly, olt], 'RUNNING', profile);
  assert.equal(easy.targetLabel, 'I-2\u00A0– 137–155 bpm');
  assert.equal(hard.targetLabel, 'I-5\u00A0– 175-190\u00A0bpm');
  assert.equal(createExecutionSteps([zoneOnly], 'RUNNING', createEmptyPerformanceProfile())[0].targetLabel, null);
});
