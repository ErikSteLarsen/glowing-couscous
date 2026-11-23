import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, format, startOfWeek } from 'date-fns';

import {
  createAthleteSessionStatusService,
  getSessionStatusAction,
} from '../lib/athlete-session-status-service.ts';
import { createAthleteCompletionService } from '../lib/athlete-completion-service.ts';
import { createAthleteSessionAdjustmentService } from '../lib/athlete-session-adjustment-service.ts';
import { createAthleteService } from '../lib/athlete-service.ts';
import { createCoachService } from '../lib/coach-service.ts';
import { createTrainingLoadService } from '../lib/training-load-service.ts';
import { addSessionEditorBlock, createEmptySessionEditorDraft } from '../lib/session-editor.ts';

type FakeSession = {
  id: number;
  athleteId: number | null;
  coachOwnerId: number | null;
  trainingPlanId: number | null;
  assignedById: number | null;
  status: string;
  activity: { id: number } | null;
  date?: Date | null;
  adjusted?: boolean;
  blocks?: unknown[];
  sport?: string;
  title?: string;
  summary?: string | null;
  timeLabel?: string | null;
  coachBaselineJson?: string | null;
  coachNotes?: string | null;
  athleteNotes?: string | null;
  sportMetricsJson?: string | null;
  rpe?: number | null;
  source?: string;
  templateId?: number | null;
  planId?: number | null;
};

function personalSession(overrides: Partial<FakeSession> = {}): FakeSession {
  return {
    id: 40,
    athleteId: 7,
    coachOwnerId: null,
    trainingPlanId: null,
    assignedById: null,
    status: 'planned',
    activity: null,
    ...overrides,
  };
}

function createStatusDb(initial: FakeSession | null) {
  const state = { session: initial ? { ...initial } : null as FakeSession | null };
  const calls = { updateMany: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> };
  const db = {
    session: {
      async findUnique(args: { where: { id: number } }) {
        return state.session && state.session.id === args.where.id ? { ...state.session } : null;
      },
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        calls.updateMany.push(args);
        const current = state.session;
        if (!current || current.status !== args.where.status || current.athleteId !== args.where.athleteId) {
          return { count: 0 };
        }
        state.session = { ...current, ...(args.data as Partial<FakeSession>) };
        return { count: 1 };
      },
    },
  };
  return { db, state, calls };
}

test('skip then plan again moves a personal planned session between planned and skipped', async () => {
  const { db, state, calls } = createStatusDb(personalSession());
  const service = createAthleteSessionStatusService({ db: db as never });

  const skipped = await service.skipSession(7, 40);
  assert.deepEqual(skipped, { ok: true, sessionId: 40, status: 'skipped' });
  assert.equal(state.session?.status, 'skipped');
  assert.deepEqual(calls.updateMany[0]?.where, { id: 40, athleteId: 7, status: 'planned', activity: { is: null } });

  const restored = await service.planAgainSession(7, 40);
  assert.deepEqual(restored, { ok: true, sessionId: 40, status: 'planned' });
  assert.equal(state.session?.status, 'planned');
});

test('skipping twice and planning again a planned session are refused with clear errors', async () => {
  const { db } = createStatusDb(personalSession({ status: 'skipped' }));
  const service = createAthleteSessionStatusService({ db: db as never });

  assert.deepEqual(await service.skipSession(7, 40), {
    ok: false,
    status: 409,
    error: 'Only planned workouts can be skipped.',
  });

  const planned = createStatusDb(personalSession());
  const plannedService = createAthleteSessionStatusService({ db: planned.db as never });
  assert.deepEqual(await plannedService.planAgainSession(7, 40), {
    ok: false,
    status: 409,
    error: 'Only skipped workouts can be planned again.',
  });
});

test('completed sessions cannot be skipped or planned again', async () => {
  const completedWithActivity = createStatusDb(personalSession({ status: 'completed', activity: { id: 5 } }));
  const service = createAthleteSessionStatusService({ db: completedWithActivity.db as never });

  const skipResult = await service.skipSession(7, 40);
  assert.equal(skipResult.ok, false);
  assert.equal(skipResult.ok ? '' : skipResult.status, 409);
  assert.equal(skipResult.ok ? '' : skipResult.error, 'Workouts marked as done can’t be skipped.');

  const restoreResult = await service.planAgainSession(7, 40);
  assert.equal(restoreResult.ok, false);
  assert.equal(restoreResult.ok ? '' : restoreResult.status, 409);
  assert.equal(completedWithActivity.calls.updateMany.length, 0);
});

