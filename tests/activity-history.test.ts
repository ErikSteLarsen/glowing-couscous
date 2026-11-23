import test from 'node:test';
import assert from 'node:assert/strict';
import { createAthleteService } from '../lib/athlete-service.ts';
import { createAthleteManualActivityService } from '../lib/athlete-manual-activity-service.ts';
import { createAthletePlannerService } from '../lib/athlete-planner-service.ts';
import { createTrainingLoadService } from '../lib/training-load-service.ts';
import { createCoachService } from '../lib/coach-service.ts';
import { getActivityHref, parseActivityFilters } from '../lib/activity-navigation.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

test('activity navigation validates query values and preserves filters between pages', () => {
  assert.deepEqual(parseActivityFilters({ page: ['2'], q: ['run'], sport: 'CYCLING' }), { page: 1, query: '', sport: null });
  for (const page of ['-1', '0', '1.5', 'Infinity', '99999999999999']) {
    assert.equal(parseActivityFilters({ page }).page, 1);
  }
  const filters = parseActivityFilters({ page: '2', q: '  hills & tempo  ', sport: 'RUNNING' });
  const url = new URL(getActivityHref(filters, 3), 'http://localhost');
  assert.equal(url.searchParams.get('q'), 'hills & tempo');
  assert.equal(url.searchParams.get('sport'), 'RUNNING');
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(getActivityHref(parseActivityFilters({})), '/athlete/activity');
});

