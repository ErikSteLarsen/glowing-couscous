import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { derivePlannerSessionMetrics, derivePlannerSourceDurationSec } from '../lib/planner-source-metrics.ts';
import { deriveSessionMetrics } from '../lib/session-math.ts';

test('persisted planner metrics retain decimal relative targets, repetitions and pause accounting', () => {
  const blocks = [
    {
      kind: 'work', zone: 4, durationSec: 600, reps: 2,
      targetType: 'pace', targetMode: 'relative', targetReference: 'threshold-pace',
      targetLow: 100, targetHigh: 102, targetLowDecimal: '100.25', targetHighDecimal: '102.45',
    },
    { kind: 'pause', zone: 1, durationSec: 60, reps: null, targetType: null, targetLow: null, targetHigh: null },
  ];
  const metrics = derivePlannerSessionMetrics(blocks);
  assert.equal(metrics.durationSec, 1260);
  assert.equal(metrics.tss, 32);
  assert.deepEqual(metrics.zoneDistributionSec, [0, 0, 0, 1200, 0]);
  assert.equal(metrics.segments.at(-1)?.label, 'Pause');
  assert.deepEqual(metrics, deriveSessionMetrics([
    {
      kind: 'work', zone: 4, durationSec: 600, reps: 2,
      target: { metric: 'pace', mode: 'relative', reference: 'threshold-pace', low: 100.25, high: 102.45 },
    },
    { kind: 'pause', zone: 1, durationSec: 60, reps: null, target: null },
  ]));
});

test('legacy planner blocks retain fallback kind and zone without inventing an incomplete target', () => {
  const metrics = derivePlannerSessionMetrics([
    { kind: 'legacy-effort', zone: 0, durationSec: 600, reps: null, targetType: 'hr', targetLow: 140, targetHigh: null },
  ]);
  assert.equal(metrics.durationSec, 600);
  assert.equal(metrics.tss, 8);
  assert.deepEqual(metrics.zoneDistributionSec, [0, 600, 0, 0, 0]);
});

test('planner source duration expands repetitions with the canonical session math', () => {
  assert.equal(derivePlannerSourceDurationSec([{ durationSec: 300, reps: 4 }]), 1200);
  assert.equal(
    derivePlannerSourceDurationSec([
      { durationSec: 600, reps: null },
      { durationSec: 300, reps: 4 },
      { durationSec: 120, reps: 3 },
      { durationSec: 900, skipped: true },
    ]),
    2160,
  );
});

test('athlete and coach planners use canonical source duration instead of raw block sums', async () => {
  const athletePlanner = await readFile(
    path.join(process.cwd(), 'app/(app)/athlete/planner/AthletePlannerClient.tsx'),
    'utf8',
  );
  const coachPlanner = await readFile(
    path.join(process.cwd(), 'app/(app)/coach/planner/PlannerClient.tsx'),
    'utf8',
  );

  for (const planner of [athletePlanner, coachPlanner]) {
    assert.match(planner, /derivePlannerSourceDurationSec/);
    assert.doesNotMatch(planner, /blocks\.reduce/);
  }
});
