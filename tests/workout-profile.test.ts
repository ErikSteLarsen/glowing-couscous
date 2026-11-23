import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkoutProfile, describeWorkoutProfile, fitSpanLabels, type WorkoutProfileBlock } from '../lib/workout-profile.ts';
import { workoutCatalog } from '../lib/workout-catalog/index.ts';
import { catalogWorkoutToEditorBlocks } from '../lib/workout-catalog/session.ts';
import { expandCatalogItems } from '../lib/workout-catalog/metrics.ts';

const ftp = (low: number, high = low) => ({ metric: 'power' as const, mode: 'relative' as const, reference: 'ftp' as const, low, high });

function block(id: number, kind: string, minutes: number, overrides: Partial<WorkoutProfileBlock> = {}): WorkoutProfileBlock {
  return { id, kind, zone: kind === 'work' ? 4 : 1, durationSec: minutes * 60, reps: null, target: null, ...overrides };
}

test('repeated sets are unrolled in time, gap-free, and bracketed once over every repetition', () => {
  const blocks = [
    block(1, 'warmup', 10, { zone: 2, target: ftp(50, 70) }),
    block(2, 'work', 18, { target: ftp(95) }),
    block(3, 'recovery', 3, { target: ftp(55) }),
    block(4, 'work', 18, { target: ftp(95) }),
    block(5, 'recovery', 3, { target: ftp(55) }),
    block(6, 'cooldown', 10, { target: ftp(45, 65) }),
  ];
  const model = buildWorkoutProfile(blocks);

  assert.equal(model.steps.length, 6);
  assert.equal(model.totalSec, 62 * 60);
  for (let index = 1; index < model.steps.length; index += 1) {
    const previous = model.steps[index - 1];
    assert.equal(model.steps[index].startSec, previous.startSec + previous.durationSec, 'steps touch without gaps');
  }
  assert.deepEqual(model.steps.slice(1, 5).map((step) => step.repetition), [
    { index: 1, of: 2 }, { index: 1, of: 2 }, { index: 2, of: 2 }, { index: 2, of: 2 },
  ]);
  assert.equal(model.sets.length, 1);
  assert.deepEqual(model.sets[0], { startSec: 600, durationSec: 42 * 60, repeats: 2, labels: ['2 × 18m zone 4 + 3m recovery', '2 × 21m', '2×'] });
  assert.equal(model.axis, 'power');
  assert.deepEqual([model.steps[0].startPct, model.steps[0].endPct], [50, 70], 'warm-up ramps up');
  assert.ok(Math.abs(model.steps[1].startLevel - (3 + 5 / 15)) < 1e-9, '95% FTP sits a third into Z4');
  assert.deepEqual([model.steps[5].startPct, model.steps[5].endPct], [65, 45], 'cool-down ramps down');
  assert.deepEqual(model.phases.map((phase) => [phase.title, phase.detail]), [
    ['Warm-up', '10m · Z2'], ['Main set', '42m · Z4'], ['Cool-down', '10m · Z1'],
  ]);
  assert.match(describeWorkoutProfile(model), /2 × 18m zone 4 \+ 3m recovery/);
});

test('a single block with reps draws every repetition and names the set without a bare multiplier', () => {
  const model = buildWorkoutProfile([block(1, 'work', 3, { zone: 5, reps: 4 })], { sport: 'RUNNING' });
  assert.equal(model.steps.length, 4);
  assert.deepEqual(model.steps.map((step) => step.startSec), [0, 180, 360, 540]);
  assert.deepEqual(model.steps.map((step) => step.repetition?.index), [1, 2, 3, 4]);
  assert.equal(model.sets[0].labels[0], '4 × 3m zone 5');
  assert.equal(model.axis, 'zone', 'zone-only targets use zone-equivalent heights');
  assert.ok(model.steps.every((step) => step.startLevel > 4 && step.startLevel < 5), 'a zone 5 effort sits inside the Z5 band of the even zone scale');
});

test('recovery only between efforts is described as between, and skipped blocks take no time', () => {
  const model = buildWorkoutProfile([
    block(1, 'work', 5), block(2, 'pause', 1), block(3, 'work', 5), block(4, 'pause', 1), block(5, 'work', 5),
    block(6, 'cooldown', 5, { skipped: true }),
  ]);
  assert.equal(model.sets[0].labels[0], '3 × 5m zone 4, 1m pause between');
  assert.equal(model.totalSec, 17 * 60);
  assert.equal(model.skippedCount, 1);
  assert.equal(model.blocks.length, 6, 'skipped blocks stay inspectable');
});

test('separate repeated sets are numbered and adjacent single blocks with the same role merge into one phase', () => {
  const model = buildWorkoutProfile([
    block(1, 'work', 20, { zone: 2 }), block(2, 'work', 15, { zone: 2, note: 'Hold cadence' }),
    block(3, 'work', 4, { zone: 5 }), block(4, 'recovery', 2), block(5, 'work', 4, { zone: 5 }), block(6, 'recovery', 2),
    block(7, 'work', 8), block(8, 'recovery', 4), block(9, 'work', 8), block(10, 'recovery', 4),
  ]);
  assert.deepEqual(model.phases.map((phase) => phase.title), ['Endurance', 'Set 1', 'Set 2']);
  assert.equal(model.phases[0].detail, '35m · Z2');
});

test('every catalog workout unrolls to the same timeline as the ride plan', () => {
  for (const workout of workoutCatalog) {
    const model = buildWorkoutProfile(catalogWorkoutToEditorBlocks(workout).map((entry) => ({ ...entry, id: entry.clientId })));
    const flat = expandCatalogItems(workout.items);
    assert.equal(model.steps.length, flat.length, workout.slug);
    assert.deepEqual(model.steps.map((step) => [step.startSec, step.startPct, step.endPct]), flat.map((step) => [step.startSec, step.startPct, step.endPct]), workout.slug);
    assert.equal(model.axis, 'power', workout.slug);
    const repeated = workout.items.filter((item) => 'repeat' in item && item.repeat > 1).length;
    assert.ok(model.sets.length >= Math.min(1, repeated), `${workout.slug} brackets its repeats`);
  }
});

test('label fitting picks the longest option that fits and hides text in spans that are too narrow', () => {
  const spans = [
    { startSec: 0, durationSec: 600, options: [['Warm-up', '10m · Z2'], ['Warm-up']] },
    { startSec: 600, durationSec: 60, options: [['Pause', '1m'], ['Pause']] },
    { startSec: 660, durationSec: 2340, options: [['2 × 18m zone 4 + 3m recovery'], ['2 × 21m'], ['2×']] },
  ];
  // 3000 s across 1000 px: 200 px, 20 px and 780 px.
  assert.deepEqual(fitSpanLabels(spans, 3000, 1000), [0, -1, 0]);
  // At phone width (300 px): 60 px fits "Warm-up" without its detail; 234 px still fits the full set label.
  assert.deepEqual(fitSpanLabels(spans, 3000, 300), [1, -1, 0]);
  assert.deepEqual(fitSpanLabels(spans, 3000, 120), [-1, -1, 1]);
  assert.deepEqual(fitSpanLabels(spans, 3000, 40), [-1, -1, 2]);
  assert.deepEqual(fitSpanLabels(spans, 3000, 10), [-1, -1, -1]);
});