test('activity history pages and filtered totals retain outcomes and athlete isolation in PostgreSQL', { skip: disposableDatabaseSkip }, async (t) => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'history@example.test', role: 'ATHLETE' } });
    const other = await db.user.create({ data: { email: 'foreign@example.test', role: 'ATHLETE' } });
    const coach = await db.user.create({ data: { email: 'coach@example.test', role: 'COACH' } });
    for (let index = 0; index < 27; index++) {
      const running = index % 2 === 0;
      const owner = index === 26 ? other.id : athlete.id;
      await db.session.create({ data: {
        athleteId: owner,
        sport: running ? 'RUNNING' : 'BIKING',
        title: `${running ? 'Endurance' : 'Ride'} ${index}`,
        source: 'athlete-planner',
        status: 'completed',
        activity: { create: {
          athleteId: owner,
          completedAt: new Date('2026-11-09T10:00:00Z'),
          durationSec: running ? 600 : 1200,
          tss: running ? 10 : 20,
          zoneDistributionJson: '{}',
          segmentsJson: '[]',
          notes: `Saved outcome ${index}`,
        } },
      } });
    }
    const service = createAthleteService({ db });

    await t.test('every completion is reachable with stable ordering even for tied timestamps', async () => {
      const first = await service.loadActivityFeed(athlete.id);
      const second = await service.loadActivityFeed(athlete.id, parseActivityFilters({ page: '2' }));
      const third = await service.loadActivityFeed(athlete.id, parseActivityFilters({ page: '3' }));
      assert.ok(first && second && third);
      assert.equal(first.count, 26);
      assert.deepEqual(first.totals, { durationSec: 23400, tss: 390, unknownLoad: 0 });
      assert.deepEqual(second.totals, first.totals);
      assert.equal(first.activities.length, 12);
      assert.equal(second.activities.length, 12);
      assert.equal(third.activities.length, 2);
      const all = [...first.activities, ...second.activities, ...third.activities];
      assert.equal(new Set(all.map((item) => item.id)).size, 26);
      assert.equal(all[0].title, 'Ride 25');
      assert.equal(all[25].title, 'Endurance 0');
      assert.equal(all[25].notes, 'Saved outcome 0');
    });

    await t.test('sport and name filters apply to all totals and pages', async () => {
      const feed = await service.loadActivityFeed(athlete.id, parseActivityFilters({ q: 'endurance', sport: 'RUNNING', page: '2' }));
      assert.ok(feed);
      assert.equal(feed.count, 13);
      assert.deepEqual(feed.totals, { durationSec: 7800, tss: 130, unknownLoad: 0 });
      assert.equal(feed.activities.length, 1);
      assert.equal(feed.activities[0].title, 'Endurance 0');
      assert.equal(feed.page, 2);
    });

    await t.test('empty results and stale pages stay valid without revealing other athletes', async () => {
      const empty = await service.loadActivityFeed(athlete.id, parseActivityFilters({ q: 'Endurance 26' }));
      assert.ok(empty);
      assert.equal(empty.count, 0);
      assert.deepEqual(empty.totals, { durationSec: 0, tss: 0, unknownLoad: 0 });
      const stale = await service.loadActivityFeed(athlete.id, parseActivityFilters({ page: '999999999' }));
      assert.ok(stale);
      assert.equal(stale.page, 3);
      assert.equal(stale.activities.length, 2);
      assert.equal(await service.loadActivityFeed(coach.id), null);
      assert.equal(await service.loadActivityFeed(9999), null);
    });

    await t.test('workout name searches treat percent, underscore, and backslash literally', async () => {
      await db.session.updateMany({ where: { athleteId: athlete.id, title: 'Endurance 0' }, data: { title: '90% FTP_under\\hill' } });
      for (const query of ['%', '_', '90% ftp_', '\\hill']) {
        const feed = await service.loadActivityFeed(athlete.id, parseActivityFilters({ q: query }));
        assert.ok(feed);
        assert.equal(feed.count, 1);
        assert.equal(feed.activities[0].title, '90% FTP_under\\hill');
        assert.deepEqual(feed.totals, { durationSec: 600, tss: 10, unknownLoad: 0 });
      }
    });

    await t.test('manual logging is owner-scoped, idempotent, unplanned, and visible on the completion date', async () => {
      const manualService = createAthleteManualActivityService({ db });
      const requestKey = '438e58dc-1895-42aa-90f7-4ab172ef2c5a';
      const input = {
        sport: 'RUNNING', title: 'Lunch loop', completedOn: '2026-11-07', durationMinutes: 47, distanceKm: 5.25,
        rpe: 6, notes: 'Hilly route; felt controlled.', requestKey, pairingChoice: 'separate',
      };
      const created = await manualService.create(athlete.id, input);
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const retried = await manualService.create(athlete.id, { ...input, distanceKm: 9.5 });
      assert.deepEqual(retried, created);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id, title: 'Lunch loop' } }), 1);
      const foreignReplay = await manualService.create(other.id, input);
      assert.deepEqual(foreignReplay, { ok: false, status: 404, error: 'Activity not found.' });

      const session = await db.session.findUnique({ where: { id: created.sessionId }, include: { blocks: true, activity: true } });
      assert.ok(session);
      assert.equal(session.status, 'completed');
      assert.equal(session.source, 'athlete-manual');
      assert.equal(session.date?.toISOString().slice(0, 10), '2026-11-07');
      assert.equal(session.coachOwnerId, null);
      assert.equal(session.assignedById, null);
      assert.equal(session.coachBaselineJson, null);
      assert.deepEqual(session.blocks, []);
      assert.equal(session.activity?.durationSec, 2820);
      assert.equal(session.activity?.distanceMeters, 5250);
      assert.equal(session.activity?.tss, null);
      assert.equal(session.activity?.compliancePct, null);
      assert.equal(session.activity?.metricsSource, 'manual-unplanned');
      assert.equal(session.activity?.rpe, 6);

      const activityService = createAthleteService({ db });
      const feed = await activityService.loadActivityFeed(athlete.id, parseActivityFilters({ q: 'Lunch loop' }));
      assert.ok(feed);
      const loggedEntry = feed.activities.find((item) => item.sessionId === created.sessionId);
      assert.ok(loggedEntry);
      assert.equal(loggedEntry.tss, null);
      assert.equal(loggedEntry.distanceMeters, 5250);
      assert.equal(loggedEntry.completedAt.toISOString().slice(0, 10), '2026-11-07');
      assert.equal(feed.totals.unknownLoad, 1);
      assert.equal(feed.totals.durationSec, 2820);

      const detail = await activityService.loadSessionDetail(athlete.id, created.sessionId);
      assert.ok(detail);
      assert.equal(detail.session.activityDurationSec, 2820);
      assert.equal(detail.session.activityDistanceMeters, 5250);
      assert.equal(detail.session.activityRpe, 6);
      assert.equal(detail.session.activityNotes, input.notes);
      assert.equal(detail.session.plannedTss, 0);
      assert.equal(detail.session.compliance, 'unplanned');

      const planner = createAthletePlannerService({ db });
      const calendar = await planner.loadWorkspace(athlete.id, '2026-11-07');
      const calendarEntry = calendar.days.flatMap((day) => day.sessions).find((item) => item.id === created.sessionId);
      assert.ok(calendarEntry);
      assert.equal(calendarEntry.scheduledDate, '2026-11-07');
      assert.equal(calendarEntry.durationSec, 2820);
      assert.equal(calendarEntry.tss, null);

      const training = await createTrainingLoadService({ db }).loadOverview(athlete.id, { now: new Date('2026-11-10T12:00:00Z') });
      const week = training.weeks.find((item) => item.weekStart === '2026-11-02');
      assert.ok(week);
      assert.equal(week.completed.durationSec, 2820);
      assert.equal(week.completed.tss, 0);
      assert.equal(week.completed.unknownLoadSessions, 1);
      assert.equal(training.sessions.find((item) => item.sessionId === created.sessionId)?.compliance, 'unplanned');

      await db.user.update({ where: { id: athlete.id }, data: { coachId: coach.id } });
      const coachDetail = await createCoachService({ db, now: () => new Date('2026-11-10T12:00:00Z') }).getAthleteDetail(coach.id, athlete.id);
      assert.ok(coachDetail);
      const coachActivity = coachDetail.recentSessions.find((item) => item.id === created.sessionId);
      assert.ok(coachActivity);
      assert.equal(coachActivity.tss, null);
      assert.equal(coachActivity.metricsSource, 'manual-unplanned');

      const absentDistance = await manualService.create(athlete.id, {
        ...input,
        title: 'No distance recorded',
        distanceKm: null,
        requestKey: 'd0839be2-4037-4572-9495-82c150ddca41',
      });
      assert.equal(absentDistance.ok, true);
      if (absentDistance.ok) {
        const activity = await db.activity.findUnique({ where: { sessionId: absentDistance.sessionId }, select: { distanceMeters: true } });
        assert.equal(activity?.distanceMeters, null);
      }
    });

    await t.test('manual logging rejects invalid boundaries and non-athletes without writes', async () => {
      const manualService = createAthleteManualActivityService({ db });
      const base = {
        sport: 'RUNNING', title: 'Rejected', completedOn: '2026-11-07', durationMinutes: 20,
        distanceKm: null, rpe: null, notes: null, requestKey: '4a47249a-b12b-49c9-8d8e-e3d43c3c11ee', pairingChoice: 'separate',
      };
      for (const input of [
        { ...base, title: ' '.repeat(1) }, { ...base, title: 'x'.repeat(121) },
        { ...base, completedOn: '2026-02-30' }, { ...base, durationMinutes: 0 },
        { ...base, durationMinutes: 1441 }, { ...base, distanceKm: 0 }, { ...base, distanceKm: 0.009 },
        { ...base, distanceKm: 1000.01 }, { ...base, distanceKm: Number.NaN }, { ...base, distanceKm: '5.2' },
        { ...base, rpe: 11 }, { ...base, notes: 'x'.repeat(2001) },
      ]) {
        const result = await manualService.create(athlete.id, input);
        assert.equal(result.ok, false);
      }
      const coachResult = await manualService.create(coach.id, { ...base, requestKey: 'd664e1b1-b269-48c9-8fe9-dc4143549ac4' });
      assert.equal(coachResult.ok, false);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id, title: 'Rejected' } }), 0);
    });

    await t.test('standalone manual corrections update the session, activity, Calendar, and load view together', async () => {
      const manualService = createAthleteManualActivityService({ db });
      const created = await manualService.create(athlete.id, {
        sport: 'RUNNING', title: 'Wrong title', completedOn: '2026-11-07', durationMinutes: 40,
        distanceKm: 5, rpe: 5, notes: 'Old note', requestKey: '379b8523-9bb0-4f3f-99ec-2a19ff7421f1', pairingChoice: 'separate',
      });
      assert.equal(created.ok, true);
      if (!created.ok) return;

      const activity = await db.activity.findUnique({ where: { sessionId: created.sessionId } });
      assert.ok(activity);
      const correction = {
        expectedUpdatedAt: activity.updatedAt.toISOString(),
        sport: 'BIKING', title: 'Corrected morning ride', completedOn: '2026-11-08',
        durationMinutes: 52, distanceKm: 7.25, rpe: 8, notes: 'Corrected note',
      };
      const saved = await manualService.correct(athlete.id, activity.id, correction);
      assert.equal(saved.ok, true);
      if (!saved.ok) return;

      const session = await db.session.findUnique({ where: { id: created.sessionId }, include: { blocks: true, activity: true } });
      assert.ok(session?.activity);
      assert.equal(session.status, 'completed');
      assert.equal(session.source, 'athlete-manual');
      assert.equal(session.title, 'Corrected morning ride');
      assert.equal(session.sport, 'BIKING');
      assert.equal(session.date?.toISOString().slice(0, 10), '2026-11-08');
      assert.equal(session.rpe, 8);
      assert.equal(session.athleteNotes, 'Corrected note');
      assert.equal(session.coachBaselineJson, null);
      assert.deepEqual(session.blocks, []);
      assert.equal(session.activity.metricsSource, 'manual-unplanned');
      assert.equal(session.activity.completedAt.toISOString().slice(0, 10), '2026-11-08');
      assert.equal(session.activity.durationSec, 3120);
      assert.equal(session.activity.distanceMeters, 7250);
      assert.equal(session.activity.rpe, 8);
      assert.equal(session.activity.notes, 'Corrected note');
      assert.equal(session.activity.tss, null);
      assert.equal(session.activity.compliancePct, null);
      assert.equal(session.activity.manualEntryKey, '379b8523-9bb0-4f3f-99ec-2a19ff7421f1');

      const activityService = createAthleteService({ db });
      const feed = await activityService.loadActivityFeed(athlete.id, parseActivityFilters({ q: 'Corrected morning', sport: 'BIKING' }));
      assert.ok(feed);
      assert.equal(feed.count, 1);
      assert.equal(feed.activities[0].durationSec, 3120);
      assert.equal(feed.activities[0].distanceMeters, 7250);
      assert.equal(feed.activities[0].completedAt.toISOString().slice(0, 10), '2026-11-08');
      assert.equal(feed.activities[0].tss, null);
      assert.equal(feed.totals.unknownLoad, 1);

      const detail = await activityService.loadSessionDetail(athlete.id, created.sessionId);
      assert.ok(detail);
      assert.equal(detail.session.title, 'Corrected morning ride');
      assert.equal(detail.session.activityDurationSec, 3120);
      assert.equal(detail.session.activityDistanceMeters, 7250);
      assert.equal(detail.session.activityRpe, 8);
      assert.equal(detail.session.activityNotes, 'Corrected note');
      assert.equal(detail.session.activityId, activity.id);
      assert.ok(detail.session.activityUpdatedAt);

      const calendar = await createAthletePlannerService({ db }).loadWorkspace(athlete.id, '2026-11-08');
      const calendarEntry = calendar.days.flatMap((day) => day.sessions).find((item) => item.id === created.sessionId);
      assert.ok(calendarEntry);
      assert.equal(calendarEntry.scheduledDate, '2026-11-08');
      assert.equal(calendarEntry.durationSec, 3120);
      assert.equal(calendarEntry.tss, null);

      const training = await createTrainingLoadService({ db }).loadOverview(athlete.id, { now: new Date('2026-11-10T12:00:00Z') });
      const correctedLoad = training.sessions.find((item) => item.sessionId === created.sessionId);
      assert.equal(correctedLoad?.day, '2026-11-08');
      assert.equal(correctedLoad?.actualDurationSec, 3120);
      assert.equal(correctedLoad?.actualTss, null);
      assert.equal(correctedLoad?.compliance, 'unplanned');

      const stale = await manualService.correct(athlete.id, activity.id, correction);
      assert.deepEqual(stale, { ok: false, status: 409, error: 'This activity changed after you opened it. Reload the page before you edit it.' });
      const invalid = await manualService.correct(athlete.id, activity.id, { ...correction, expectedUpdatedAt: saved.updatedAt.toISOString(), completedOn: '2026-02-30' });
      assert.equal(invalid.ok, false);
      if (!invalid.ok) assert.equal(invalid.status, 400);
      const foreign = await manualService.correct(other.id, activity.id, { ...correction, expectedUpdatedAt: saved.updatedAt.toISOString() });
      assert.deepEqual(foreign, { ok: false, status: 404, error: 'Activity not found.' });
      const unchanged = await db.activity.findUnique({ where: { id: activity.id }, select: { durationSec: true, completedAt: true } });
      assert.equal(unchanged?.durationSec, 3120);
      assert.equal(unchanged?.completedAt.toISOString().slice(0, 10), '2026-11-08');

      const plannedActivity = await db.activity.findFirst({ where: { athleteId: athlete.id, metricsSource: 'manual-planned' }, select: { id: true, updatedAt: true } });
      assert.ok(plannedActivity);
      const unsupported = await manualService.correct(athlete.id, plannedActivity.id, { expectedUpdatedAt: plannedActivity.updatedAt.toISOString(), durationMinutes: 30 });
      assert.equal(unsupported.ok, false);
      if (!unsupported.ok) assert.equal(unsupported.status, 409);
    });

    await t.test('manual summary explicitly pairs only eligible self-planned sessions and preserves the plan', async () => {
      const manualService = createAthleteManualActivityService({ db });
      const planned = await db.session.create({ data: {
        athleteId: athlete.id, sport: 'RUNNING', title: 'Tempo intervals', date: new Date('2026-11-08T18:30:00Z'),
        timeLabel: '19:30', summary: 'Keep it controlled', status: 'planned', source: 'athlete-planner',
        blocks: { create: [{ kind: 'work', zone: 4, durationSec: 900, reps: null, sortOrder: 0, skipped: false, note: 'Threshold' }] },
      } });
      const candidateList = await manualService.candidates(athlete.id, 'RUNNING', '2026-11-08');
      assert.ok(candidateList.some((item) => item.id === planned.id));
      const input = {
        sport: 'RUNNING', title: 'Manual summary title', completedOn: '2026-11-08', durationMinutes: 34,
        distanceKm: 6.4, rpe: 7, notes: 'Felt strong', requestKey: 'be163a08-7830-4bb7-a52e-1d785c846eb3', pairingChoice: planned.id,
      };
      const saved = await manualService.create(athlete.id, input);
      assert.equal(saved.ok, true);
      if (!saved.ok) return;
      const retried = await manualService.create(athlete.id, { ...input, title: 'Changed on retry', pairingChoice: 'separate' });
      assert.deepEqual(retried, saved);
      assert.equal(await db.session.count({ where: { id: planned.id } }), 1);
      const completed = await db.session.findUnique({ where: { id: planned.id }, include: { blocks: true, activity: true } });
      assert.ok(completed);
      assert.equal(completed.status, 'completed');
      assert.equal(completed.title, 'Tempo intervals');
      assert.equal(completed.timeLabel, '19:30');
      assert.equal(completed.summary, 'Keep it controlled');
      assert.equal(completed.blocks.length, 1);
      assert.equal(completed.blocks[0].note, 'Threshold');
      assert.ok(completed.coachBaselineJson);
      assert.equal(completed.activity?.metricsSource, 'manual-paired');
      assert.equal(completed.activity?.durationSec, 2040);
      assert.equal(completed.activity?.distanceMeters, 6400);
      assert.equal(completed.activity?.rpe, 7);
      assert.equal(completed.activity?.tss, null);
      assert.equal(completed.activity?.compliancePct, null);
      assert.equal(completed.activity?.actualSnapshotJson, null);

      const activityService = createAthleteService({ db });
      const detail = await activityService.loadSessionDetail(athlete.id, planned.id);
      assert.ok(detail);
      assert.equal(detail.session.compliance, 'duration-only');
      assert.equal(detail.session.plannedDurationSec, 900);
      assert.equal(detail.session.activityDurationSec, 2040);
      const training = await createTrainingLoadService({ db }).loadOverview(athlete.id, { now: new Date('2026-11-10T12:00:00Z') });
      assert.equal(training.sessions.find((item) => item.sessionId === planned.id)?.compliance, 'duration-only');

      const coachAssigned = await db.session.create({ data: {
        athleteId: athlete.id, coachOwnerId: coach.id, sport: 'RUNNING', title: 'Coach session', date: new Date('2026-11-08T09:00:00Z'), status: 'planned', source: 'coach',
      } });
      assert.equal((await manualService.candidates(athlete.id, 'RUNNING', '2026-11-08')).some((item) => item.id === coachAssigned.id), false);
      const stale = await manualService.create(athlete.id, { ...input, title: 'Coach session attempt', requestKey: 'f8a291b9-5c3b-4f72-ab7d-321f9c373e22', pairingChoice: coachAssigned.id });
      assert.deepEqual(stale, { ok: false, status: 409, error: 'That planned workout is no longer available. Choose another, or save this on its own.' });
      assert.equal((await db.session.findUnique({ where: { id: coachAssigned.id } }))?.status, 'planned');

      const pairedActivity = await db.activity.findUnique({ where: { sessionId: planned.id } });
      assert.ok(pairedActivity);
      const forbiddenPlanEdit = await manualService.correct(athlete.id, pairedActivity.id, {
        expectedUpdatedAt: pairedActivity.updatedAt.toISOString(), title: 'Must stay planned title', durationMinutes: 35,
        distanceKm: 6.6, rpe: 8, notes: 'Corrected performed summary',
      });
      assert.deepEqual(forbiddenPlanEdit, { ok: false, status: 400, error: 'You can’t change the planned workout from here.' });
      const pairedCorrection = await manualService.correct(athlete.id, pairedActivity.id, {
        expectedUpdatedAt: pairedActivity.updatedAt.toISOString(), durationMinutes: 35,
        distanceKm: 6.6, rpe: 8, notes: 'Corrected performed summary',
      });
      assert.equal(pairedCorrection.ok, true);
      const pairedAfterCorrection = await db.session.findUnique({ where: { id: planned.id }, include: { blocks: true, activity: true } });
      assert.ok(pairedAfterCorrection?.activity);
      assert.equal(pairedAfterCorrection.title, 'Tempo intervals');
      assert.equal(pairedAfterCorrection.sport, 'RUNNING');
      assert.equal(pairedAfterCorrection.date?.toISOString().slice(0, 10), '2026-11-08');
      assert.equal(pairedAfterCorrection.status, 'completed');
      assert.equal(pairedAfterCorrection.blocks[0].note, 'Threshold');
      assert.ok(pairedAfterCorrection.coachBaselineJson);
      assert.equal(pairedAfterCorrection.activity.metricsSource, 'manual-paired');
      assert.equal(pairedAfterCorrection.activity.durationSec, 2100);
      assert.equal(pairedAfterCorrection.activity.distanceMeters, 6600);
      assert.equal(pairedAfterCorrection.activity.rpe, 8);
      assert.equal(pairedAfterCorrection.activity.notes, 'Corrected performed summary');
      assert.equal(pairedAfterCorrection.activity.tss, null);
      assert.equal(pairedAfterCorrection.activity.actualSnapshotJson, null);
    });
  });
});
