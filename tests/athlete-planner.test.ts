import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createAthletePlannerService } from '../lib/athlete-planner-service.ts';

const sourceBlocks = [{
  kind: 'work', zone: 3, durationSec: 1800, reps: null, targetType: null,
  targetMode: 'absolute', targetReference: null, targetLow: null, targetHigh: null,
  targetLowDecimal: null, targetHighDecimal: null, note: 'Main set', skipped: false, sortOrder: 0,
}];

function createPlacementHarness({ failAtSession }: { failAtSession?: number } = {}) {
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
    error: 'This placement key was already used for different dates or source content.',
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
  const planner = await readFile(path.join(process.cwd(), 'components/PlannerDesk.tsx'), 'utf8');

  assert.match(route, /requestKey: body\.value\.requestKey/);
  assert.match(planner, /crypto\.randomUUID\(\)/);
  assert.match(planner, /placementRequest\.current\?\.signature !== signature/);
  assert.match(planner, /if \(role === 'athlete'\) placementRequest\.current = null/);
});
test('personal rescheduling persists calendar days, preserves content, and enforces boundaries in SQLite', async (t) => {
  const { PrismaClient } = await import('@prisma/client');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  const { format } = await import('date-fns');
  const directory = await mkdtemp(path.join(tmpdir(), 'tempo-reschedule-'));
  const databaseUrl = `file:${path.join(directory, 'test.db')}`;
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'Europe/Oslo';

  try {
    execFileSync(process.execPath, [
      path.join(process.cwd(), 'node_modules/prisma/build/index.js'),
      'db', 'push', '--skip-generate', '--schema', path.join(process.cwd(), 'prisma/schema.prisma'),
    ], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });
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
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
