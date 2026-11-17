import test from 'node:test';
import assert from 'node:assert/strict';

import { createCoachTrainingPlanService } from '../lib/coach-training-plan-service.ts';

test('coach training plans create a reusable plan and weekday session', async () => {
  let planCreate: Record<string, unknown> | undefined;
  let sessionCreate: Record<string, unknown> | undefined;

  const service = createCoachTrainingPlanService({
    db: {
      trainingPlan: {
        async create(args: { data: Record<string, unknown> }) {
          planCreate = args.data;
          return { id: 71 };
        },
        async findFirst() {
          return { id: 71 };
        },
      },
      session: {
        async create(args: { data: Record<string, unknown> }) {
          sessionCreate = args.data;
          return { id: 72 };
        },
      },
    } as never,
  });

  const plan = await service.createPlan(2, { name: 'Base week', sport: 'RUNNING', extra: 'ignored' });
  const session = await service.savePlanSession(2, 71, {
    ownershipMode: 'training-plan',
    athleteId: null,
    scheduledDate: null,
    planWeekday: 3,
    sport: 'RUNNING',
    title: 'Wednesday tempo',
    summary: '',
    sportMetrics: { ftp: null, thresholdPaceSecPerKm: 255, thresholdHr: 168 },
    blocks: [
      {
        clientId: 'b1',
        kind: 'work',
        zone: 3,
        durationSec: 1800,
        reps: null,
        targetType: 'pace',
        targetMode: 'absolute',
        targetReference: null,
        targetLow: 254.5,
        targetHigh: 260.5,
        targetLowDecimal: null,
        targetHighDecimal: null,
        note: '',
        skipped: true,
      },
    ],
  });

  assert.deepEqual(plan, { ok: true, planId: 71 });
  assert.deepEqual(session, { ok: true, sessionId: 72 });
  assert.deepEqual(planCreate, { coachOwnerId: 2, name: 'Base week', summary: null, sport: 'RUNNING' });
  assert.equal(sessionCreate?.trainingPlanId, 71);
  assert.equal(sessionCreate?.planWeekday, 3);
  assert.equal(sessionCreate?.date, null);
  assert.partialDeepStrictEqual(sessionCreate, { blocks: { create: [{
    targetLow: 255, targetHigh: 261, targetLowDecimal: '254.5', targetHighDecimal: '260.5', skipped: true,
  }] } });
});

test('coach training plan update returns ok when coach owns plan', async () => {
  let updatedData: Record<string, unknown> | undefined;

  const service = createCoachTrainingPlanService({
    db: {
      trainingPlan: {
        async findFirst() {
          return { id: 71 };
        },
        async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
          updatedData = args.data;
          return { id: 71 };
        },
      },
    } as never,
  });

  const result = await service.updatePlan(2, 71, { name: 'Updated week', summary: 'New summary', sport: 'BIKING' });
  assert.deepEqual(result, { ok: true, planId: 71 });
  assert.equal(updatedData?.name, 'Updated week');
  assert.equal(updatedData?.sport, 'BIKING');
});

test('coach training plan update returns 404 when coach does not own plan', async () => {
  const service = createCoachTrainingPlanService({
    db: {
      trainingPlan: {
        async findFirst() {
          return null;
        },
      },
    } as never,
  });

  const result = await service.updatePlan(2, 999, { name: 'X', summary: '', sport: 'RUNNING' });
  assert.equal(result.ok, false);
  assert.equal((result as { ok: false; error: string; status: number }).status, 404);
});

test('coach training plan delete returns ok when coach owns plan', async () => {
  let deletedId: number | undefined;

  const service = createCoachTrainingPlanService({
    db: {
      trainingPlan: {
        async findFirst() {
          return { id: 71 };
        },
        async delete(args: { where: { id: number } }) {
          deletedId = args.where.id;
          return { id: args.where.id };
        },
      },
    } as never,
  });

  const result = await service.deletePlan(2, 71);
  assert.deepEqual(result, { ok: true, planId: 71 });
  assert.equal(deletedId, 71);
});

test('coach training plan delete returns 404 when coach does not own plan', async () => {
  const service = createCoachTrainingPlanService({
    db: {
      trainingPlan: {
        async findFirst() {
          return null;
        },
      },
    } as never,
  });

  const result = await service.deletePlan(2, 999);
  assert.equal(result.ok, false);
  assert.equal((result as { ok: false; error: string; status: number }).status, 404);
});

test('coach training plan session delete returns 404 when session not in plan', async () => {
  const service = createCoachTrainingPlanService({
    db: {
      session: {
        async findFirst() {
          return null;
        },
      },
    } as never,
  });

  const result = await service.deletePlanSession(2, 71, 999);
  assert.equal(result.ok, false);
  assert.equal((result as { ok: false; error: string; status: number }).status, 404);
});

test('coach training plan session save returns 404 when plan not owned by coach', async () => {
  const service = createCoachTrainingPlanService({
    db: {
      trainingPlan: {
        async findFirst() {
          return null;
        },
      },
      session: {
        async findFirst() {
          return null;
        },
      },
    } as never,
  });

  const result = await service.savePlanSession(2, 999, {
    ownershipMode: 'training-plan',
    athleteId: null,
    scheduledDate: null,
    planWeekday: 2,
    sport: 'RUNNING',
    title: 'Session',
    summary: '',
    sportMetrics: { ftp: null, thresholdPaceSecPerKm: null, thresholdHr: null },
    blocks: [
      {
        clientId: 'b1',
        kind: 'work',
        zone: 3,
        durationSec: 1800,
        reps: null,
        targetType: null,
        targetMode: 'absolute',
        targetReference: null,
        targetLow: null,
        targetHigh: null,
        targetLowDecimal: null,
        targetHighDecimal: null,
        note: '',
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal((result as { ok: false; error: string; status: number }).status, 404);
});

test('coach training plan session update uses $transaction and only { id } in where', async () => {
  let updateWhereArg: Record<string, unknown> | undefined;

  const service = createCoachTrainingPlanService({
    db: {
      trainingPlan: {
        async findFirst() {
          return { id: 71 };
        },
      },
      session: {
        async findFirst() {
          return { id: 72 };
        },
        async update(args: { where: Record<string, unknown> }) {
          updateWhereArg = args.where;
          return { id: 72 };
        },
      },
      block: {
        async deleteMany() {
          return { count: 0 };
        },
      },
      async $transaction(ops: Promise<unknown>[]) {
        return Promise.all(ops);
      },
    } as never,
  });

  const result = await service.savePlanSession(
    2,
    71,
    {
      ownershipMode: 'training-plan',
      athleteId: null,
      scheduledDate: null,
      planWeekday: 3,
      sport: 'RUNNING',
      title: 'Updated tempo',
      summary: '',
      sportMetrics: { ftp: null, thresholdPaceSecPerKm: null, thresholdHr: null },
      blocks: [
        {
          clientId: 'b1',
          kind: 'work',
          zone: 3,
          durationSec: 1800,
          reps: null,
          targetType: null,
          targetMode: 'absolute',
          targetReference: null,
          targetLow: null,
          targetHigh: null,
          targetLowDecimal: null,
          targetHighDecimal: null,
          note: '',
        },
      ],
    },
    72,
  );

  assert.deepEqual(result, { ok: true, sessionId: 72 });
  assert.equal(updateWhereArg?.id, 72);
  assert.equal(updateWhereArg?.coachOwnerId, undefined);
});
