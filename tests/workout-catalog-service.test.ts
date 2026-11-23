import test from 'node:test';
import assert from 'node:assert/strict';

import { createAthletePlannerService } from '../lib/athlete-planner-service.ts';
import { createAthleteService } from '../lib/athlete-service.ts';
import { createRideHubService } from '../lib/ride-hub-service.ts';
import { createTrainingLoadService } from '../lib/training-load-service.ts';
import { catalogWorkoutMetrics } from '../lib/workout-catalog/metrics.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';
import { createWorkoutCatalogService } from '../lib/workout-catalog-service.ts';
import type { CatalogWorkout } from '../lib/workout-catalog/types.ts';

const catalog: CatalogWorkout[] = [{
  slug: 'fixture-sweet-spot',
  name: 'Fixture sweet spot',
  sport: 'BIKING',
  category: 'sweet-spot',
  level: 'beginner',
  summary: 'Three blocks just under threshold.',
  description: 'Hold it steady.',
  tags: [],
  items: [
    { kind: 'warmup', durationSec: 600, lowPct: 50, highPct: 70 },
    { repeat: 3, steps: [{ kind: 'work', durationSec: 600, lowPct: 88, highPct: 92, cue: 'Seated' }, { kind: 'recovery', durationSec: 180, lowPct: 55, highPct: 55 }] },
  ],
}];

const REQUEST_KEY = 'catalog-schedule-key-0001';

function setup(existing: { id: number } | null = null) {
  const calls: { planner: unknown[]; lookups: unknown[]; locks: unknown[] } = { planner: [], lookups: [], locks: [] };
  const tx = {
    session: { findFirst: async (query: unknown) => { calls.lookups.push(query); return existing; } },
    placementRequest: { create: async () => ({}), update: async () => ({}) },
    $executeRaw: async (...args: unknown[]) => { calls.locks.push(args); return 1; },
  };
  const service = createWorkoutCatalogService({
    catalog,
    plannerFor: () => ({ saveSession: async (athleteId: number, input: unknown) => { calls.planner.push({ athleteId, input }); return { ok: true as const, sessionIds: [41, 42] }; } }) as never,
    db: {
      placementRequest: { findUnique: async () => null },
      $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    } as never,
  });
  return { service, calls };
}

test('ride now plans the workout on the rider-provided local day', async () => {
  const { service, calls } = setup();
  const result = await service.rideNow(3, 'fixture-sweet-spot', { date: '2026-11-20' });
  assert.deepEqual(result, { ok: true, sessionId: 41, reused: false });
  const call = calls.planner[0] as { athleteId: number; input: { scheduledDate: string; sport: string; title: string; summary: string; blocks: unknown[] } };
  assert.equal(call.athleteId, 3);
  assert.equal(call.input.scheduledDate, '2026-11-20');
  assert.equal(call.input.sport, 'BIKING');
  assert.equal(call.input.title, 'Fixture sweet spot');
  assert.equal(call.input.summary, 'Three blocks just under threshold.\n\nHold it steady.');
  assert.equal(call.input.blocks.length, 7);
});

test('ride now reuses an unridden copy from the same day', async () => {
  const { service, calls } = setup({ id: 99 });
  assert.deepEqual(await service.rideNow(3, 'fixture-sweet-spot', { date: '2026-11-20' }), { ok: true, sessionId: 99, reused: true });
  assert.equal(calls.planner.length, 0);
  const where = (calls.lookups[0] as { where: Record<string, unknown> }).where;
  assert.equal(where.athleteId, 3);
  assert.deepEqual(where.activity, { is: null });
  assert.equal(calls.locks.length, 1);
});

test('catalog actions reject unknown workouts and invalid dates', async () => {
  const { service, calls } = setup();
  assert.equal((await service.rideNow(3, 'missing', { date: '2026-11-20' })).ok, false);
  assert.deepEqual(await service.rideNow(3, 'fixture-sweet-spot', { date: '2026-02-30' }), { ok: false, error: 'Choose a date.', status: 400 });
  assert.equal((await service.schedule(3, 'fixture-sweet-spot', { dates: ['2026-11-21', 'tomorrow'] })).ok, false);
  assert.equal((await service.schedule(3, 'fixture-sweet-spot', {})).ok, false);
  assert.equal((await service.schedule(3, 'fixture-sweet-spot', { dates: ['2026-11-21'] })).ok, false, 'a request key is required');
  assert.equal(calls.planner.length, 0);
});

test('schedule delegates to the athlete planner', async () => {
  const { service, calls } = setup();
  const scheduled = await service.schedule(3, 'fixture-sweet-spot', { dates: ['2026-11-24', '2026-11-22', '2026-11-24'], timeLabel: ' 06:30 ', requestKey: REQUEST_KEY });
  assert.deepEqual(scheduled, { ok: true, sessionIds: [41, 42], dates: ['2026-11-22', '2026-11-24'] });
  const plannerInput = (calls.planner[0] as { input: { dates: string[]; timeLabel: string } }).input;
  assert.deepEqual(plannerInput.dates.sort(), ['2026-11-22', '2026-11-24']);
  assert.equal(plannerInput.timeLabel, '06:30');
});


