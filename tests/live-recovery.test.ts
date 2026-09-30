import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLiveCheckpoint, restoreLiveCheckpoint } from '../lib/live-recovery.ts';

const now = Date.parse('2026-09-30T12:00:00Z');
const checkpoint = { execution: { currentIndex: 0, completed: [false, false], skipped: [false, false] }, remainingSec: 20, wasRunning: true, checkpointAt: now - 30_000, notes: '' };

test('Live restores the stored time unless the user explicitly counts elapsed time', () => {
  const parsed = parseLiveCheckpoint(JSON.stringify(checkpoint), [60, 60], now)!;
  assert.equal(restoreLiveCheckpoint(parsed, [60, 60], false, now).remainingSec, 20);
  const elapsed = restoreLiveCheckpoint(parsed, [60, 60], true, now);
  assert.equal(elapsed.state.currentIndex, 1); assert.deepEqual(elapsed.state.completed, [true, false]); assert.equal(elapsed.remainingSec, 50);
  assert.equal(restoreLiveCheckpoint({ ...parsed, wasRunning: false }, [60, 60], true, now).remainingSec, 20);
});

test('Live rejects changed block shape, expired checkpoint and impossible progress', () => {
  assert.equal(parseLiveCheckpoint(JSON.stringify(checkpoint), [60], now), null);
  assert.equal(parseLiveCheckpoint(JSON.stringify({ ...checkpoint, checkpointAt: now - 25 * 60 * 60 * 1000 }), [60, 60], now), null);
  assert.equal(parseLiveCheckpoint(JSON.stringify({ ...checkpoint, remainingSec: 61 }), [60, 60], now), null);
  assert.equal(parseLiveCheckpoint(JSON.stringify({ ...checkpoint, execution: { ...checkpoint.execution, completed: [false, true] } }), [60, 60], now), null);
});
