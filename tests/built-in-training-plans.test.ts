import test from 'node:test';
import assert from 'node:assert/strict';

import { catalogLineageOf } from '../lib/catalog-lineage.ts';
import { createRideHubService } from '../lib/ride-hub-service.ts';
import { createShareLinkService, hashShareToken } from '../lib/share-link-service.ts';
import { parseTemplateRoutine } from '../lib/template-routine.ts';
import { createTemplateService } from '../lib/template-service.ts';
import { createStartedWorkoutService } from '../lib/started-workout-service.ts';
import { createWorkoutCatalogService } from '../lib/workout-catalog-service.ts';
import { createWorkoutLibraryService } from '../lib/workout-library-service.ts';
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
    assert.match(sessions[4].summary ?? '', /40 × 50 m with 15 seconds rest/);
    assert.deepEqual(sessions.map(session => session.catalogWorkoutSlug), [
      'recovery-ride', 'run-intervals-75-40-20-vo2', 'swim-technique', 'bike-intervals-90-5x10-lt2', 'swim-intervals-60-40x50', 'long-ride',
    ]);
    assert.ok(sessions.every(session => session.source === 'athlete-plan-catalog' &&
      session.catalogPlanSlug === 'triathlon-build' && session.catalogPlanVersion === 1));
    const changed = await planner.saveSession(owner.id, {
      scheduledDate: week[6], title: 'Edited long ride', sport: 'BIKING',
      blocks: [{ kind: 'work', zone: 2, durationSec: 6600 }],
      catalogWorkoutSlug: 'easy-ride', catalogPlanSlug: 'triathlon-essentials', catalogPlanVersion: 8,
    }, sessions[5].id);
    assert.ok(changed.ok);
    const edited = await db.session.findUniqueOrThrow({ where: { id: sessions[5].id } });
    assert.equal(edited.title, 'Edited long ride');
    assert.equal(edited.source, sessions[5].source);
    assert.deepEqual(catalogLineageOf(edited), catalogLineageOf(sessions[5]));
    const moved = await planner.rescheduleSession(owner.id, edited.id, { date: week[0] });
    assert.ok(moved.ok);
    assert.deepEqual(catalogLineageOf(await db.session.findUniqueOrThrow({ where: { id: edited.id } })), catalogLineageOf(edited));
    assert.equal(await db.template.count(), 0);
  });
});

const simpleBlocks = [{ kind: 'work', zone: 2, durationSec: 300 }];
const savedWorkoutDraft = { title: 'My interval ride', sport: 'BIKING', blocks: simpleBlocks };

test('version 1 routines still parse saved-workout entries without catalog lineage', () => {
  const routine = {
    version: 1,
    entries: [{
      weekday: 0, workoutId: 16, title: 'Existing workout', sport: 'BIKING', summary: null, sportMetricsJson: null,
      blocks: [{ ...simpleBlocks[0], sortOrder: 0, reps: null, targetType: null, targetLow: null, targetHigh: null, note: null }],
    }],
  };
  assert.deepEqual(parseTemplateRoutine(JSON.stringify(routine)), routine);
  const dualReference = { ...routine, entries: [{ ...routine.entries[0], catalogWorkoutSlug: 'long-ride' }] };
  assert.equal(parseTemplateRoutine(JSON.stringify(dualReference)), null);
});

