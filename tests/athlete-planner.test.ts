import test from 'node:test';
import assert from 'node:assert/strict';

import { createAthletePlannerService } from '../lib/athlete-planner-service.ts';

test('athlete planner creates independent sessions for each selected date', async () => {
  const sessions: Array<Record<string, unknown>> = [];
  const plans: Array<{ id: number; athleteId: number; startDate: Date; endDate: Date }> = [];
  let nextSessionId = 10;
  let nextPlanId = 20;

  const service = createAthletePlannerService({
    db: {
      session: {
        findMany: async () => [],
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const id = nextSessionId++;
          sessions.push({ id, ...data });
          return { id };
        },
        update: async () => ({ id: 0 }),
        delete: async () => ({ id: 0 }),
      },
      template: {
        findMany: async () => [],
        findFirst: async () => null,
      },
      plan: {
        findFirst: async ({ where }: { where: { athleteId: number; startDate: Date; endDate: Date } }) =>
          plans.find(
            (plan) =>
              plan.athleteId === where.athleteId &&
              plan.startDate.getTime() === where.startDate.getTime() &&
              plan.endDate.getTime() === where.endDate.getTime(),
          ) ?? null,
        create: async ({ data }: { data: { athleteId: number; name: string; startDate: Date; endDate: Date } }) => {
          const plan = { id: nextPlanId++, ...data };
          plans.push(plan);
          return plan;
        },
      },
      block: {
        deleteMany: async () => ({ count: 0 }),
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    } as never,
  });

  const result = await service.saveSession(7, {
    dates: ['2026-08-24', '2026-08-26'],
    sport: 'RUNNING',
    title: 'Easy run',
    summary: 'Keep it relaxed',
    blocks: [{ kind: 'work', zone: 2, durationSec: 1800, sortOrder: 0 }],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.sessionIds.length, 2);
  assert.deepEqual(
    sessions.map((session) => session.date),
    [new Date('2026-08-24T00:00:00.000Z'), new Date('2026-08-26T00:00:00.000Z')],
  );
  assert.equal(sessions.every((session) => session.athleteId === 7), true);
  assert.equal(sessions.every((session) => session.coachOwnerId === null), true);
  assert.equal(plans.length, 1);
});

test('athlete planner places a saved workout without opening an editor', async () => {
  const sessions: Array<Record<string, unknown>> = [];
  let nextSessionId = 30;
  let nextPlanId = 40;
  const source = {
    id: 4,
    athleteId: 7,
    coachOwnerId: null,
    trainingPlanId: null,
    planId: null,
    date: null,
    timeLabel: null,
    sport: 'RUNNING',
    title: 'Saved intervals',
    summary: 'A reusable source',
    sportMetricsJson: '{"distanceKm":8}',
    blocks: [{
      kind: 'work', zone: 3, durationSec: 1800, reps: null, targetType: null,
      targetMode: 'absolute', targetReference: null, targetLow: null, targetHigh: null,
      targetLowDecimal: null, targetHighDecimal: null, note: 'Main set', skipped: false, sortOrder: 0,
    }],
  };
  const service = createAthletePlannerService({
    db: {
      session: {
        findMany: async () => [],
        findFirst: async ({ where }: { where: { id?: number } }) => where.id === source.id ? source : null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const id = nextSessionId++;
          sessions.push({ id, ...data });
          return { id };
        },
        update: async () => ({ id: 0 }),
        delete: async () => ({ id: 0 }),
      },
      template: { findMany: async () => [], findFirst: async () => null },
      plan: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => ({ id: nextPlanId++, ...data }),
      },
      block: { deleteMany: async () => ({ count: 0 }) },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    } as never,
  });

  const result = await service.assignSource(7, {
    sourceKind: 'workout',
    sourceId: source.id,
    dates: ['2026-08-24', '2026-08-26'],
  });

  assert.deepEqual(result, { ok: true, sessionIds: [30, 31] });
  assert.deepEqual(sessions.map((session) => session.date), [
    new Date('2026-08-24T00:00:00.000Z'),
    new Date('2026-08-26T00:00:00.000Z'),
  ]);
  assert.equal(sessions.every((session) => session.source === 'athlete-library-copy'), true);
  assert.equal(sessions.every((session) => session.title === source.title), true);
});

