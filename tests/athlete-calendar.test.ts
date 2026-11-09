import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, format } from 'date-fns';

import { createAthleteService } from '../lib/athlete-service.ts';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getCalendarHref,
  getCalendarPeriodLabel,
  getCalendarRange,
  getCalendarShortcut,
  parseCalendarDay,
  stepCalendarPeriod,
} from '../lib/calendar-navigation.ts';

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

test('athlete calendar week view summarizes planned and completed work and flags movable sessions', async () => {
  const completed = {
    ...createSession(41, 'Done run', '2026-06-22T07:00:00.000Z'),
    activity: { tss: 40, durationSec: 1500, compliancePct: null, segmentsJson: null, metricsSource: 'manual' },
  };
  const coachAssigned = { ...createSession(42, 'Coach intervals', '2026-06-23T07:00:00.000Z'), coachOwnerId: 2, assignedById: 2 };
  const athleteService = createAthleteService({
    db: {
      user: {
        async findUnique() {
          return {
            id: 7,
            role: 'ATHLETE',
            name: 'Mara Holt',
            coach: null,
            sessions: [completed, coachAssigned, createSession(43, 'Easy run', '2026-06-25T07:00:00.000Z')],
          };
        },
      },
    } as never,
  });

  const calendar = await athleteService.loadCalendarView(7, '2026-06-24', 'week');

  assert.ok(calendar);
  assert.equal(calendar.weekSummaries.length, 1);
  const [summary] = calendar.weekSummaries;
  assert.equal(summary.weekStart, '2026-06-22');
  assert.equal(summary.planned.sessions, 3);
  assert.equal(summary.planned.durationSec, 1800 * 3);
  assert.equal(summary.completed.durationSec, 1500);
  assert.equal(summary.completed.tss, 40);
  assert.equal(summary.missed, 2, 'past open sessions count as missed');
  const sessions = new Map(calendar.days.flatMap((day) => day.sessions).map((session) => [session.id, session]));
  assert.equal(sessions.get(41)?.canReschedule, false, 'completed sessions stay put');
  assert.equal(sessions.get(42)?.canReschedule, false, 'coach-assigned sessions stay put');
  assert.equal(sessions.get(43)?.canReschedule, true);
});

test('athlete calendar month view returns one Monday-first summary per grid row', async () => {
  const athleteService = createAthleteService({
    db: { user: { async findUnique() { return { id: 7, role: 'ATHLETE', name: 'Mara', coach: null, sessions: [] }; } } } as never,
  });

  const calendar = await athleteService.loadCalendarView(7, '2026-11-09', 'month');

  assert.ok(calendar);
  assert.deepEqual(calendar.weekSummaries.map((week) => week.weekStart), calendar.weeks.map((week) => week[0].isoDate));
  assert.equal(calendar.weekSummaries[0].completionPct, null);
});

test('calendar day keys parse as local dates and reject impossible days', () => {
  assert.equal(parseCalendarDay('2026-11-09'), '2026-11-09');
  assert.equal(parseCalendarDay('2026-02-30'), null);
  assert.equal(parseCalendarDay('2026-11-09T00:00:00Z'), null);
  assert.equal(parseCalendarDay(undefined), null);
});

test('calendar steps move by a whole week or month, not a day', () => {
  assert.equal(stepCalendarPeriod('week', '2026-11-11', 1), '2026-11-18');
  assert.equal(stepCalendarPeriod('week', '2026-11-11', -1), '2026-11-04');
  assert.equal(stepCalendarPeriod('month', '2026-01-31', 1), '2026-02-28');
  assert.equal(stepCalendarPeriod('month', '2026-11-09', -1), '2026-10-09');
});

test('calendar ranges and labels are Monday-first', () => {
  assert.deepEqual(getCalendarRange('week', '2026-11-15'), { start: '2026-11-09', end: '2026-11-15' });
  assert.deepEqual(getCalendarRange('month', '2026-11-09'), { start: '2026-10-26', end: '2026-12-06' });
  assert.equal(getCalendarPeriodLabel('week', '2026-11-11'), 'Week 46 · 9–15 Nov');
  assert.equal(getCalendarPeriodLabel('week', '2026-12-30'), 'Week 53 · 28 Dec – 3 Jan');
  assert.equal(getCalendarPeriodLabel('month', '2026-11-09'), 'November 2026 · Weeks 44–49');
  assert.equal(getCalendarHref('month', '2026-11-09'), '/athlete/calendar?view=month&date=2026-11-09');
});

test('calendar shortcuts step, jump to today, and switch view outside fields only', () => {
  assert.deepEqual(getCalendarShortcut({ key: 'ArrowLeft' }), { type: 'step', direction: -1 });
  assert.deepEqual(getCalendarShortcut({ key: 'ArrowRight' }), { type: 'step', direction: 1 });
  assert.deepEqual(getCalendarShortcut({ key: 't' }), { type: 'today' });
  assert.deepEqual(getCalendarShortcut({ key: 'M' }), { type: 'view', view: 'month' });
  assert.deepEqual(getCalendarShortcut({ key: 'w' }), { type: 'view', view: 'week' });
  assert.equal(getCalendarShortcut({ key: 'ArrowLeft', targetTagName: 'input' }), null);
  assert.equal(getCalendarShortcut({ key: 't', targetIsEditable: true }), null);
  assert.equal(getCalendarShortcut({ key: 't', metaKey: true }), null);
  assert.equal(getCalendarShortcut({ key: 'ArrowRight', defaultPrevented: true }), null);
  assert.equal(getCalendarShortcut({ key: 'x' }), null);
});

test('calendar UI reschedules through the narrow schedule route with drag, keyboard, and a non-drag path', async () => {
  const source = await readFile(path.join(process.cwd(), 'app/(app)/athlete/calendar/AthleteCalendar.tsx'), 'utf8');

  assert.match(source, /\/api\/athlete\/planner\/sessions\/\$\{sessionId\}\/schedule/);
  assert.match(source, /JSON\.stringify\(\{ date: toDay \}\)/);
  assert.match(source, /useSensor\(KeyboardSensor/);
  assert.match(source, /announcements/);
  assert.match(source, /Move to…/);
  assert.match(source, /role="alert"/);
  assert.match(source, /router\.refresh\(\)/);
  assert.match(source, /\/athlete\/planner\?date=/);
  assert.match(source, /<ComplianceMark/);
  assert.doesNotMatch(source, /aria-label=\{`Focus /);
  assert.doesNotMatch(source, /router\.replace/);
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/);
});


test('calendar never offers movement for completed status without an Activity', async () => {
  const service = createAthleteService({
    db: { user: { async findUnique() { return {
      id: 7, role: 'ATHLETE', name: 'Mara', coach: null,
      sessions: [{ ...createSession(44, 'Legacy completed', '2026-06-26T07:00:00.000Z'), status: 'completed' }],
    }; } } } as never,
  });
  const calendar = await service.loadCalendarView(7, '2026-06-24', 'week');
  assert.ok(calendar);
  assert.equal(calendar.days.flatMap((day) => day.sessions)[0].canReschedule, false);
});
