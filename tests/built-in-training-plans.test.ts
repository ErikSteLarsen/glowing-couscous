import test from 'node:test';
import assert from 'node:assert/strict';

import { createAthletePlannerService } from '../lib/athlete-planner-service.ts';
import { getCalendarPlacementHref } from '../lib/calendar-navigation.ts';
import { builtInPlanPreviews, builtInPlans, getBuiltInPlan, plansWithWorkout } from '../lib/plan-catalog/index.ts';
import { workoutCatalog } from '../lib/workout-catalog/index.ts';
import { expandCatalogItems } from '../lib/workout-catalog/metrics.ts';
import { findCatalogWorkout } from '../lib/workout-catalog/query.ts';
import { triathlonWorkouts } from '../lib/workout-catalog/workouts/triathlon.ts';
import { selectPlanWorkouts } from '../lib/plan-catalog/selection.ts';
import { resolvePlannerSourceSelection } from '../lib/planner-source-selection.ts';
import { templateDatesForSelection } from '../lib/template-period.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

const week = templateDatesForSelection('week', '2026-11-25');

test('built-in triathlon default weeks retain the slide order and scheduled durations', () => {
  const weeks = builtInPlanPreviews.map(({ slots }) => selectPlanWorkouts(slots, {})
    .map(({ weekday, option }) => [weekday, option.sport, option.durationSec / 60]));
  assert.deepEqual(weeks, [
    [[1, 'RUNNING', 75], [3, 'BIKING', 90], [6, 'SWIMMING', 60]],
    [[1, 'RUNNING', 75], [2, 'SWIMMING', 60], [3, 'BIKING', 90], [5, 'SWIMMING', 60], [6, 'RUNNING', 75]],
    [[0, 'BIKING', 75], [1, 'RUNNING', 90], [2, 'RUNNING', 55], [2, 'SWIMMING', 60],
      [3, 'BIKING', 120], [4, 'SWIMMING', 60], [5, 'BIKING', 150], [5, 'RUNNING', 25], [6, 'SWIMMING', 90], [6, 'RUNNING', 75]],
  ]);
  for (const preview of builtInPlanPreviews) {
    assert.deepEqual(resolvePlannerSourceSelection(`built-in-plan:${preview.slug}`, {
      workoutIds: [], templateIds: [], builtInSlugs: builtInPlanPreviews.map(({ slug }) => slug),
    }), { key: `built-in-plan:${preview.slug}`, tab: 'template' });
    assert.match(getCalendarPlacementHref(`built-in-plan:${preview.slug}`), /place=template/);
    const plan = getBuiltInPlan(preview.slug);
    assert.ok(plan);
    assert.equal(new Set(plan.slots.map(({ id }) => id)).size, plan.slots.length);
    for (const { options } of plan.slots) {
      assert.equal(new Set(options.map(({ id }) => id)).size, options.length);
      for (const option of options) {
        if (!option.workout) continue;
        assert.equal(expandCatalogItems(option.workout.items).reduce((total, step) => total + step.durationSec, 0), option.durationSec);
      }
    }
  }
});

test('every scheduled plan option is the public workout with the same id', () => {
  for (const plan of builtInPlans) {
    for (const { options } of plan.slots) for (const option of options) {
      if (option.id === 'rest') continue;
      const workout = findCatalogWorkout(workoutCatalog, option.id);
      assert.ok(workout, option.id);
      assert.equal(option.workout, workout);
      assert.ok(plansWithWorkout(option.id).some(({ slug }) => slug === plan.slug));
    }
  }
  assert.deepEqual(plansWithWorkout('long-ride'), [{ slug: 'triathlon-build', name: 'Triathlon Build' }]);
  assert.deepEqual(plansWithWorkout('warm-graphite'), []);
  for (const workout of triathlonWorkouts) assert.ok(plansWithWorkout(workout.slug).length, workout.slug);
});