test('catalog starts and schedules persist workout lineage, and swims can only be scheduled', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const owner = await db.user.create({ data: { email: 'catalog-start@example.test', role: 'ATHLETE' } });
    const catalog = createWorkoutCatalogService({ db });
    const starts = createStartedWorkoutService({ db });

    assert.deepEqual(await starts.start(owner.id, { kind: 'catalog', slug: 'swim-technique' }, { date: week[0] }), {
      ok: false, status: 400, error: 'Swim workouts can’t be started yet.',
    });
    assert.equal(await db.session.count(), 0);

    const run = await starts.start(owner.id, { kind: 'catalog', slug: 'easy-run' }, { date: week[0] });
    assert.ok(run.ok);
    const scheduled = await catalog.schedule(owner.id, 'swim-technique', {
      dates: [week[0]], requestKey: 'schedule-public-swim',
    });
    assert.ok(scheduled.ok);
    assert.deepEqual(
      (await db.session.findMany({ orderBy: { id: 'asc' } })).map(({ sport, catalogWorkoutSlug }) => [sport, catalogWorkoutSlug]),
      [['RUNNING', 'easy-run'], ['SWIMMING', 'swim-technique']],
    );
    assert.deepEqual(await starts.start(owner.id, { kind: 'catalog', slug: 'easy-run' }, { date: week[0] }), {
      ok: true, sessionId: run.sessionId, planned: false,
    });

    // A renamed copy of a public workout planned for today is the one that starts.
    const planned = await catalog.schedule(owner.id, 'long-ride', { dates: [week[0]], requestKey: 'schedule-long-ride' });
    assert.ok(planned.ok);
    const [plannedId] = planned.sessionIds;
    await db.session.update({ where: { id: plannedId }, data: { title: 'Renamed ride' } });
    assert.deepEqual(await starts.start(owner.id, { kind: 'catalog', slug: 'long-ride' }, { date: week[0] }), {
      ok: true, sessionId: plannedId, planned: true,
    });

    const bike = await starts.start(owner.id, { kind: 'catalog', slug: 'easy-ride' }, { date: week[0] });
    assert.ok(bike.ok);
    for (const id of [plannedId, bike.sessionId]) {
      await db.session.update({
        where: { id },
        data: {
          status: 'completed',
          date: new Date(`${week[0]}T00:00:00.000Z`),
          activity: { create: {
            athleteId: owner.id, completedAt: new Date(week[0]), durationSec: 1800, zoneDistributionJson: '{}', segmentsJson: '[]',
          } },
        },
      });
    }
    const hub = await createRideHubService({ db }).load(owner.id);
    assert.deepEqual(new Map(hub.recent.map(ride => [ride.sessionId, ride.catalogSlug])), new Map([
      [plannedId, 'long-ride'], [bike.sessionId, 'easy-ride'],
    ]));
  });
});

test('customized workouts preserve validated lineage through edits, placement and share intake', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const owner = await db.user.create({ data: { email: 'custom-workout@example.test', role: 'ATHLETE' } });
    const recipient = await db.user.create({ data: { email: 'share-recipient@example.test', role: 'ATHLETE' } });
    const library = createWorkoutLibraryService({ db });
    const planner = createAthletePlannerService({ db });
    const shares = createShareLinkService({ db, workoutLibraryPersistence: library, athletePlannerPersistence: planner });
    const forged = { catalogWorkoutSlug: 'does-not-exist', catalogPlanSlug: 'triathlon-build', catalogPlanVersion: 99 };
    const invalid = await library.saveForOwner('athlete', owner.id, { ...savedWorkoutDraft, ...forged });
    assert.ok(invalid.ok);
    assert.deepEqual(catalogLineageOf(await db.session.findUniqueOrThrow({ where: { id: invalid.sessionId } })), {
      catalogWorkoutSlug: null, catalogPlanSlug: null, catalogPlanVersion: null,
    });
    const saved = await library.saveForOwner('athlete', owner.id, { ...savedWorkoutDraft, ...forged, catalogWorkoutSlug: 'long-ride' });
    assert.ok(saved.ok);
    assert.ok((await library.saveForOwner('athlete', owner.id, {
      ...savedWorkoutDraft, title: 'My revised ride', ...forged, catalogWorkoutSlug: 'easy-ride',
    }, saved.sessionId)).ok);
    const workout = await db.session.findUniqueOrThrow({ where: { id: saved.sessionId } });
    assert.equal(workout.title, 'My revised ride');
    assert.deepEqual(catalogLineageOf(workout), { catalogWorkoutSlug: 'long-ride', catalogPlanSlug: null, catalogPlanVersion: null });
    const placed = await planner.assignSource(owner.id, {
      sourceKind: 'workout', sourceId: saved.sessionId, dates: [week[1]], requestKey: 'custom-workout-placement', ...forged,
    });
    assert.ok(placed.ok);
    const planned = await db.session.findUniqueOrThrow({ where: { id: placed.sessionIds[0] } });
    assert.deepEqual(catalogLineageOf(planned), catalogLineageOf(workout));

    const link = await shares.createForUser(owner.id, 'session', planned.id);
    assert.ok(link.ok);
    const token = link.url.slice('/share/'.length);
    const preview = await shares.loadPreview(token);
    assert.ok(preview);
    assert.equal('catalogLineage' in preview, false);
    const shared = await shares.savePlannerCopy(recipient.id, 'ATHLETE', token, { scheduledDate: week[2], ...forged });
    assert.ok(shared.ok);
    assert.deepEqual(catalogLineageOf(await db.session.findUniqueOrThrow({ where: { id: shared.sessionIds[0] } })), catalogLineageOf(workout));

    await db.shareLink.update({ where: { tokenHash: hashShareToken(token) }, data: { snapshotJson: JSON.stringify(preview) } });
    const legacyShare = await shares.savePlannerCopy(recipient.id, 'ATHLETE', token, { scheduledDate: week[3] });
    assert.ok(legacyShare.ok);
    assert.deepEqual(catalogLineageOf(await db.session.findUniqueOrThrow({ where: { id: legacyShare.sessionIds[0] } })), catalogLineageOf(workout));
  });
});

