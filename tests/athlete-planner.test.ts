import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createAthletePlannerService } from '../lib/athlete-planner-service.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

const sourceBlocks = [{
  kind: 'work', zone: 3, durationSec: 1800, reps: null, targetType: null,
  targetMode: 'absolute', targetReference: null, targetLow: null, targetHigh: null,
  targetLowDecimal: null, targetHighDecimal: null, note: 'Main set', skipped: false, sortOrder: 0,
}];

function createPlacementHarness({ failAtSession, routineJson }: { failAtSession?: number; routineJson?: string } = {}) {
  let nextSessionId = 30;
  let nextPlanId = 40;
  let createAttempts = 0;
  const state = {
    sessions: [] as Array<Record<string, unknown>>,
    plans: [] as Array<{ id: number; athleteId: number; startDate: Date; endDate: Date }>,
    requests: new Map<string, { userId: number; requestKey: string; payloadHash: string; sessionIdsJson: string }>(),
  };
  const keyFor = (userId: number, requestKey: string) => `${userId}:${requestKey}`;
  const db: any = {
    session: {
      findMany: async () => [],
      findFirst: async ({ where }: { where: { id?: number; athleteId?: number } }) => where.id === 4
        ? {
            id: 4,
            athleteId: where.athleteId,
            coachOwnerId: null,
            trainingPlanId: null,
            planId: null,
            date: null,
            timeLabel: null,
            sport: 'RUNNING',
            title: 'Saved intervals',
            summary: 'A reusable source',
            sportMetricsJson: '{"distanceKm":8}',
            blocks: sourceBlocks,
          }
        : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createAttempts += 1;
        if (failAtSession === createAttempts) throw new Error('simulated session write failure');
        const created = { id: nextSessionId++, ...data };
        state.sessions.push(created);
        return created;
      },
      update: async () => ({ id: 0 }),
      delete: async () => ({ id: 0 }),
    },
    template: {
      findMany: async () => [],
      findFirst: async ({ where }: { where: { id: number; ownerId: number } }) => where.id === 9
        ? {
            id: 9,
            ownerId: where.ownerId,
            sport: 'CYCLING',
            name: 'Build week',
            cadence: 'week',
            routineJson: routineJson ?? JSON.stringify({ version: 1, entries: [{ weekday: 0, workoutId: 4, title: 'Saved workout', sport: 'RUNNING', summary: null, sportMetricsJson: null, blocks: sourceBlocks }] }),
            summary: null,
            blocks: sourceBlocks,
          }
        : null,
    },
    plan: {
      findFirst: async ({ where }: { where: { athleteId: number; startDate: Date; endDate: Date } }) =>
        state.plans.find((plan) =>
          plan.athleteId === where.athleteId
          && plan.startDate.getTime() === where.startDate.getTime()
          && plan.endDate.getTime() === where.endDate.getTime(),
        ) ?? null,
      create: async ({ data }: { data: { athleteId: number; startDate: Date; endDate: Date } }) => {
        const plan = { id: nextPlanId++, ...data };
        state.plans.push(plan);
        return plan;
      },
    },
    placementRequest: {
      findUnique: async ({ where }: { where: { userId_requestKey: { userId: number; requestKey: string } } }) => {
        const { userId, requestKey } = where.userId_requestKey;
        return state.requests.get(keyFor(userId, requestKey)) ?? null;
      },
      create: async ({ data }: { data: { userId: number; requestKey: string; payloadHash: string; sessionIdsJson: string } }) => {
        state.requests.set(keyFor(data.userId, data.requestKey), { ...data });
        return data;
      },
      update: async ({ where, data }: {
        where: { userId_requestKey: { userId: number; requestKey: string } };
        data: { sessionIdsJson: string };
      }) => {
        const { userId, requestKey } = where.userId_requestKey;
        const key = keyFor(userId, requestKey);
        const current = state.requests.get(key);
        if (!current) throw new Error('request missing');
        const updated = { ...current, ...data };
        state.requests.set(key, updated);
        return updated;
      },
    },
    block: { deleteMany: async () => ({ count: 0 }) },
    async $transaction(input: unknown) {
      if (typeof input !== 'function') return Promise.all(input as Promise<unknown>[]);
      const snapshot = {
        sessions: [...state.sessions],
        plans: [...state.plans],
        requests: new Map(state.requests),
        nextSessionId,
        nextPlanId,
      };
      try {
        return await (input as (tx: unknown) => Promise<unknown>)(db);
      } catch (error) {
        state.sessions.splice(0, state.sessions.length, ...snapshot.sessions);
        state.plans.splice(0, state.plans.length, ...snapshot.plans);
        state.requests.clear();
        for (const [key, value] of snapshot.requests) state.requests.set(key, value);
        nextSessionId = snapshot.nextSessionId;
        nextPlanId = snapshot.nextPlanId;
        throw error;
      }
    },
  };
  return { service: createAthletePlannerService({ db }), state };
}

