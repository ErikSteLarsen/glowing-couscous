import test from 'node:test';
import assert from 'node:assert/strict';

import { createActivityImportService } from '../lib/activity-import-service.ts';
import { createAthleteCompletionService } from '../lib/athlete-completion-service.ts';
import { createAthleteService } from '../lib/athlete-service.ts';
import { createStartedWorkoutService } from '../lib/started-workout-service.ts';
import { createTrainingLoadService } from '../lib/training-load-service.ts';
import { createWorkoutCatalogService } from '../lib/workout-catalog-service.ts';
import { createWorkoutLibraryService } from '../lib/workout-library-service.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

const SLUG = 'falling-ridgeline';
const DAY = '2026-11-19';
const now = () => new Date(2026, 10, 19, 12);
const ride = (plannedSessionId: number) => ({
  title: 'Ride', sport: 'BIKING', startedAt: '2026-11-19T10:00:00.000Z', localDay: DAY, durationSec: 600,
  distanceMeters: null, elevationGainMeters: null, points: [{ elapsedSec: 0, powerWatts: 200 }], plannedSessionId,
});

test('starting an unplanned workout shows nowhere until its ride is saved, and never counts as plan', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'started@example.test', role: 'ATHLETE' } });
    const started = createStartedWorkoutService({ db, now });
    const athletes = createAthleteService({ db, now });
    const calendarIds = async () => (await athletes.loadCalendarView(athlete.id, DAY))?.days.flatMap((day) => day.sessions.map(({ id }) => id));
    const imports = createActivityImportService({ db: db as never });

    const results = await Promise.all(Array.from({ length: 4 }, () => started.start(athlete.id, { kind: 'catalog', slug: SLUG }, { date: DAY })));
    const ids = new Set(results.map((result) => (result.ok ? result.sessionId : 0)));
    assert.equal(ids.size, 1, 'concurrent starts share a session');
    const [sessionId] = ids;
    assert.deepEqual(await calendarIds(), []);
    assert.deepEqual(await createWorkoutLibraryService({ db }).listForOwner('athlete', athlete.id), []);
    assert.equal(await athletes.loadSessionDetail(athlete.id, sessionId), null);
    assert.equal((await athletes.loadSessionDetail(athlete.id, sessionId, { includeUnsaved: true }))?.session.unsaved, true);
    assert.deepEqual((await athletes.listRideSessionStates(athlete.id, [sessionId])).map(({ status }) => status), ['planned']);

    const saved = await imports.importForUser(athlete.id, ride(sessionId));
    assert.ok(saved.ok);
    assert.equal(saved.sessionId, sessionId);
    assert.deepEqual(await calendarIds(), [sessionId]);
    const load = await createTrainingLoadService({ db }).loadOverview(athlete.id, { now: now() });
    const session = load.sessions.find((entry) => entry.sessionId === sessionId);
    assert.equal(session?.plannedDurationSec, 0);
    assert.equal(session?.compliance, 'unplanned');
    assert.equal((await athletes.loadHomeDashboard(athlete.id))?.scheduledTotals.durationSec, 0);

    const again = await started.start(athlete.id, { kind: 'catalog', slug: SLUG }, { date: DAY });
    assert.ok(again.ok && again.sessionId !== sessionId, 'a saved one is not reused');

    assert.deepEqual(await imports.deleteImportedActivityForUser(athlete.id, saved.activityId), { ok: true, deletedSession: true });
    assert.deepEqual(await calendarIds(), []);
  });
});

test('starting a workout planned for today opens that copy', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'planned@example.test', role: 'ATHLETE' } });
    const scheduled = await createWorkoutCatalogService({ db }).schedule(athlete.id, SLUG, { dates: [DAY], requestKey: 'catalog-schedule-key-0001' });
    assert.ok(scheduled.ok);
    const started = createStartedWorkoutService({ db, now });
    assert.deepEqual(await started.start(athlete.id, { kind: 'catalog', slug: SLUG }, { date: DAY }), { ok: true, sessionId: scheduled.sessionIds[0], planned: true });
    const other = await started.start(athlete.id, { kind: 'catalog', slug: SLUG }, { date: '2026-11-20' });
    assert.ok(other.ok && !other.planned);
  });
});

test('marking a started workout as done puts it on the athlete\u2019s day', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'done@example.test', role: 'ATHLETE' } });
    const result = await createStartedWorkoutService({ db, now }).start(athlete.id, { kind: 'catalog', slug: SLUG }, { date: DAY });
    assert.ok(result.ok);
    const completion = createAthleteCompletionService({ db: db as never });
    assert.equal((await completion.completeSession(athlete.id, result.sessionId, {})).ok, false);
    assert.equal((await completion.completeSession(athlete.id, result.sessionId, { localDay: DAY })).ok, true);
    const saved = await db.session.findUniqueOrThrow({ where: { id: result.sessionId } });
    assert.equal(saved.date?.toISOString(), `${DAY}T00:00:00.000Z`);
    assert.equal(saved.status, 'completed');
  });
});

test('rejects unknown workouts and invalid days', async () => {
  const service = createStartedWorkoutService({ db: {} as never });
  assert.equal((await service.start(1, { kind: 'catalog', slug: 'missing' }, { date: DAY })).ok, false);
  assert.deepEqual(await service.start(1, { kind: 'catalog', slug: SLUG }, { date: '2026-02-30' }), { ok: false, error: 'Choose a date.', status: 400 });
});