test('other owners sessions are not found and coach-assigned sessions are refused', async () => {
  const otherOwner = createStatusDb(personalSession({ athleteId: 9 }));
  const otherService = createAthleteSessionStatusService({ db: otherOwner.db as never });
  assert.deepEqual(await otherService.skipSession(7, 40), {
    ok: false,
    status: 404,
    error: 'Workout not found.',
  });
  assert.equal(otherOwner.calls.updateMany.length, 0);

  const coachAssigned = createStatusDb(personalSession({ assignedById: 2 }));
  const coachService = createAthleteSessionStatusService({ db: coachAssigned.db as never });
  const refused = await coachService.skipSession(7, 40);
  assert.equal(refused.ok, false);
  assert.equal(refused.ok ? '' : refused.status, 403);
  assert.equal(refused.ok ? '' : refused.error, 'Only your coach can change workouts they planned.');
  assert.equal(coachAssigned.calls.updateMany.length, 0);

  const trainingPlan = createStatusDb(personalSession({ trainingPlanId: 3 }));
  const planService = createAthleteSessionStatusService({ db: trainingPlan.db as never });
  assert.equal((await planService.skipSession(7, 40)).ok, false);
});

test('a concurrent change between read and write is reported instead of overwritten', async () => {
  const { db } = createStatusDb(personalSession());
  const racingDb = {
    session: {
      findUnique: db.session.findUnique,
      async updateMany() {
        return { count: 0 };
      },
    },
  };
  const service = createAthleteSessionStatusService({ db: racingDb as never });

  const result = await service.skipSession(7, 40);
  assert.equal(result.ok, false);
  assert.equal(result.ok ? '' : result.status, 409);
});

test('session action is offered only for open personal sessions', () => {
  assert.equal(getSessionStatusAction(personalSession(), 7), 'skip');
  assert.equal(getSessionStatusAction(personalSession({ status: 'skipped' }), 7), 'plan-again');
  assert.equal(getSessionStatusAction(personalSession({ status: 'completed', activity: { id: 1 } }), 7), null);
  assert.equal(getSessionStatusAction(personalSession({ assignedById: 2 }), 7), null);
  assert.equal(getSessionStatusAction(personalSession(), 8), null);
});

test('skipped sessions cannot record an outcome or be reopened into planned', async () => {
  const session = personalSession({ status: 'skipped' });
  const calls: string[] = [];
  const db = {
    session: {
      async findUnique() {
        return { ...session, blocks: [], athlete: { coachId: null }, date: new Date('2026-08-24T00:00:00.000Z') };
      },
      async update() {
        calls.push('update');
        return {};
      },
    },
    block: { async deleteMany() { calls.push('deleteMany'); return {}; } },
    activity: {
      async upsert() { calls.push('upsert'); return {}; },
      async delete() { calls.push('delete'); return {}; },
    },
    async $transaction() {
      calls.push('transaction');
      return [];
    },
  };
  const completion = createAthleteCompletionService({ db: db as never });

  const completed = await completion.completeSession(7, 40, {});
  assert.equal(completed.ok, false);
  assert.equal(completed.ok ? 0 : completed.status, 409);

  const reopened = await completion.reopenSession(7, 40, {});
  assert.equal(reopened.ok, false);
  assert.equal(reopened.ok ? 0 : reopened.status, 409);
  assert.deepEqual(calls, []);
});