test('athlete planner creates independent sessions for each selected date', async () => {
  const { service, state } = createPlacementHarness();
  const result = await service.saveSession(7, {
    dates: ['2026-08-24', '2026-08-26'],
    sport: 'RUNNING',
    title: 'Easy run',
    summary: 'Keep it relaxed',
    blocks: [{ kind: 'work', zone: 2, durationSec: 1800, sortOrder: 0 }],
  });

  assert.equal(result.ok, true);
  assert.equal(state.sessions.length, 2);
  assert.equal(state.plans.length, 1);
});

test('personal session saves copy block content without retaining source IDs or losing precision', async () => {
  const { service, state } = createPlacementHarness();
  const result = await service.saveSession(7, {
    dates: ['2026-08-24', '2026-08-26'],
    sport: 'RUNNING', title: 'Precise intervals',
    blocks: [
      {
        id: 999, kind: 'work', zone: 4, durationSec: 300, reps: 4, skipped: true,
        target: { metric: 'pace', mode: 'relative', reference: 'threshold-pace', low: 99.94, high: 100.25 },
        note: '  Controlled  ',
      },
      { kind: 'cooldown', zone: 1, durationSec: 300 },
    ],
  });
  assert.equal(result.ok, true);
  for (const session of state.sessions) {
    const blocks = (session.blocks as { create: Array<Record<string, unknown>> }).create;
    assert.equal(blocks.length, 2);
    assert.equal(Object.hasOwn(blocks[0], 'id'), false);
    assert.equal(blocks[0].targetLow, 100);
    assert.equal(blocks[0].targetHigh, 100);
    assert.equal(blocks[0].targetLowDecimal, '99.94');
    assert.equal(blocks[0].targetHighDecimal, '100.25');
    assert.equal(blocks[0].targetReference, 'threshold-pace');
    assert.equal(blocks[0].reps, 4);
    assert.equal(blocks[0].skipped, true);
    assert.equal(blocks[0].note, 'Controlled');
    assert.equal(blocks[0].sortOrder, 0);
  }
});

test('athlete planner places a saved workout atomically and replays the same request without duplicate writes', async () => {
  const { service, state } = createPlacementHarness();
  const input = {
    sourceKind: 'workout',
    sourceId: 4,
    dates: ['2026-08-24', '2026-08-26'],
    requestKey: 'placement-1',
  };

  const first = await service.assignSource(7, input);
  const replay = await service.assignSource(7, { ...input, dates: [...input.dates].reverse() });

  assert.deepEqual(first, { ok: true, sessionIds: [30, 31] });
  assert.deepEqual(replay, first);
  assert.equal(state.sessions.length, 2);
  assert.equal(state.requests.size, 1);
});

test('athlete planner rolls back every date and its request reservation when a later write fails', async () => {
  const { service, state } = createPlacementHarness({ failAtSession: 2 });

  await assert.rejects(
    service.assignSource(7, {
      sourceKind: 'workout',
      sourceId: 4,
      dates: ['2026-08-24', '2026-08-26'],
      requestKey: 'placement-failure',
    }),
    /simulated session write failure/,
  );

  assert.equal(state.sessions.length, 0);
  assert.equal(state.plans.length, 0);
  assert.equal(state.requests.size, 0);
});

