import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, format } from 'date-fns';

import { createAthleteService } from '../lib/athlete-service.ts';
import * as calendarScroller from '../lib/calendar-scroller.ts';
import { getVisibleDayCount, getVisibleDayWindow, shouldExtendCalendarRange } from '../lib/calendar-scroller.ts';

type SessionWhere = {
  date?: {
    gte?: Date;
    lte?: Date;
  };
};

function createSession(id: number, title: string, date: string | Date) {
  return {
    id,
    title,
    summary: null,
    sport: 'RUNNING',
    date: new Date(date),
    timeLabel: null,
    status: 'planned',
    adjusted: false,
    blocks: [
      {
        id: id * 10,
        kind: 'work',
        zone: 3,
        durationSec: 1800,
        reps: null,
        targetType: null,
        targetLow: null,
        targetHigh: null,
        note: null,
        sortOrder: 0,
      },
    ],
    activity: null,
  };
}

test('athlete calendar week view shapes the selected week and keeps session days addressable', async () => {
  const sessionQueries: SessionWhere[] = [];

  const athleteService = createAthleteService({
    db: {
      user: {
        async findUnique(args: { where: { id: number }; include: { sessions: { where: SessionWhere } } }) {
          sessionQueries.push(args.include.sessions.where);

          return {
            id: 7,
            role: 'ATHLETE',
            name: 'Mara Holt',
            coach: { id: 2, name: 'Erik Krogh' },
            sessions: [
              createSession(11, 'Easy run', '2026-06-22T07:00:00.000Z'),
              createSession(12, 'Tempo intervals', '2026-06-24T07:00:00.000Z'),
            ],
          };
        },
      },
    } as never,
  });

  const calendar = await athleteService.loadCalendarView(7, '2026-06-24', 'week');

  assert.ok(calendar);
  assert.equal(calendar.view, 'week');
  assert.equal(format(sessionQueries[0].date?.gte ?? new Date('1900-01-01'), 'yyyy-MM-dd'), '2026-06-22');
  assert.equal(format(sessionQueries[0].date?.lte ?? new Date('1900-01-01'), 'yyyy-MM-dd'), '2026-06-28');
  assert.equal(calendar.days.length, 7);
  assert.equal(calendar.days.find((day) => day.isoDate === '2026-06-24')?.sessions[0]?.id, 12);
  assert.equal(format(calendar.period.start, 'yyyy-MM-dd'), '2026-06-22');
});

test('athlete Home keeps every session assigned to an upcoming day', async () => {
  const today = new Date();
  const nextDay = addDays(today, 1);
  const athleteService = createAthleteService({
    db: {
      user: {
        async findUnique() {
          return {
            id: 7,
            role: 'ATHLETE',
            name: 'Mara Holt',
            prefsJson: null,
            coach: { id: 2, name: 'Erik Krogh', email: 'erik@example.com' },
            sessions: [
              createSession(31, 'Morning intervals', nextDay),
              createSession(32, 'Evening strength', nextDay),
            ],
            activities: [],
          };
        },
      },
    } as never,
  });

  const dashboard = await athleteService.loadHomeDashboard(7);

  assert.ok(dashboard);
  assert.deepEqual(dashboard.nextDays[0].sessions.map((session) => session.id), [31, 32]);
});

test('athlete calendar month view returns a full Monday-first month grid with session counts', async () => {
  const sessionQueries: SessionWhere[] = [];

  const athleteService = createAthleteService({
    db: {
      user: {
        async findUnique(args: { where: { id: number }; include: { sessions: { where: SessionWhere } } }) {
          sessionQueries.push(args.include.sessions.where);

          return {
            id: 7,
            role: 'ATHLETE',
            name: 'Mara Holt',
            coach: { id: 2, name: 'Erik Krogh' },
            sessions: [
              createSession(21, 'Threshold run', '2026-05-01T07:00:00.000Z'),
              createSession(22, 'Long run', '2026-05-30T07:00:00.000Z'),
            ],
          };
        },
      },
    } as never,
  });

  const calendar = await athleteService.loadCalendarView(7, '2026-05-13', 'month');

  assert.ok(calendar);
  assert.equal(calendar.view, 'month');
  assert.equal(format(sessionQueries[0].date?.gte ?? new Date('1900-01-01'), 'yyyy-MM-dd'), '2026-04-27');
  assert.equal(format(sessionQueries[0].date?.lte ?? new Date('1900-01-01'), 'yyyy-MM-dd'), '2026-05-31');
  assert.equal(calendar.weeks.length, 5);
  assert.equal(calendar.weeks[0].length, 7);
  assert.equal(calendar.weeks[0][0].isoDate, '2026-04-27');
  assert.equal(calendar.weeks[0][0].isCurrentMonth, false);
  assert.equal(calendar.weeks[0][4].sessions[0]?.id, 21);
  assert.equal(calendar.weeks[4][5].sessions[0]?.id, 22);
  assert.equal(format(calendar.period.start, 'yyyy-MM-dd'), '2026-05-01');
});

test('calendar scroller picks the largest odd number of visible day cards that fit', () => {
  assert.equal(
    getVisibleDayCount(1260),
    5,
  );
  assert.equal(getVisibleDayCount(840), 3);
  assert.equal(getVisibleDayCount(430), 1);
});

test('calendar scroller keeps the focused day centered when enough days are loaded', () => {
  assert.deepEqual(getVisibleDayWindow(6, 5, 21), { start: 4, end: 9 });
  assert.deepEqual(getVisibleDayWindow(1, 5, 21), { start: 0, end: 5 });
});

test('calendar scroller requests more week data near either edge of the loaded range', () => {
  assert.deepEqual(shouldExtendCalendarRange(2, 5, 21), { before: true, after: false });
  assert.deepEqual(shouldExtendCalendarRange(18, 5, 21), { before: false, after: true });
  assert.deepEqual(shouldExtendCalendarRange(10, 5, 21), { before: false, after: false });
});

test('calendar scroller skips URL replacements when the active week query is already in sync', () => {
  const href = calendarScroller.getWeekScrollerSearchHref('/athlete/calendar', 'date=2026-06-24&view=week', '2026-06-24');

  assert.equal(href, null);
});