test('scheduled and Ride now copies carry catalog load through athlete reads', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'catalog-load@example.test', role: 'ATHLETE' } });
    const day = '2026-11-19';
    const tomorrow = '2026-11-20';
    const now = () => new Date(2026, 10, 19, 12);
    const planner = createAthletePlannerService({ db });
    const catalogService = createWorkoutCatalogService({ db });
    const workout = catalogService.find('falling-ridgeline');
    assert.ok(workout);
    const expected = catalogWorkoutMetrics(workout).tss;
    const ride = await catalogService.rideNow(athlete.id, workout.slug, { date: day });
    const scheduled = await catalogService.schedule(athlete.id, workout.slug, { dates: [tomorrow], requestKey: REQUEST_KEY });
    assert.ok(ride.ok && scheduled.ok);

    const athleteService = createAthleteService({ db, now });
    const [detail, calendar, workspace, hub, home, training] = await Promise.all([
      athleteService.loadSessionDetail(athlete.id, ride.sessionId),
      athleteService.loadCalendarView(athlete.id, day),
      planner.loadWorkspace(athlete.id, day),
      createRideHubService({ db, now }).load(athlete.id),
      athleteService.loadHomeDashboard(athlete.id),
      createTrainingLoadService({ db }).loadOverview(athlete.id, { now: now() }),
    ]);

    assert.equal(detail?.session.tss, expected);
    assert.equal(detail?.session.plannedTss, expected);
    assert.equal(calendar?.days.flatMap((entry) => entry.sessions).find((session) => session.id === scheduled.sessionIds[0])?.tss, expected);
    assert.equal(workspace.days.flatMap((entry) => entry.sessions).find((session) => session.id === scheduled.sessionIds[0])?.tss, expected);
    assert.equal(hub.todaySessions.find((session) => session.id === ride.sessionId)?.tss, expected);
    assert.equal(home?.scheduledTotals.tss, expected * 2);
    assert.equal(training.series.find((point) => point.day === tomorrow)?.plannedTss, expected);
    assert.equal(training.weeks.find((week) => week.weekStart === '2026-11-16')?.planned.tss, expected * 2);
  });
});

test('concurrent Ride now requests for the same day create one session', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'catalog-race@example.test', role: 'ATHLETE' } });
    const catalogService = createWorkoutCatalogService({ db });
    const workout = catalogService.find('falling-ridgeline');
    assert.ok(workout);

    const results = await Promise.all(Array.from({ length: 4 }, () => catalogService.rideNow(athlete.id, workout.slug, { date: '2026-11-19' })));
    assert.ok(results.every((result) => result.ok));
    const ids = new Set(results.map((result) => (result.ok ? result.sessionId : 0)));
    assert.equal(ids.size, 1);
    assert.equal(results.filter((result) => result.ok && !result.reused).length, 1);
    assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 1);

    // A ridden copy is no longer reused, so the next Ride now plans a fresh one.
    const [sessionId] = ids;
    await db.session.update({ where: { id: sessionId }, data: { status: 'completed' } });
    const next = await catalogService.rideNow(athlete.id, workout.slug, { date: '2026-11-19' });
    assert.ok(next.ok && !next.reused && next.sessionId !== sessionId);
  });
});

test('Schedule retries with the same request key replay one atomic multi-date commit', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'catalog-schedule@example.test', role: 'ATHLETE' } });
    const catalogService = createWorkoutCatalogService({ db });
    const workout = catalogService.find('falling-ridgeline');
    assert.ok(workout);
    const body = { dates: ['2026-11-24', '2026-11-22'], requestKey: REQUEST_KEY };

    const concurrent = await Promise.all([catalogService.schedule(athlete.id, workout.slug, body), catalogService.schedule(athlete.id, workout.slug, body)]);
    const retry = await catalogService.schedule(athlete.id, workout.slug, body);
    assert.ok(concurrent.every((result) => result.ok) && retry.ok);
    assert.deepEqual(concurrent[0], concurrent[1]);
    assert.deepEqual(retry, concurrent[0]);
    assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 2);

    const reused = await catalogService.schedule(athlete.id, workout.slug, { ...body, dates: ['2026-11-25'] });
    assert.deepEqual(reused, { ok: false, error: 'Something went wrong. Reload the page and try again.', status: 409 });

    const fresh = await catalogService.schedule(athlete.id, workout.slug, { ...body, requestKey: 'catalog-schedule-key-0002' });
    assert.ok(fresh.ok && fresh.sessionIds.length === 2);
    assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 4);
  });
});