test('athlete planner rejects reuse of a request key for a different payload', async () => {
  const { service, state } = createPlacementHarness();
  await service.assignSource(7, {
    sourceKind: 'workout', sourceId: 4, dates: ['2026-08-24'], requestKey: 'placement-conflict',
  });

  const conflict = await service.assignSource(7, {
    sourceKind: 'workout', sourceId: 4, dates: ['2026-08-25'], requestKey: 'placement-conflict',
  });

  assert.deepEqual(conflict, {
    ok: false,
    error: 'Something went wrong. Reload the page and try again.',
    status: 409,
  });
  assert.equal(state.sessions.length, 1);
});

test('placement keys are user-scoped and a new key permits an intentional repeat', async () => {
  const { service, state } = createPlacementHarness();
  const payload = { sourceKind: 'workout' as const, sourceId: 4, dates: ['2026-08-24'] };

  assert.equal((await service.assignSource(7, { ...payload, requestKey: 'shared-key' })).ok, true);
  assert.equal((await service.assignSource(8, { ...payload, requestKey: 'shared-key' })).ok, true);
  assert.equal((await service.assignSource(7, { ...payload, requestKey: 'new-key' })).ok, true);

  assert.equal(state.sessions.length, 3);
  assert.equal(state.requests.size, 3);
});

test('athlete placement stores a planned start time on every copy', async () => {
  const { service, state } = createPlacementHarness();
  const result = await service.assignSource(7, {
    sourceKind: 'workout',
    sourceId: 4,
    dates: ['2026-08-24', '2026-08-26'],
    requestKey: 'timed-placement',
    timeLabel: '07:30',
  });

  assert.deepEqual(result, { ok: true, sessionIds: [30, 31] });
  assert.deepEqual(state.sessions.map((session) => session.timeLabel), ['07:30', '07:30']);
});

test('athlete placement without a start time stores an untimed session', async () => {
  const { service, state } = createPlacementHarness();
  const result = await service.assignSource(7, {
    sourceKind: 'workout',
    sourceId: 4,
    dates: ['2026-08-24'],
    requestKey: 'untimed-placement',
    timeLabel: '',
  });

  assert.equal(result.ok, true);
  assert.equal(state.sessions[0].timeLabel, null);
});

test('athlete placement accepts boundary times and rejects anything outside 00:00-23:59 HH:mm before writing', async () => {
  const { service, state } = createPlacementHarness();
  const accepted = await service.assignSource(7, {
    sourceKind: 'workout', sourceId: 4, dates: ['2026-08-24'], requestKey: 'midnight', timeLabel: '00:00',
  });
  const lastMinute = await service.assignSource(7, {
    sourceKind: 'workout', sourceId: 4, dates: ['2026-08-25'], requestKey: 'last-minute', timeLabel: '23:59',
  });
  assert.equal(accepted.ok, true);
  assert.equal(lastMinute.ok, true);
  assert.deepEqual(state.sessions.map((session) => session.timeLabel), ['00:00', '23:59']);

  for (const timeLabel of ['24:00', '23:60', '7:30', '07:5', '0730', '07:30:00', '12:00 ', ' 12:00', 1230, 'noon']) {
    const result = await service.assignSource(7, {
      sourceKind: 'workout', sourceId: 4, dates: ['2026-08-27'], requestKey: `invalid-${String(timeLabel)}`, timeLabel,
    });
    assert.deepEqual(result, {
      ok: false,
      error: 'Enter a start time between 00:00 and 23:59.',
      status: 400,
    }, `expected ${String(timeLabel)} to be rejected`);
  }
  assert.equal(state.sessions.length, 2);
  assert.equal(state.requests.size, 2);
});

test('athlete placement replay with a different start time is a conflict, not a silent reuse', async () => {
  const { service, state } = createPlacementHarness();
  const payload = { sourceKind: 'workout' as const, sourceId: 4, dates: ['2026-08-24'], requestKey: 'time-conflict' };
  assert.equal((await service.assignSource(7, { ...payload, timeLabel: '07:30' })).ok, true);

  const conflict = await service.assignSource(7, { ...payload, timeLabel: '08:00' });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.status, 409);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].timeLabel, '07:30');
});

test('athlete planner rejects incomplete template ranges before any session write', async () => {
  const { service, state } = createPlacementHarness();
  const result = await service.assignSource(7, {
    sourceKind: 'template',
    sourceId: 9,
    dates: ['2026-08-27'],
    requestKey: 'template-range',
  });

  assert.equal(result.ok, false);
  assert.equal(state.sessions.length, 0);
  assert.equal(state.requests.size, 0);
});

