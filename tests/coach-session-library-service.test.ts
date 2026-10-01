import test from 'node:test';
import assert from 'node:assert/strict';

import { createCoachSessionLibraryService } from '../lib/coach-session-library-service.ts';

const block = {
  clientId: 'b1',
  id: undefined,
  kind: 'work' as const,
  zone: 3 as const,
  durationSec: 1800,
  reps: null,
  targetType: null,
  targetMode: 'absolute' as const,
  targetReference: null,
  targetLow: null,
  targetHigh: null,
  targetLowDecimal: null,
  targetHighDecimal: null,
  note: 'Steady work',
};

test('coach session library lists standalone sessions without requiring athletes', async () => {
  const service = createCoachSessionLibraryService({
    db: {
      session: {
        async findMany() {
          return [
            {
              id: 41,
              coachOwnerId: 2,
              athleteId: null,
              trainingPlanId: null,
              date: new Date('2026-06-25T00:00:00.000Z'),
              planWeekday: null,
              sport: 'RUNNING',
              title: 'Coach long run',
              summary: 'Preview session',
              sportMetricsJson: null,
              source: 'coach-library',
              status: 'planned',
              adjusted: false,
              blocks: [],
            },
          ];
        },
      },
    } as never,
  });

  const sessions = await service.listForCoach(2);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].athleteId, null);
});

test('coach session library saves standalone sessions with coach ownership only', async () => {
  let createdPayload: Record<string, unknown> | undefined;

  const service = createCoachSessionLibraryService({
    db: {
      session: {
        async create(args: { data: Record<string, unknown> }) {
          createdPayload = args.data;
          return { id: 51 };
        },
      },
    } as never,
  });

  const result = await service.saveForCoach(2, {
    ownershipMode: 'coach-library',
    athleteId: null,
    scheduledDate: '2026-06-25',
    planWeekday: null,
    sport: 'RUNNING',
    title: 'Coach session',
    summary: '',
    sportMetrics: { ftp: null, thresholdPaceSecPerKm: 255, thresholdHr: 168 },
    blocks: [block],
  });

  assert.deepEqual(result, { ok: true, sessionId: 51 });
  assert.equal(createdPayload?.coachOwnerId, 2);
  assert.equal(createdPayload?.athleteId, null);
  assert.equal(createdPayload?.trainingPlanId, null);
});

test('coach session library deletes only coach-owned standalone sessions', async () => {
  let deletedId: number | undefined;

  const service = createCoachSessionLibraryService({
    db: {
      session: {
        async findFirst() {
          return { id: 41 };
        },
        async delete(args: { where: { id: number } }) {
          deletedId = args.where.id;
          return { id: args.where.id };
        },
      },
    } as never,
  });

  const result = await service.deleteForCoach(2, 41);
  assert.deepEqual(result, { ok: true, sessionId: 41 });
  assert.equal(deletedId, 41);
});

test('coach session library returns 404 when updating a session not owned by coach', async () => {
  let transactionCalled = false;

  const service = createCoachSessionLibraryService({
    db: {
      session: {
        async findFirst() { return null; },
        async update() { return {}; },
      },
      block: {
        async deleteMany() { return { count: 0 }; },
      },
      async $transaction(_ops: unknown) {
        transactionCalled = true;
        return [];
      },
    } as never,
  });

  const result = await service.saveForCoach(
    2,
    {
      ownershipMode: 'coach-library',
      athleteId: null,
      scheduledDate: '2026-06-25',
      planWeekday: null,
      sport: 'RUNNING',
      title: 'Coach session',
      summary: '',
      sportMetrics: { ftp: null, thresholdPaceSecPerKm: 255, thresholdHr: 168 },
      blocks: [block],
    },
    99,
  );

  assert.equal(result.ok, false);
  assert.equal((result as { ok: false; error: string; status: number }).status, 404);
  assert.equal(transactionCalled, false);
});

test('coach session library updates by session id only without coachOwnerId in where', async () => {
  let updateWhereArg: Record<string, unknown> | undefined;

  const service = createCoachSessionLibraryService({
    db: {
      session: {
        async findFirst() { return { id: 41 }; },
        async update(args: { where: Record<string, unknown> }) {
          updateWhereArg = args.where;
          return { id: 41 };
        },
      },
      block: {
        async deleteMany() { return { count: 0 }; },
      },
      async $transaction(ops: Promise<unknown>[]) {
        return Promise.all(ops);
      },
    } as never,
  });

  const result = await service.saveForCoach(
    2,
    {
      ownershipMode: 'coach-library',
      athleteId: null,
      scheduledDate: '2026-06-25',
      planWeekday: null,
      sport: 'RUNNING',
      title: 'Coach session',
      summary: '',
      sportMetrics: { ftp: null, thresholdPaceSecPerKm: 255, thresholdHr: 168 },
      blocks: [block],
    },
    41,
  );

  assert.deepEqual(result, { ok: true, sessionId: 41 });
  assert.equal(updateWhereArg?.id, 41);
  assert.equal(updateWhereArg?.coachOwnerId, undefined);
});

test('coach session library returns 404 when deleting a session not owned by coach', async () => {
  const service = createCoachSessionLibraryService({
    db: {
      session: {
        async findFirst() {
          return null;
        },
      },
    } as never,
  });

  const result = await service.deleteForCoach(2, 99);
  assert.equal(result.ok, false);
  assert.equal((result as { ok: false; error: string; status: number }).status, 404);
});

test('coach session library rejects save when no blocks are provided', async () => {
  const service = createCoachSessionLibraryService({
    db: { session: {} } as never,
  });

  const result = await service.saveForCoach(2, {
    ownershipMode: 'coach-library',
    athleteId: null,
    scheduledDate: '2026-06-25',
    planWeekday: null,
    sport: 'RUNNING',
    title: 'Session without blocks',
    summary: '',
    sportMetrics: { ftp: null, thresholdPaceSecPerKm: null, thresholdHr: null },
    blocks: [],
  });

  assert.equal(result.ok, false);
  assert.equal((result as { ok: false; error: string; status: number }).status, 400);
  assert.match((result as { ok: false; error: string; status: number }).error, /block/i);
});
