import assert from 'node:assert/strict';
import test from 'node:test';

import { workoutCanvasDropIndex } from '../lib/workout-canvas-drop.ts';

test('pointer chooses the nearest insertion gap across duration-sized bars', () => {
  const durations = [600, 1200, 600];
  assert.equal(workoutCanvasDropIndex(104, 100, 400, durations), 0);
  assert.equal(workoutCanvasDropIndex(190, 100, 400, durations), 1);
  assert.equal(workoutCanvasDropIndex(360, 100, 400, durations), 2);
  assert.equal(workoutCanvasDropIndex(490, 100, 400, durations), 3);
});

test('empty workouts accept the first block and invalid widths do not guess', () => {
  assert.equal(workoutCanvasDropIndex(150, 100, 0, []), 0);
  assert.equal(workoutCanvasDropIndex(150, 100, 0, [600]), null);
});