test('planned edits keep a skipped session skipped instead of silently restoring it', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const db = {
    session: {
      async findUnique() {
        return {
          id: 40,
          athleteId: 7,
          coachOwnerId: null,
          trainingPlanId: null,
          planId: null,
          templateId: null,
          assignedById: null,
          date: new Date('2026-08-24T00:00:00.000Z'),
          planWeekday: null,
          timeLabel: null,
          sport: 'RUNNING',
          title: 'Easy run',
          summary: null,
          coachNotes: null,
          athleteNotes: null,
          sportMetricsJson: null,
          rpe: null,
          status: 'skipped',
          source: 'athlete',
          adjusted: false,
          coachBaselineJson: null,
          blocks: [],
          activity: null,
        };
      },
      async updateMany(args: { data: Record<string, unknown> }) {
        updates.push(args.data);
        return { count: 1 };
      },
      async update() {
        return {};
      },
    },
    plan: {
      async findFirst() { return { id: 11 }; },
      async create() { return { id: 11 }; },
    },
    block: { async deleteMany() { return {}; } },
    assignment: { async updateMany() { return {}; } },
    async $transaction(run: (tx: unknown) => Promise<unknown>) {
      return run(db);
    },
  };
  const adjustment = createAthleteSessionAdjustmentService({ db: db as never });
  const draft = addSessionEditorBlock(
    createEmptySessionEditorDraft({
      mode: 'planned',
      id: 40,
      athleteId: 7,
      scheduledDate: '2026-08-25',
      sport: 'RUNNING',
      title: 'Easy run',
    }),
    { kind: 'work', zone: 2, durationSec: 600 },
  );

  const result = await adjustment.savePlannedSession(7, 40, draft);

  assert.deepEqual(result, { ok: true, sessionId: 40 });
  assert.equal(updates[0]?.status, 'skipped');
  assert.equal(updates[0]?.adjusted, true);
});

test('Home weekly load and the next action ignore skipped sessions', async () => {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const sessionOn = (id: number, date: Date, status: string, durationSec: number) => ({
    id,
    title: `Session ${id}`,
    summary: null,
    sport: 'RUNNING',
    date,
    timeLabel: '07:00',
    status,
    adjusted: false,
    blocks: [{ id: id * 10, kind: 'work', zone: 2, durationSec, reps: null, targetType: null, targetLow: null, targetHigh: null, note: null, sortOrder: 0, skipped: false }],
    activity: null,
  });
  const service = createAthleteService({
    db: {
      user: {
        async findUnique() {
          return {
            id: 7,
            role: 'ATHLETE',
            name: 'Mara',
            coach: null,
            prefsJson: null,
            activities: [],
            sessions: [
              sessionOn(1, addDays(weekStart, 0), 'skipped', 3600),
              sessionOn(2, addDays(weekStart, 1), 'planned', 1800),
            ],
          };
        },
      },
      session: {
        // The overdue recovery query is not under test here; no session is overdue.
        async findMany() {
          return [];
        },
      },
      activity: {
        async findMany() {
          return [];
        },
      },
    } as never,
  });

  const dashboard = await service.loadHomeDashboard(7);

  assert.ok(dashboard);
  assert.equal(dashboard.weekTotals.durationSec, 1800);
  const mondayCard = dashboard.weekDays[0].sessions[0];
  assert.equal(mondayCard?.status, 'skipped');
});

test('coach compliance and planned counts exclude skipped sessions', async () => {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const block = { id: 1, kind: 'work', zone: 2, durationSec: 1800, reps: null, targetType: null, targetLow: null, targetHigh: null, targetMode: 'absolute', targetReference: null, note: null, skipped: false, sortOrder: 0 };
  const weekSession = (id: number, status: string, activity: null | { durationSec: number; tss: number; compliancePct: null; segmentsJson: null; metricsSource: string }) => ({
    id,
    title: `Session ${id}`,
    sport: 'RUNNING',
    date: addDays(weekStart, id % 7),
    status,
    adjusted: false,
    blocks: [{ ...block, id: id * 10 }],
    activity: activity ? { ...activity, completedAt: weekStart } : null,
  });
  const sessions = [
    weekSession(1, 'completed', { durationSec: 1800, tss: 40, compliancePct: null, segmentsJson: null, metricsSource: 'manual-actual' }),
    weekSession(2, 'planned', null),
    weekSession(3, 'skipped', null),
  ];
  const service = createCoachService({
    now: () => new Date(),
    db: {
      user: {
        async findUnique() {
          return null;
        },
        async findFirst() {
          return { id: 7, name: 'Mara', email: 'mara@example.test', plans: [], coach: { name: 'Coach' } };
        },
      },
      session: {
        async findMany(args: { where: { date?: { gte?: Date } } }) {
          return args.where.date?.gte ? sessions : [];
        },
      },
    } as never,
  });

  const detail = await service.getAthleteDetail(2, 7);

  assert.ok(detail);
  assert.equal(detail.stats.plannedCount, 2);
  assert.equal(detail.stats.completedCount, 1);
  assert.equal(detail.stats.compliancePct, 50);
  assert.equal(detail.stats.plannedDurationSec, 1800 + 1800);
});

