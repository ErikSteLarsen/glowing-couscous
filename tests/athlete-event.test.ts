import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { addDays, format } from 'date-fns';
import { createAthleteEventService } from '../lib/athlete-event-service.ts';
import { createAthleteService } from '../lib/athlete-service.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd');

test('athlete events validate and persist owner-scoped goals and post-event results without training side effects', { skip: disposableDatabaseSkip }, async (t) => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'event-athlete@example.test', role: 'ATHLETE' } });
    const other = await db.user.create({ data: { email: 'event-other@example.test', role: 'ATHLETE' } });
    const coach = await db.user.create({ data: { email: 'event-coach@example.test', role: 'COACH' } });
    const service = createAthleteEventService({ db });

    await t.test('create/edit/delete support multiple independently owned events', async () => {
      const first = await service.create(athlete.id, { title: 'City 10K', sport: 'RUNNING', eventDate: day(1), targetFinishSec: 3600 });
      const second = await service.create(athlete.id, { title: 'Lake swim', sport: 'SWIMMING', eventDate: day(3), targetFinishSec: null });
      assert.equal(first.ok, true); assert.equal(second.ok, true);
      if (!first.ok || !second.ok) return;
      assert.equal((await service.list(athlete.id))?.length, 2);
      assert.equal((await service.list(other.id))?.length, 0);
      assert.equal(await service.list(coach.id), null);
      const updated = await service.update(athlete.id, first.value.id, { title: 'City 10K PB', sport: 'RUNNING', eventDate: day(2), targetFinishSec: 3500 });
      assert.equal(updated.ok, true);
      assert.equal((await service.update(other.id, first.value.id, { title: 'Private', sport: 'RUNNING', eventDate: day(1), targetFinishSec: null })).ok, false);
      assert.equal((await service.delete(other.id, first.value.id)).ok, false);
      assert.equal((await service.delete(athlete.id, second.value.id)).ok, true);
    });

    await t.test('invalid dates, sports, durations, notes, and future results are rejected at the service boundary', async () => {
      assert.equal((await service.create(athlete.id, { title: 'Bad day', sport: 'RUNNING', eventDate: '2026-02-30', targetFinishSec: null })).ok, false);
      assert.equal((await service.create(athlete.id, { title: 'Bad sport', sport: 'REST', eventDate: day(1), targetFinishSec: null })).ok, false);
      assert.equal((await service.create(athlete.id, { title: 'Bad target', sport: 'RUNNING', eventDate: day(1), targetFinishSec: 0 })).ok, false);
      assert.equal((await service.create(athlete.id, { title: ' ', sport: 'RUNNING', eventDate: day(1), targetFinishSec: null })).ok, false);
      const future = await service.create(athlete.id, { title: 'Future event', sport: 'TRIATHLON', eventDate: day(1), targetFinishSec: null });
      assert.equal(future.ok, true);
      if (future.ok) {
        assert.equal((await service.recordResult(athlete.id, future.value.id, { resultFinishSec: 7200, resultNote: '' })).ok, false);
        await service.delete(athlete.id, future.value.id);
      }
      const past = await service.create(athlete.id, { title: 'Old race', sport: 'BIKING', eventDate: day(-2), targetFinishSec: 9000 });
      assert.equal(past.ok, true);
      if (past.ok) {
        assert.equal((await service.recordResult(athlete.id, past.value.id, { resultFinishSec: -1, resultNote: '' })).ok, false);
        assert.equal((await service.recordResult(athlete.id, past.value.id, { resultFinishSec: 8500, resultNote: 'Headwind on the climb' })).ok, true);
        const result = await service.recordResult(athlete.id, past.value.id, { resultFinishSec: 8400, resultNote: 'Corrected time' });
        assert.equal(result.ok, true);
        if (result.ok) { assert.equal(result.value.resultFinishSec, 8400); assert.equal(result.value.resultNote, 'Corrected time'); }
        assert.equal((await service.recordResult(other.id, past.value.id, { resultFinishSec: 8400 })).ok, false);
      }
    });

    await t.test('Home and week/month Calendar show only the owner’s events without creating sessions or activities', async () => {
      const selectedDay = day(1);
      const event = await service.create(athlete.id, { title: 'Visible 5K', sport: 'RUNNING', eventDate: selectedDay, targetFinishSec: 1800 });
      assert.equal(event.ok, true);
      const athleteReads = createAthleteService({ db });
      const [home, week, month, foreignHome, foreignCalendar] = await Promise.all([
        athleteReads.loadHomeDashboard(athlete.id),
        athleteReads.loadCalendarView(athlete.id, selectedDay, 'week'),
        athleteReads.loadCalendarView(athlete.id, selectedDay, 'month'),
        athleteReads.loadHomeDashboard(other.id),
        athleteReads.loadCalendarView(other.id, selectedDay, 'week'),
      ]);
      assert.equal(home?.nextEvent?.title, 'Visible 5K');
      assert.equal(home?.nextEvent?.targetFinishSec, 1800);
      for (const calendar of [week, month]) {
        assert.ok(calendar);
        const selected = calendar.view === 'week' ? calendar.days.find((entry) => entry.isoDate === selectedDay) : calendar.weeks.flatMap((item) => item).find((entry) => entry.isoDate === selectedDay);
        assert.equal(selected?.events.some((item) => item.title === 'Visible 5K'), true);
        assert.equal(selected?.sessions.length, 0);
      }
      assert.equal(foreignHome?.nextEvent, null);
      const foreignSelected = foreignCalendar?.days.find((entry) => entry.isoDate === selectedDay);
      assert.equal(foreignSelected?.events.length, 0);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 0);
      assert.equal(await db.activity.count({ where: { athleteId: athlete.id } }), 0);
    });

    await t.test('completed activities link explicitly, remain owner-scoped, and survive unlink or event deletion', async () => {
      const eventResult = await service.create(athlete.id, { title: 'Linked triathlon', sport: 'TRIATHLON', eventDate: day(-1), targetFinishSec: null });
      const secondEvent = await service.create(athlete.id, { title: 'Other event', sport: 'RUNNING', eventDate: day(-1), targetFinishSec: null });
      assert.equal(eventResult.ok, true); assert.equal(secondEvent.ok, true);
      if (!eventResult.ok || !secondEvent.ok) return;
      const createActivity = async (ownerId: number, title: string, status = 'completed', sessionOwnerId = ownerId, completedAt = new Date(), sourceTimezoneOffsetMinutes: number | null = null) => db.session.create({ data: {
        athleteId: sessionOwnerId, sport: 'RUNNING', title, source: 'athlete-planner', status,
        activity: { create: { athleteId: ownerId, completedAt, sourceTimezoneOffsetMinutes, durationSec: 2400, distanceMeters: 5000, zoneDistributionJson: '{}', segmentsJson: '[]', notes: 'Private activity note', actualSnapshotJson: 'Private snapshot' } },
      }, include: { activity: true } });
      const first = await createActivity(athlete.id, 'Park run');
      const sourceLocal = await createActivity(athlete.id, 'Imported local-day run', 'completed', athlete.id, new Date('2026-11-11T01:00:00.000Z'), -300);
      const serverLocal = await createActivity(athlete.id, 'Server local-day run', 'completed', athlete.id, new Date('2026-11-11T01:00:00.000Z'));
      const foreign = await createActivity(other.id, 'Private run');
      const incomplete = await createActivity(athlete.id, 'Not done', 'planned');
      const mismatched = await createActivity(athlete.id, 'Mismatched owner', 'completed', other.id);
      assert.equal((await service.linkActivity(other.id, eventResult.value.id, first.activity!.id)).ok, false);
      assert.equal((await service.linkActivity(athlete.id, eventResult.value.id, foreign.activity!.id)).ok, false);
      assert.equal((await service.linkActivity(athlete.id, eventResult.value.id, incomplete.activity!.id)).ok, false);
      assert.equal((await service.linkActivity(athlete.id, eventResult.value.id, mismatched.activity!.id)).ok, false);
      const candidates = await service.searchActivities(athlete.id, eventResult.value.id, '', 0);
      assert.equal(candidates.ok, true);
      if (candidates.ok) {
        assert.deepEqual(new Set(candidates.value.activities.map((activity) => activity.id)), new Set([first.activity!.id, sourceLocal.activity!.id, serverLocal.activity!.id]));
        assert.deepEqual(Object.keys(candidates.value.activities[0]).sort(), ['completedOn', 'distanceMeters', 'durationSec', 'id', 'session']);
        assert.equal(candidates.value.activities.find((activity) => activity.id === sourceLocal.activity!.id)?.completedOn, '2026-11-10');
        assert.equal(candidates.value.activities.find((activity) => activity.id === serverLocal.activity!.id)?.completedOn, format(serverLocal.activity!.completedAt, 'yyyy-MM-dd'));
      }
      assert.equal((await service.linkActivity(athlete.id, eventResult.value.id, first.activity!.id)).ok, true);
      assert.equal((await service.linkActivity(athlete.id, eventResult.value.id, sourceLocal.activity!.id)).ok, true);
      assert.equal((await service.linkActivity(athlete.id, secondEvent.value.id, first.activity!.id)).ok, false);
      const resultBefore = await service.recordResult(athlete.id, eventResult.value.id, { resultFinishSec: 8100, resultNote: 'Personal result' });
      assert.equal(resultBefore.ok, true);
      await db.activity.update({ where: { id: foreign.activity!.id }, data: { eventId: eventResult.value.id } });
      await db.activity.update({ where: { id: mismatched.activity!.id }, data: { eventId: eventResult.value.id } });
      const listed = await service.list(athlete.id);
      const linkedEvent = listed?.find((event) => event.id === eventResult.value.id);
      assert.equal(linkedEvent?.activities.length, 2);
      assert.equal(linkedEvent?.activities.some((activity) => activity.id === mismatched.activity!.id), false);
      assert.equal(linkedEvent?.activities.find((activity) => activity.id === first.activity!.id)?.durationSec, 2400);
      assert.deepEqual(Object.keys(linkedEvent!.activities[0]).sort(), ['completedOn', 'distanceMeters', 'durationSec', 'id', 'session']);
      assert.equal(linkedEvent?.activities.find((activity) => activity.id === sourceLocal.activity!.id)?.completedOn, '2026-11-10');
      assert.equal(linkedEvent?.resultFinishSec, 8100);
      assert.equal(linkedEvent?.resultNote, 'Personal result');
      await db.activity.update({ where: { id: foreign.activity!.id }, data: { eventId: null } });
      assert.equal((await service.unlinkActivity(athlete.id, eventResult.value.id, first.activity!.id)).ok, true);
      assert.equal((await db.activity.findUnique({ where: { id: first.activity!.id } }))?.eventId, null);
      await service.linkActivity(athlete.id, eventResult.value.id, first.activity!.id);
      assert.equal((await service.delete(athlete.id, eventResult.value.id)).ok, true);
      const afterDelete = await db.activity.findUnique({ where: { id: first.activity!.id } });
      assert.equal(afterDelete?.eventId, null);
      assert.equal(afterDelete?.durationSec, 2400);
      assert.equal((await db.session.findUnique({ where: { id: first.id } }))?.status, 'completed');
      await db.session.delete({ where: { id: first.id } });
      assert.equal(await db.activity.findUnique({ where: { id: first.activity!.id } }), null);
    });

    await t.test('mutation routes enforce Athlete authentication and Calendar labels event markers accessibly', async () => {
      const route = await readFile(path.join(process.cwd(), 'app/api/athlete/events/route.ts'), 'utf8');
      const detailRoute = await readFile(path.join(process.cwd(), 'app/api/athlete/events/[eventId]/route.ts'), 'utf8');
      const activitiesRoute = await readFile(path.join(process.cwd(), 'app/api/athlete/events/[eventId]/activities/route.ts'), 'utf8');
      const calendar = await readFile(path.join(process.cwd(), 'app/(app)/athlete/calendar/AthleteCalendar.tsx'), 'utf8');
      assert.match(route, /requireAthlete/); assert.match(detailRoute, /requireAthlete/);
      assert.match(activitiesRoute, /requireAthlete/); assert.match(activitiesRoute, /searchActivities/); assert.match(activitiesRoute, /linkActivity/); assert.match(activitiesRoute, /unlinkActivity/);
      assert.match(calendar, /day\.events\.map/); assert.match(calendar, /day\.events\.length.*event/);
      assert.match(calendar, /EventCalendarLink/);
    });
  });
});

test('Events lists events first and keeps forms and management behind explicit actions', async () => {
  const eventsClient = await readFile(path.join(process.cwd(), 'app/(app)/athlete/events/EventsClient.tsx'), 'utf8');
  assert.match(eventsClient, /id=\{`event-\$\{event\.id\}`\}/, 'Calendar event links keep their #event-<id> anchor');
  assert.match(eventsClient, /open=\{adding\}/, 'the create form opens from Add event instead of always showing');
  assert.match(eventsClient, /Add goal time/, 'goal time is optional behind Add goal time');
  assert.match(eventsClient, /Linked activities/, 'activity management stays under Linked activities');
  assert.match(eventsClient, /Delete this event\?/, 'deleting an event asks for confirmation');
});