test('interval alternatives keep the prescribed efforts, pool distances and rests', () => {
  const steps = (slug: string) => {
    const workout = findCatalogWorkout(workoutCatalog, slug);
    assert.ok(workout, slug);
    return expandCatalogItems(workout.items);
  };
  const hardSteps = (slug: string) => steps(slug).filter((step) => step.kind === 'work').map((step) => step.durationSec);
  for (const minutes of [75, 90]) {
    assert.deepEqual(hardSteps(`run-intervals-${minutes}-5x8-lt2`), Array(5).fill(480));
    assert.deepEqual(hardSteps(`run-intervals-${minutes}-8x4-lt2`), Array(8).fill(240));
    assert.deepEqual(hardSteps(`run-intervals-${minutes}-40-20-vo2`), Array(30).fill(40));
  }
  for (const minutes of [90, 120]) {
    assert.deepEqual(hardSteps(`bike-intervals-${minutes}-5x10-lt2`), Array(5).fill(600));
    assert.deepEqual(hardSteps(`bike-intervals-${minutes}-6x10-lt2`), Array(6).fill(600));
    assert.deepEqual(hardSteps(`bike-intervals-${minutes}-8-and-4-lt2`), [...Array(4).fill(480), ...Array(4).fill(240)]);
    assert.deepEqual(hardSteps(`bike-intervals-${minutes}-45-15-vo2`), Array(36).fill(45));
  }
  for (const minutes of [60, 90]) for (const [reps, meters, rest] of [[10, 200, 35], [20, 100, 20], [40, 50, 15]]) {
    const swim = steps(`swim-intervals-${minutes}-${reps}x${meters}`);
    assert.equal(swim.reduce((sum, step) => sum + (step.distanceM ?? 0), 0), 2000);
    assert.equal(swim.filter((step) => step.distanceM).length, reps);
    assert.ok(swim.filter((step) => step.kind === 'pause').every((step) => step.durationSec === rest));
    assert.equal(swim.reduce((sum, step) => sum + step.durationSec, 0), minutes * 60);
  }
});

test('built-in placement validates the week, choices and version, then copies only selected workouts with retry safety', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const owner = await db.user.create({ data: { email: 'plan-test@example.test', role: 'ATHLETE' } });
    const planner = createAthletePlannerService({ db });
    const input = {
      sourceKind: 'built-in-plan', sourceId: 'triathlon-build', version: 1, dates: week, requestKey: 'triathlon-build-test',
      choices: {
        'monday-recovery': 'recovery-ride', 'sunday-endurance': 'long-ride',
        'run-intervals-75': 'run-intervals-75-40-20-vo2', 'swim-intervals-60': 'swim-intervals-60-40x50',
      },
    };

    for (const invalid of [
      { version: 2 }, { dates: templateDatesForSelection('month', week[0]) },
      { choices: { 'sunday-endurance': 'recovery-run' } }, { choices: { 'other-slot': 'rest' } },
    ]) {
      assert.equal((await planner.assignSource(owner.id, { ...input, ...invalid })).ok, false);
    }
    assert.equal(await db.session.count(), 0);
    assert.equal(await db.template.count(), 0);

    const first = await planner.assignSource(owner.id, input);
    assert.ok(first.ok);
    assert.deepEqual(await planner.assignSource(owner.id, input), first);
    assert.equal((await planner.assignSource(owner.id, { ...input, choices: {} })).ok, false);
    const sessions = await db.session.findMany({ include: { blocks: { orderBy: { sortOrder: 'asc' } } }, orderBy: { id: 'asc' } });
    assert.deepEqual(sessions.map(({ date, sport }) => [date?.toISOString().slice(0, 10), sport]), [
      [week[0], 'BIKING'], [week[1], 'RUNNING'], [week[2], 'SWIMMING'],
      [week[3], 'BIKING'], [week[5], 'SWIMMING'], [week[6], 'BIKING'],
    ]);
    assert.ok(sessions.every(({ athleteId, date, templateId, timeLabel }) =>
      athleteId === owner.id && date !== null && templateId === null && timeLabel === null));
    assert.equal(sessions[1].blocks.filter(({ durationSec, zone }) => durationSec === 40 && zone === 5).length, 30);
    assert.match(sessions[4].summary ?? '', /40 × 50 m with 15s rest/);
    assert.equal(sessions[5].source, 'athlete-plan-catalog:triathlon-build:v1:long-ride');
    const changed = await planner.saveSession(owner.id, {
      scheduledDate: week[6], title: 'Edited long ride', sport: 'BIKING',
      blocks: [{ kind: 'work', zone: 2, durationSec: 6600 }],
    }, sessions[5].id);
    assert.ok(changed.ok);
    const edited = await db.session.findUniqueOrThrow({ where: { id: sessions[5].id } });
    assert.equal(edited.title, 'Edited long ride');
    assert.equal(edited.source, sessions[5].source);
    assert.equal(await db.template.count(), 0);
  });
});
