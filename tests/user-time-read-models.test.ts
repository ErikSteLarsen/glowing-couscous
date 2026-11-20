import test from 'node:test';
import assert from 'node:assert/strict';
import { createAthleteEventService } from '../lib/athlete-event-service.ts';
import { createAthleteService } from '../lib/athlete-service.ts';
import { createRideHubService } from '../lib/ride-hub-service.ts';

// 00:30 on Friday 20 November in Oslo, while UTC (and a Vercel server) is still on Thursday.
const now = () => new Date('2026-11-19T23:30:00.000Z');

function bikeSession(id: number, day: string) {
  return {
    id, title: `Ride ${id}`, summary: null, sport: 'BIKING', date: new Date(`${day}T00:00:00.000Z`),
    timeLabel: null, status: 'planned', adjusted: false, coachNotes: null, blocks: [], activity: null,
    athlete: { performanceProfileJson: null },
  };
}

test('Ride home uses the rider zone for today and overdue', async () => {
  const queries: Array<{ where: { date: { gte: Date; lt: Date } } }> = [];
  const db = {
    session: { async findMany(args: (typeof queries)[number]) { queries.push(args); return [bikeSession(1, '2026-11-20'), bikeSession(2, '2026-11-19')]; } },
    activity: { async findMany() { return []; } },
  } as never;

  const hub = await createRideHubService({ db, now, catalog: [] }).load(3, { timeZone: 'Europe/Oslo' });

  assert.equal(hub.today, '2026-11-20');
  assert.deepEqual(hub.todaySessions.map((session) => session.id), [1]);
  assert.deepEqual(hub.overdueSessions.map((session) => session.id), [2]);
  assert.equal(queries[0].where.date.lt.toISOString(), '2026-11-21T00:00:00.000Z');

  const utcHub = await createRideHubService({ db, now, catalog: [] }).load(3, { timeZone: 'UTC' });
  assert.equal(utcHub.today, '2026-11-19');
});

test('Home reads today and the completed-week window in the user zone', async () => {
  const activityQueries: Array<{ where: { completedAt: { gte: Date; lte: Date } } }> = [];
  const service = createAthleteService({
    now,
    db: {
      user: { async findUnique() {
        return { id: 7, role: 'ATHLETE', name: 'Mara', prefsJson: null, performanceProfileJson: null, coach: null, activities: [], sessions: [], events: [] };
      } },
      session: { async findMany() { return []; } },
      activity: { async findMany(args: (typeof activityQueries)[number]) { activityQueries.push(args); return []; } },
    } as never,
  });

  const dashboard = await service.loadHomeDashboard(7, { timeZone: 'Europe/Oslo' });

  assert.ok(dashboard);
  assert.equal(dashboard.todayKey, '2026-11-20');
  assert.equal(dashboard.weekDays.find((day) => day.isToday)?.isoDate, '2026-11-20');
  assert.equal(activityQueries[0].where.completedAt.gte.toISOString(), '2026-11-15T23:00:00.000Z');
  assert.equal(activityQueries[0].where.completedAt.lte.toISOString(), '2026-11-22T22:59:59.999Z');
});

test('event results open on the event day in the athlete zone', async () => {
  const event = { id: 5, athleteId: 7, eventDate: new Date('2026-11-20T12:00:00.000Z'), resultFinishSec: null };
  const updates: unknown[] = [];
  const service = createAthleteEventService({
    now,
    db: { athleteEvent: {
      async findFirst() { return event; },
      async update(args: unknown) { updates.push(args); return event; },
    } } as never,
  });

  assert.equal((await service.recordResult(7, 5, { resultFinishSec: 3600 }, { timeZone: 'UTC' })).ok, false);
  assert.equal((await service.recordResult(7, 5, { resultFinishSec: 3600 }, { timeZone: 'Europe/Oslo' })).ok, true);
  assert.equal(updates.length, 1);
});