test('calendar shows a skipped session as Skipped and leaves it out of week summaries', async () => {
  // Anchor to next week so the planned session is upcoming rather than missed.
  const monday = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
  const day = (offset: number) => addDays(monday, offset);
  const calendarSession = (id: number, date: Date, status: string) => ({
    id,
    title: `Session ${id}`,
    summary: null,
    sport: 'RUNNING',
    date,
    timeLabel: null,
    status,
    adjusted: false,
    blocks: [{ id: id * 10, kind: 'work', zone: 2, durationSec: 1800, reps: null, targetType: null, targetLow: null, targetHigh: null, note: null, sortOrder: 0, skipped: false }],
    activity: null,
  });
  const service = createAthleteService({
    db: {
      user: {
        async findUnique() {
          return {
            id: 7,
            role: 'ATHLETE',
            name: 'Mara',
            coach: null,
            events: [],
            sessions: [calendarSession(21, day(0), 'planned'), calendarSession(22, day(1), 'skipped')],
          };
        },
      },
    } as never,
  });

  const calendar = await service.loadCalendarView(7, format(monday, 'yyyy-MM-dd'), 'week');

  assert.ok(calendar);
  const skipped = calendar.days.find((entry) => entry.isoDate === format(day(1), 'yyyy-MM-dd'))?.sessions[0];
  assert.equal(skipped?.status, 'skipped');
  assert.equal(skipped?.compliance, 'skipped');
  assert.equal(calendar.weekSummaries[0].planned.sessions, 1);
  assert.equal(calendar.weekSummaries[0].planned.durationSec, 1800);
  assert.equal(calendar.weekSummaries[0].missed, 0);
});

test('session detail offers Skip for an open personal session and Plan again for a skipped one', async () => {
  const detailFor = (status: string) => createAthleteService({
    db: {
      user: { async findUnique() { return { id: 7, role: 'ATHLETE', selfCoached: true, coachId: null }; } },
      session: {
        async findUnique() {
          return {
            id: 42, athleteId: 7, coachOwnerId: null, trainingPlanId: null, assignedById: null,
            date: new Date(2026, 10, 12, 8), title: 'Easy run', sport: 'RUNNING', summary: null,
            status, adjusted: false, timeLabel: null, athleteNotes: null, coachNotes: null,
            athlete: { id: 7, name: 'Mara', coach: null }, activity: null, assignments: [],
            blocks: [{ id: 3, kind: 'work', zone: 2, durationSec: 600, reps: 1, targetType: null, targetMode: 'absolute', targetReference: null,
              targetLow: null, targetHigh: null, targetLowDecimal: null, targetHighDecimal: null, note: null, skipped: false, sortOrder: 0 }],
          };
        },
      },
    } as never,
  }).loadSessionDetail(7, 42);

  assert.equal((await detailFor('planned'))?.session.statusAction, 'skip');
  assert.equal((await detailFor('skipped'))?.session.statusAction, 'plan-again');
  assert.equal((await detailFor('skipped'))?.session.status, 'skipped');
});

test('training load keeps skipped sessions out of planned stress while listing them', async () => {
  const now = new Date(2026, 5, 24, 12);
  const record = (id: number, date: Date, status: string) => ({
    id,
    date,
    sport: 'RUNNING',
    title: `Session ${id}`,
    status,
    adjusted: false,
    coachBaselineJson: null,
    blocks: [{ kind: 'work', zone: 3, durationSec: 3600, reps: null, skipped: false }],
    activity: null,
  });
  const overview = await createTrainingLoadService({
    db: {
      session: {
        async findMany() {
          return [record(1, new Date(2026, 5, 25, 7), 'skipped'), record(2, new Date(2026, 5, 26, 7), 'planned')];
        },
      },
    } as never,
  }).loadOverview(7, { now });

  const skippedDay = overview.series.find((point) => point.day === '2026-06-25');
  const plannedDay = overview.series.find((point) => point.day === '2026-06-26');
  assert.equal(skippedDay?.plannedTss, 0);
  assert.ok((plannedDay?.plannedTss ?? 0) > 0);
  assert.equal(overview.sessions.find((session) => session.sessionId === 1)?.status, 'skipped');
  assert.equal(overview.sessions.find((session) => session.sessionId === 1)?.compliance, 'skipped');
});