test('personal plan copies snapshot public and saved workouts, and keep catalog lineage after edit and duplication', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const owner = await db.user.create({ data: { email: 'custom-plan@example.test', role: 'ATHLETE' } });
    const templates = createTemplateService({ db });
    const library = createWorkoutLibraryService({ db });
    const planner = createAthletePlannerService({ db });
    const plan = getBuiltInPlan('triathlon-essentials');
    assert.ok(plan);
    const defaults = selectPlanWorkouts(plan.slots, {}).map(({ weekday, option }) => ({
      weekday, catalogWorkoutSlug: option.id,
    }));

    assert.ok((await templates.saveForOwner(owner.id, {
      name: 'Unknown public workout', entries: [{ weekday: 0, catalogWorkoutSlug: 'invented-slug' }],
    })).error);
    const name = `${plan.name} (my version)`;
    const creation = await templates.saveForOwner(owner.id, {
      name, catalogPlanSlug: plan.slug, catalogPlanVersion: 99,
      entries: defaults.map(entry => ({ ...entry, title: 'Client title', blocks: simpleBlocks })),
    });
    assert.equal(creation.error, null);
    const [created] = await templates.listForOwner(owner.id);
    assert.equal(created.catalogPlanSlug, plan.slug);
    assert.equal(created.catalogPlanVersion, plan.version);
    const routine = parseTemplateRoutine(created.routineJson);
    assert.ok(routine);
    assert.deepEqual(routine.entries.map(entry => entry.catalogWorkoutSlug), defaults.map(entry => entry.catalogWorkoutSlug));
    assert.equal(routine.entries[0].title, plan.slots[0].options[0].title);
    assert.equal(routine.entries[0].blocks.reduce((sum, block) => sum + block.durationSec, 0), 75 * 60);
    assert.equal(await db.session.count(), 0);

    const saved = await library.saveForOwner('athlete', owner.id, { ...savedWorkoutDraft, catalogWorkoutSlug: 'long-ride' });
    assert.ok(saved.ok);
    assert.equal((await templates.saveForOwner(owner.id, {
      name: 'Edited copy', catalogPlanSlug: 'triathlon-build', catalogPlanVersion: 2,
      entries: [...defaults.slice(1), { weekday: 0, workoutId: saved.sessionId, sourceCatalogWorkoutSlug: 'easy-ride' }],
    }, created.id)).error, null);
    assert.equal((await templates.duplicateForOwner(owner.id, created.id)).error, null);
    const [edited, duplicate] = await templates.listForOwner(owner.id);
    assert.equal(edited.catalogPlanSlug, plan.slug);
    assert.equal(edited.catalogPlanVersion, plan.version);
    assert.equal(duplicate.catalogPlanSlug, plan.slug);
    assert.equal(duplicate.catalogPlanVersion, plan.version);
    assert.equal(duplicate.routineJson, edited.routineJson);

    const placed = await planner.assignSource(owner.id, {
      sourceKind: 'template', sourceId: duplicate.id, dates: week, requestKey: 'personal-plan-placement',
    });
    assert.ok(placed.ok);
    const sessions = await db.session.findMany({ where: { templateId: duplicate.id }, orderBy: { date: 'asc' } });
    assert.deepEqual(sessions.map(session => session.catalogWorkoutSlug), ['long-ride', ...defaults.slice(1).map(entry => entry.catalogWorkoutSlug)]);
    assert.ok(sessions.every(session => session.catalogPlanSlug === plan.slug && session.catalogPlanVersion === plan.version));

    assert.equal((await templates.saveForOwner(owner.id, {
      name: 'Unknown source plan', catalogPlanSlug: 'forged-plan', entries: defaults,
    })).error, null);
    const noSource = await db.template.findFirstOrThrow({ where: { name: 'Unknown source plan' } });
    assert.equal(noSource.catalogPlanSlug, null);
    assert.equal(noSource.catalogPlanVersion, null);
  });
});
