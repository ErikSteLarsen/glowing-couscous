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