test('athlete planner rejects a single-date week template without writing', async () => {
  let createdDate: Date | null = null;
  const service = createAthletePlannerService({
    db: {
      session: {
        findMany: async () => [],
        findFirst: async () => null,
        create: async ({ data }: { data: { date: Date } }) => {
          createdDate = data.date;
          return { id: 50 };
        },
        update: async () => ({ id: 0 }),
        delete: async () => ({ id: 0 }),
      },
      template: {
        findMany: async () => [],
        findFirst: async () => ({
          id: 9,
          ownerId: 7,
          sport: 'CYCLING',
          name: 'Build week',
          cadence: 'week',
          summary: null,
          blocks: [{
            kind: 'work', zone: 2, durationSec: 1200, reps: null, targetType: null,
            targetMode: 'absolute', targetReference: null, targetLow: null, targetHigh: null,
            targetLowDecimal: null, targetHighDecimal: null, note: null, skipped: false, sortOrder: 0,
          }],
        }),
      },
      plan: {
        findFirst: async () => null,
        create: async () => ({ id: 60 }),
      },
      block: { deleteMany: async () => ({ count: 0 }) },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    } as never,
  });

  const result = await service.assignSource(7, { sourceKind: 'template', sourceId: 9, dates: ['2026-08-27'] });

  assert.equal(result.ok, false);
  assert.equal(createdDate, null);
});

test('athlete planner preserves an exact multi-day template range', async () => {
  const createdDates: Date[] = [];
  let nextSessionId = 70;
  const service = createAthletePlannerService({
    db: {
      session: {
        findMany: async () => [],
        findFirst: async () => null,
        create: async ({ data }: { data: { date: Date } }) => {
          createdDates.push(data.date);
          return { id: nextSessionId++ };
        },
        update: async () => ({ id: 0 }),
        delete: async () => ({ id: 0 }),
      },
      template: {
        findMany: async () => [],
        findFirst: async () => ({
          id: 9,
          ownerId: 7,
          sport: 'CYCLING',
          name: 'Build week',
          cadence: 'week',
          summary: null,
          blocks: [{
            kind: 'work', zone: 2, durationSec: 1200, reps: null, targetType: null,
            targetMode: 'absolute', targetReference: null, targetLow: null, targetHigh: null,
            targetLowDecimal: null, targetHighDecimal: null, note: null, skipped: false, sortOrder: 0,
          }],
        }),
      },
      plan: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => ({ id: Number(data.athleteId) + 60 }),
      },
      block: { deleteMany: async () => ({ count: 0 }) },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    } as never,
  });

  const result = await service.assignSource(7, {
    sourceKind: 'template',
    sourceId: 9,
    dates: ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(createdDates, [
    new Date('2026-08-24T00:00:00.000Z'),
    new Date('2026-08-25T00:00:00.000Z'),
    new Date('2026-08-26T00:00:00.000Z'),
    new Date('2026-08-27T00:00:00.000Z'),
    new Date('2026-08-28T00:00:00.000Z'),
    new Date('2026-08-29T00:00:00.000Z'),
    new Date('2026-08-30T00:00:00.000Z'),
  ]);
});

test('athlete planner rejects a template owned by another user', async () => {
  const service = createAthletePlannerService({
    db: {
      session: { findMany: async () => [], findFirst: async () => null, create: async () => ({ id: 1 }), update: async () => ({ id: 1 }), delete: async () => ({ id: 1 }) },
      template: { findMany: async () => [], findFirst: async () => null },
      plan: { findFirst: async () => null, create: async () => ({ id: 1 }) },
      block: { deleteMany: async () => ({ count: 0 }) },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    } as never,
  });

  const result = await service.saveSession(7, {
    dates: ['2026-08-24'],
    templateId: 99,
    sport: 'RUNNING',
    title: 'Copied session',
    blocks: [{ kind: 'work', zone: 2, durationSec: 900, sortOrder: 0 }],
  });

  assert.deepEqual(result, { ok: false, error: 'Template not found.', status: 404 });
});
