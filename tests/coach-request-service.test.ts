import test from 'node:test';
import assert from 'node:assert/strict';

import { createCoachRequestService } from '../lib/coach-request-service.ts';

function createRequestDb(overrides: Record<string, unknown> = {}) {
  const calls = {
    requestCreate: undefined as unknown,
    requestUpdate: [] as unknown[],
    requestUpdateMany: [] as unknown[],
    userUpdates: [] as unknown[],
  };
  const db = {
    user: {
      async findUnique(args: { where: { id: number }; select?: unknown }) {
        if (args.select) {
          return { role: 'ATHLETE', coachId: null, selfCoached: true };
        }
        return { id: args.where.id, role: 'COACH' };
      },
      async update(args: unknown) {
        calls.userUpdates.push(args);
        return { id: 7 };
      },
    },
    coachRequest: {
      async findMany() {
        return [];
      },
      async findFirst() {
        return null;
      },
      async findUnique() {
        return null;
      },
      async create(args: unknown) {
        calls.requestCreate = args;
        return { id: 9 };
      },
      async update(args: unknown) {
        calls.requestUpdate.push(args);
        return { id: 9 };
      },
      async updateMany(args: unknown) {
        calls.requestUpdateMany.push(args);
        return { count: 1 };
      },
    },
    async $transaction(operations: Promise<unknown>[]) {
      return Promise.all(operations);
    },
    ...overrides,
  };

  return { db, calls };
}

test('non-athletes cannot create coach requests', async () => {
  const { db } = createRequestDb({
    user: {
      async findUnique() {
        return { role: 'COACH', coachId: null, selfCoached: false };
      },
    },
  });
  const service = createAuthService(db);

  assert.deepEqual(await service.createForAthlete(7, 2), {
    ok: false,
    status: 403,
    error: 'Only athletes can ask a coach to join.',
  });
});

test('already-coached athletes cannot create new requests', async () => {
  const { db } = createRequestDb({
    user: {
      async findUnique() {
        return { role: 'ATHLETE', coachId: 3, selfCoached: false };
      },
    },
  });
  const service = createAuthService(db);

  assert.deepEqual(await service.createForAthlete(7, 2), {
    ok: false,
    status: 409,
    error: 'You already have a coach.',
  });
});

test('new and reopened requests carry the unique pending athlete key', async () => {
  const { db, calls } = createRequestDb();
  const service = createAuthService(db);

  assert.deepEqual(await service.createForAthlete(7, 2), { ok: true });
  assert.deepEqual(calls.requestCreate, {
    data: { athleteId: 7, coachId: 2, pendingAthleteId: 7, status: 'PENDING' },
  });

  const reopenDb = createRequestDb({
    coachRequest: {
      async findFirst() {
        return null;
      },
      async findUnique() {
        return { id: 9, athleteId: 7, coachId: 2, status: 'REJECTED' };
      },
      async update(args: unknown) {
        reopenDb.calls.requestUpdate.push(args);
        return { id: 9 };
      },
    },
  });
  const reopenService = createAuthService(reopenDb.db);
  assert.deepEqual(await reopenService.createForAthlete(7, 2), { ok: true });
  assert.deepEqual(reopenDb.calls.requestUpdate[0], {
    where: { id: 9 },
    data: { status: 'PENDING', pendingAthleteId: 7 },
  });
});

test('pending-key uniqueness races return a conflict', async () => {
  const { db } = createRequestDb({
    coachRequest: {
      async findFirst() {
        return null;
      },
      async findUnique() {
        return null;
      },
      async create() {
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      },
    },
  });
  const service = createAuthService(db);

  assert.deepEqual(await service.createForAthlete(7, 2), {
    ok: false,
    status: 409,
    error: 'You already have a request waiting for an answer.',
  });
});

test('accepting a request resolves competing pending requests atomically', async () => {
  const { db, calls } = createRequestDb({
    coachRequest: {
      async findUnique() {
        return { id: 9, athleteId: 7, coachId: 2, status: 'PENDING' };
      },
      async update(args: unknown) {
        calls.requestUpdate.push(args);
        return { id: 9 };
      },
      async updateMany(args: unknown) {
        calls.requestUpdateMany.push(args);
        return { count: 1 };
      },
    },
  });
  const service = createAuthService(db);

  assert.deepEqual(await service.decideForCoach(2, 9, 'accept'), { ok: true });
  assert.deepEqual(calls.requestUpdate[0], {
    where: { id: 9 },
    data: { status: 'ACCEPTED', pendingAthleteId: null },
  });
  assert.deepEqual(calls.requestUpdateMany[0], {
    where: { athleteId: 7, status: 'PENDING', id: { not: 9 } },
    data: { status: 'REJECTED', pendingAthleteId: null },
  });
  assert.deepEqual(calls.userUpdates[0], {
    where: { id: 7 },
    data: { coachId: 2, selfCoached: false },
  });
});

test('rejecting a pending request clears its pending key', async () => {
  const { db, calls } = createRequestDb({
    coachRequest: {
      async findUnique() {
        return { id: 9, athleteId: 7, coachId: 2, status: 'PENDING' };
      },
      async update(args: unknown) {
        calls.requestUpdate.push(args);
        return { id: 9 };
      },
    },
  });
  const service = createAuthService(db);

  assert.deepEqual(await service.decideForCoach(2, 9, 'reject'), { ok: true });
  assert.deepEqual(calls.requestUpdate[0], {
    where: { id: 9 },
    data: { status: 'REJECTED', pendingAthleteId: null },
  });
});

function createAuthService(db: unknown) {
  return createCoachRequestService({ db: db as never });
}
