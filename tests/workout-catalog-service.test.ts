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

function setup(existing: { id: number } | null = null) {
  const calls: { planner: unknown[]; library: unknown[]; lookups: unknown[] } = { planner: [], library: [], lookups: [] };
  const service = createWorkoutCatalogService({
    catalog,
    planner: { saveSession: async (athleteId: number, input: unknown) => { calls.planner.push({ athleteId, input }); return { ok: true as const, sessionIds: [41, 42] }; } } as never,
    library: { saveForOwner: async (owner: string, ownerId: number, input: unknown) => { calls.library.push({ owner, ownerId, input }); return { ok: true as const, sessionId: 7 }; } } as never,
    db: { session: { findFirst: async (query: unknown) => { calls.lookups.push(query); return existing; } } } as never,
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
});

test('catalog actions reject unknown workouts and invalid dates', async () => {
  const { service, calls } = setup();
  assert.equal((await service.rideNow(3, 'missing', { date: '2026-11-20' })).ok, false);
  assert.deepEqual(await service.rideNow(3, 'fixture-sweet-spot', { date: '2026-02-30' }), { ok: false, error: 'Send the local date to ride on (yyyy-MM-dd).', status: 400 });
  assert.equal((await service.schedule(3, 'fixture-sweet-spot', { dates: ['2026-11-21', 'tomorrow'] })).ok, false);
  assert.equal((await service.schedule(3, 'fixture-sweet-spot', {})).ok, false);
  assert.equal(calls.planner.length, 0);
});

test('schedule and add to workouts delegate to the existing owners', async () => {
  const { service, calls } = setup();
  const scheduled = await service.schedule(3, 'fixture-sweet-spot', { dates: ['2026-11-24', '2026-11-22', '2026-11-24'], timeLabel: ' 06:30 ' });
  assert.deepEqual(scheduled, { ok: true, sessionIds: [41, 42], dates: ['2026-11-22', '2026-11-24'] });
  const plannerInput = (calls.planner[0] as { input: { dates: string[]; timeLabel: string } }).input;
  assert.deepEqual(plannerInput.dates.sort(), ['2026-11-22', '2026-11-24']);
  assert.equal(plannerInput.timeLabel, '06:30');

  assert.deepEqual(await service.addToLibrary(3, 'fixture-sweet-spot', { requestKey: 'abcdefabcdefabcdef' }), { ok: true, sessionId: 7 });
  const libraryCall = calls.library[0] as { owner: string; ownerId: number; input: { requestKey: string; scheduledDate?: string } };
  assert.equal(libraryCall.owner, 'athlete');
  assert.equal(libraryCall.ownerId, 3);
  assert.equal(libraryCall.input.requestKey, 'abcdefabcdefabcdef');
  assert.equal(libraryCall.input.scheduledDate, undefined);
});


test('scheduled and Ride now copies carry catalog load through athlete reads', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'catalog-load@example.test', role: 'ATHLETE' } });
    const day = '2026-11-19';
    const tomorrow = '2026-11-20';
    const now = () => new Date(2026, 10, 19, 12);
    const planner = createAthletePlannerService({ db });
    const catalogService = createWorkoutCatalogService({ db, planner });
    const workout = catalogService.find('falling-ridgeline');
    assert.ok(workout);
    const expected = catalogWorkoutMetrics(workout).tss;
    const ride = await catalogService.rideNow(athlete.id, workout.slug, { date: day });
    const scheduled = await catalogService.schedule(athlete.id, workout.slug, { dates: [tomorrow] });
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