test('athlete placement API and UI carry a stable retry key', async () => {
  const route = await readFile(path.join(process.cwd(), 'app/api/athlete/planner/assignments/route.ts'), 'utf8');
  const request = await readFile(path.join(process.cwd(), 'app/(app)/athlete/calendar/AddDialogFrame.tsx'), 'utf8');
  const workoutDialog = await readFile(path.join(process.cwd(), 'app/(app)/athlete/calendar/AddWorkoutDialog.tsx'), 'utf8');

  assert.match(route, /requestKey: body\.value\.requestKey/);
  assert.match(route, /timeLabel: body\.value\.timeLabel/);
  assert.match(request, /crypto\.randomUUID\(\)/);
  assert.match(request, /request\.current\?\.signature !== signature/);
  assert.match(request, /request\.current = null;/);
  // Start time is optional and tucked under More options.
  assert.match(workoutDialog, /More options/);
  assert.match(workoutDialog, /formLabelClassName\}>Start time<\/span>/);
  assert.match(workoutDialog, /parsePlannedTime\(startTime\.trim\(\)\)/);
  // The same workout may be planned more than once on a day; nothing warns about it.
  assert.doesNotMatch(workoutDialog, /Already planned/);
});


test('routine placement expands only selected weekdays, preserves source targets and replays safely', async () => {
  const entries = [0, 2, 4].map(weekday => ({ weekday, workoutId: 4, title: 'Easy run', sport: 'RUNNING', summary: null, sportMetricsJson: null,
    blocks: sourceBlocks.map(block => ({ ...block, targetType: 'pace', targetMode: 'relative', targetReference: 'profile-pace-zone-1', targetLow: 1, targetHigh: 1, targetLowDecimal: '1.00', targetHighDecimal: '1.00' })) }));
  entries.push(...[1, 3].map(weekday => ({ ...entries[0], weekday, title: 'Intervals' })));
  const { service, state } = createPlacementHarness({ routineJson: JSON.stringify({ version: 1, entries }) });
  const input = { sourceKind: 'template', sourceId: 9, requestKey: 'routine-week', dates: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'] };
  const result = await service.assignSource(7, input);
  assert.equal(result.ok, true);
  assert.deepEqual(state.sessions.map(session => session.title), ['Easy run', 'Intervals', 'Easy run', 'Intervals', 'Easy run']);
  assert.equal(state.sessions.length, 5);
  assert.equal((state.sessions[0].blocks as any).create[0].targetReference, 'profile-pace-zone-1');
  assert.deepEqual(await service.assignSource(7, input), result);
  assert.equal(state.sessions.length, 5);
});

test('routine placement repeats the week across several whole weeks and rejects broken ranges', async () => {
  const routineJson = JSON.stringify({ version: 1, entries: [0, 3].map(weekday => ({ weekday, workoutId: 4, title: 'Run', sport: 'RUNNING', summary: null, sportMetricsJson: null, blocks: sourceBlocks })) });
  const weeks = (count: number, start = '2026-10-05') => Array.from({ length: count * 7 }, (_, index) => {
    const date = new Date(`${start}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const { service, state } = createPlacementHarness({ routineJson });
  assert.equal((await service.assignSource(7, { sourceKind: 'template', sourceId: 9, requestKey: 'three-weeks', dates: weeks(3) })).ok, true);
  assert.deepEqual(state.sessions.map(session => (session.date as Date).toISOString().slice(0, 10)), [
    '2026-10-05', '2026-10-08', '2026-10-12', '2026-10-15', '2026-10-19', '2026-10-22',
  ]);
  for (const [requestKey, dates] of [
    ['too-long', weeks(13)],
    ['not-monday', weeks(2, '2026-10-06')],
    ['gap', [...weeks(1), ...weeks(1, '2026-10-19')]],
  ] as const) {
    assert.equal((await service.assignSource(7, { sourceKind: 'template', sourceId: 9, requestKey, dates: [...dates] })).ok, false);
  }
  assert.equal(state.sessions.length, 6);

  // 15 workouts a week for 12 weeks is over the per-request cap and adds nothing.
  const busyWeek = JSON.stringify({ version: 1, entries: Array.from({ length: 15 }, (_, index) => ({ weekday: index % 7, workoutId: 4, title: `Run ${index}`, sport: 'RUNNING', summary: null, sportMetricsJson: null, blocks: sourceBlocks })) });
  const busy = createPlacementHarness({ routineJson: busyWeek });
  const capped = await busy.service.assignSource(7, { sourceKind: 'template', sourceId: 9, requestKey: 'busy', dates: weeks(12) });
  assert.equal(capped.ok, false);
  assert.match(capped.ok ? '' : capped.error, /Choose fewer weeks/);
  assert.equal(busy.state.sessions.length, 0);
});

test('routine placement uses actual month weekdays and rolls back all sessions on failure', async () => {
  const routineJson = JSON.stringify({ version: 1, entries: [{ weekday: 0, workoutId: 4, title: 'Monday run', sport: 'RUNNING', summary: null, sportMetricsJson: null, blocks: sourceBlocks }] });
  const dates = Array.from({ length: 31 }, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`);
  const { service, state } = createPlacementHarness({ routineJson });
  assert.equal((await service.assignSource(7, { sourceKind: 'template', sourceId: 9, requestKey: 'routine-month', dates })).ok, true);
  assert.deepEqual(state.sessions.map(session => (session.date as Date).toISOString().slice(0, 10)), ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  const failing = createPlacementHarness({ routineJson, failAtSession: 2 });
  await assert.rejects(() => failing.service.assignSource(7, { sourceKind: 'template', sourceId: 9, requestKey: 'routine-failure', dates }));
  assert.equal(failing.state.sessions.length, 0);
  assert.equal(failing.state.requests.size, 0);
});

test('routine placement rejects malformed routines and incomplete periods without writes', async () => {
  const routineJson = JSON.stringify({ version: 1, entries: [{ weekday: 0, workoutId: 4, title: 'Monday', sport: 'RUNNING', blocks: sourceBlocks }] });
  const harness = createPlacementHarness({ routineJson });
  assert.equal((await harness.service.assignSource(7, { sourceKind: 'template', sourceId: 9, requestKey: 'partial', dates: ['2026-10-05'] })).ok, false);
  assert.equal(harness.state.sessions.length, 0);
  const broken = createPlacementHarness({ routineJson: '{broken' });
  assert.equal((await broken.service.assignSource(7, { sourceKind: 'template', sourceId: 9, requestKey: 'broken', dates: ['2026-10-05'] })).ok, false);
  assert.equal(broken.state.sessions.length, 0);
});

test('personal rescheduling persists calendar days, preserves content, and enforces boundaries in PostgreSQL', { skip: disposableDatabaseSkip }, async (t) => {
  const { format } = await import('date-fns');
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'Europe/Oslo';

  try {
    await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'self@example.test', role: 'ATHLETE' } });
    const other = await db.user.create({ data: { email: 'other@example.test', role: 'ATHLETE' } });
    const coach = await db.user.create({ data: { email: 'coach@example.test', role: 'COACH' } });
    const service = createAthletePlannerService({ db });
    const session = await db.session.create({ data: {
      athleteId: athlete.id,
      date: new Date('2026-03-28T07:15:00Z'),
      sport: 'RUNNING',
      title: 'Hill intervals',
      source: 'athlete-library-copy',
      timeLabel: '08:15',
      summary: 'Keep the recoveries easy',
      athleteNotes: 'Bring water',
      coachBaselineJson: '{"preserved":true}',
      blocks: { create: sourceBlocks },
    } });

    await t.test('cross-week DST move preserves local clock time and source content', async () => {
      const result = await service.rescheduleSession(athlete.id, session.id, { date: '2026-03-30' });
      assert.deepEqual(result, { ok: true, sessionId: session.id, date: '2026-03-30' });
      const saved = await db.session.findUniqueOrThrow({ where: { id: session.id }, include: { blocks: true, plan: true } });
      assert.ok(saved.date);
      assert.equal(format(saved.date, 'yyyy-MM-dd HH:mm'), '2026-03-30 08:15');
      assert.equal(saved.date.toISOString(), '2026-03-30T06:15:00.000Z');
      assert.equal(saved.timeLabel, '08:15');
      assert.equal(saved.title, session.title);
      assert.equal(saved.summary, session.summary);
      assert.equal(saved.athleteNotes, session.athleteNotes);
      assert.equal(saved.coachBaselineJson, session.coachBaselineJson);
      assert.equal(saved.blocks[0].durationSec, sourceBlocks[0].durationSec);
      assert.ok(saved.plan);
      assert.equal(format(saved.plan.startDate, 'yyyy-MM-dd'), '2026-03-30');
      assert.equal(format(saved.plan.endDate, 'yyyy-MM-dd'), '2026-04-05');
    });

    await t.test('impossible dates and another athlete cannot move the session or create weeks', async () => {
      const before = await db.session.findUniqueOrThrow({ where: { id: session.id } });
      const planCount = await db.plan.count();
      for (const date of ['2026-02-30', '2026-04-31', '2026-01-01T00:00:00Z', '', null]) {
        const result = await service.rescheduleSession(athlete.id, session.id, { date });
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.status, 400);
      }
      const foreign = await service.rescheduleSession(other.id, session.id, { date: '2026-04-20' });
      assert.equal(foreign.ok, false);
      if (!foreign.ok) assert.equal(foreign.status, 404);
      assert.deepEqual(await db.session.findUniqueOrThrow({ where: { id: session.id } }), before);
      assert.equal(await db.plan.count(), planCount);
    });

    await t.test('completed status and coach ownership stay immutable', async () => {
      for (const patch of [{ status: 'completed' }, { coachOwnerId: coach.id }, { assignedById: coach.id }]) {
        await db.session.update({ where: { id: session.id }, data: { status: 'planned', coachOwnerId: null, assignedById: null, ...patch } });
        const before = await db.session.findUniqueOrThrow({ where: { id: session.id } });
        const result = await service.rescheduleSession(athlete.id, session.id, { date: '2026-04-20' });
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.status, 409);
        assert.deepEqual(await db.session.findUniqueOrThrow({ where: { id: session.id } }), before);
      }
    });

    await t.test('an Activity prevents movement even if the session status is still planned', async () => {
      await db.session.update({ where: { id: session.id }, data: { status: 'planned', coachOwnerId: null, assignedById: null } });
      await db.activity.create({ data: {
        athleteId: athlete.id, sessionId: session.id,
        completedAt: new Date('2026-03-30T06:15:00Z'), durationSec: 1800, tss: 40,
        zoneDistributionJson: '[]', segmentsJson: '[]',
      } });
      const result = await service.rescheduleSession(athlete.id, session.id, { date: '2026-04-20' });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.status, 409);
      await db.activity.deleteMany({ where: { sessionId: session.id } });
    });

    await t.test('a negative UTC offset and fall DST still keep the chosen day and local time', async () => {
      process.env.TZ = 'America/New_York';
      try {
        await db.session.update({ where: { id: session.id }, data: { date: new Date('2026-10-31T12:15:00Z') } });
        const result = await service.rescheduleSession(athlete.id, session.id, { date: '2026-11-02' });
        assert.equal(result.ok, true);
        const saved = await db.session.findUniqueOrThrow({ where: { id: session.id }, include: { plan: true } });
        assert.ok(saved.date);
        assert.equal(format(saved.date, 'yyyy-MM-dd HH:mm'), '2026-11-02 08:15');
        assert.equal(saved.date.toISOString(), '2026-11-02T13:15:00.000Z');
        assert.ok(saved.plan);
        assert.equal(format(saved.plan.startDate, 'yyyy-MM-dd'), '2026-11-02');
        assert.equal(format(saved.plan.endDate, 'yyyy-MM-dd'), '2026-11-08');
      } finally {
        process.env.TZ = 'Europe/Oslo';
      }
    });

    await t.test('a missed self-planned session can be rescheduled and restored to planned', async () => {
      await db.session.update({ where: { id: session.id }, data: { status: 'missed' } });
      assert.equal((await service.rescheduleSession(athlete.id, session.id, { date: '2026-04-06' })).ok, true);
      assert.equal((await db.session.findUniqueOrThrow({ where: { id: session.id } })).status, 'planned');
    });

    await t.test('session deletion is owner-scoped and refuses completed or coach-assigned work', async () => {
      const foreign = await service.deleteSession(other.id, session.id);
      assert.deepEqual(foreign, { ok: false, error: 'Workout not found.', status: 404 });

      const source = await db.session.create({ data: {
        athleteId: athlete.id, date: null, sport: 'RUNNING', title: 'Saved workout', source: 'athlete-library',
      } });
      const sourceRefused = await service.deleteSession(athlete.id, source.id);
      assert.deepEqual(sourceRefused, {
        ok: false, error: 'Only planned workouts can be removed.', status: 409,
      });
      assert.ok(await db.session.findUnique({ where: { id: source.id } }));
      await db.session.delete({ where: { id: source.id } });

      for (const patch of [{ status: 'completed' }, { coachOwnerId: coach.id }, { assignedById: coach.id }]) {
        await db.session.update({ where: { id: session.id }, data: { status: 'planned', coachOwnerId: null, assignedById: null, ...patch } });
        const before = await db.session.findUniqueOrThrow({ where: { id: session.id } });
        const refused = await service.deleteSession(athlete.id, session.id);
        assert.equal(refused.ok, false);
        if (!refused.ok) assert.equal(refused.status, 409);
        assert.deepEqual(await db.session.findUniqueOrThrow({ where: { id: session.id } }), before);
      }

      await db.session.update({ where: { id: session.id }, data: { status: 'planned', coachOwnerId: null, assignedById: null } });
      await db.activity.create({ data: {
        athleteId: athlete.id, sessionId: session.id,
        completedAt: new Date('2026-04-06T06:15:00Z'), durationSec: 1800, tss: 40,
        zoneDistributionJson: '[]', segmentsJson: '[]',
      } });
      const activityRefused = await service.deleteSession(athlete.id, session.id);
      assert.equal(activityRefused.ok, false);
      if (!activityRefused.ok) assert.equal(activityRefused.status, 409);
      assert.ok(await db.session.findUnique({ where: { id: session.id } }));
      await db.activity.deleteMany({ where: { sessionId: session.id } });

      const deleted = await service.deleteSession(athlete.id, session.id);
      assert.deepEqual(deleted, { ok: true, sessionId: session.id });
      assert.equal(await db.session.findUnique({ where: { id: session.id } }), null);
      assert.equal(await db.block.count({ where: { sessionId: session.id } }), 0);
    });
    });
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('planner month view selects only activity summary fields and can skip the week query', async () => {
  const queries: Array<Record<string, any>> = [];
  const completed = {
    id: 71, athleteId: 5, templateId: null, date: new Date('2026-06-24T00:00:00.000Z'), timeLabel: '07:00',
    sport: 'CYCLING', title: 'Tempo ride', summary: null, status: 'completed', source: 'athlete', adjusted: false,
    sportMetricsJson: null, blocks: sourceBlocks,
    activity: { durationSec: 3605, distanceMeters: 30123.5, tss: 61, segmentsJson: '[]' },
    athlete: { performanceProfileJson: null },
  };
  const db: any = {
    session: { findMany: async (args: Record<string, any>) => { queries.push(args); return [completed]; } },
    template: { findMany: async () => [] },
  };
  const service = createAthletePlannerService({ db });

  const monthOnly = await service.loadWorkspace(5, '2026-06-25', { includeWeek: false });
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].include.activity, {
    select: { durationSec: true, distanceMeters: true, tss: true, segmentsJson: true },
  });
  assert.deepEqual(monthOnly.days, []);
  const entry = monthOnly.calendarDays.find((day) => day.isoDate === '2026-06-24')?.sessions[0];
  assert.deepEqual({ ...entry, blocks: undefined }, {
    id: 71, athleteId: 5, templateId: null, scheduledDate: '2026-06-24', timeLabel: '07:00', sport: 'CYCLING',
    title: 'Tempo ride', summary: null, status: 'completed', source: 'athlete', adjusted: false,
    sportMetricsJson: null, durationSec: 3605, distanceMeters: 30123.5, tss: 61, segments: [], blocks: undefined,
  });
  assert.equal(monthOnly.calendarDays.length, 35);

  queries.length = 0;
  const full = await service.loadWorkspace(5, '2026-06-25');
  assert.equal(queries.length, 2);
  assert.ok(queries.every((query) => query.include.activity.select.telemetryJson === undefined));
  assert.equal(full.days.length, 7);
  assert.equal(full.days[2].sessions[0].id, 71);
});
