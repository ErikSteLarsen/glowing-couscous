import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { derivePlannerSourceDurationSec } from '../lib/planner-source-metrics.ts';

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