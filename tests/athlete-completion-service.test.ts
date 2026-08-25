import test from 'node:test';
import assert from 'node:assert/strict';

import { createAthleteCompletionService } from '../lib/athlete-completion-service.ts';

const blocks = [
  {
    id: 1,
    kind: 'warmup',
    zone: 1,
    durationSec: 600,
    reps: null,
    targetType: null,
    targetLow: null,
    targetHigh: null,
  },
  {
    id: 2,
    kind: 'work',
    zone: 4,
    durationSec: 900,
    reps: 2,
    targetType: 'power',
    targetLow: 240,
    targetHigh: 260,
  },
];

function createDb(session: Record<string, unknown> | null) {
  const calls = {
    activityUpsert: undefined as unknown,
    activityDelete: undefined as unknown,
    sessionUpdate: undefined as unknown,
  };
  const db = {
    session: {
      async findUnique() {
        return session;
      },
      async update(args: unknown) {
        calls.sessionUpdate = args;
        return { id: 11 };
      },
    },
    activity: {
      async upsert(args: unknown) {
        calls.activityUpsert = args;
        return { id: 20 };
      },
      async delete(args: unknown) {
        calls.activityDelete = args;
        return { id: 20 };
      },
    },
    async $transaction(operations: Promise<unknown>[]) {
      return Promise.all(operations);
    },
  };
  return { db, calls };
}

function createService(session: Record<string, unknown> | null) {
  const setup = createDb(session);
  return { service: createAthleteCompletionService({ db: setup.db as never }), calls: setup.calls };
}

function plannedSession(activity: Record<string, unknown> | null = null) {
  return {
    id: 11,
    athleteId: 7,
    athleteNotes: null,
    status: 'planned',
    blocks,
    activity,
  };
}

test('manual completion stores an estimate without fabricated compliance', async () => {
  const { service, calls } = createService(plannedSession());

  const result = await service.completeSession(7, 11, { notes: 'Controlled effort' });

  assert.equal(result.ok, true);
  assert.equal(calls.activityUpsert && (calls.activityUpsert as any).create.compliancePct, null);
  assert.equal(calls.activityUpsert && (calls.activityUpsert as any).create.metricsSource, 'manual-planned');
  assert.equal(typeof (calls.activityUpsert as any).create.segmentsJson, 'string');
  assert.equal(typeof (calls.activityUpsert as any).create.actualSnapshotJson, 'string');
  assert.equal((calls.activityUpsert as any).create.rpe, null);
  assert.deepEqual(calls.sessionUpdate, {
    where: { id: 11 },
    data: { status: 'completed', athleteNotes: 'Controlled effort' },
  });
});

test('completion is idempotent and updates the existing outcome instead of duplicating it', async () => {
  const completedAt = new Date('2026-08-21T08:00:00.000Z');
  const { service, calls } = createService(
    plannedSession({
      id: 20,
      completedAt,
      notes: 'Existing note',
      durationSec: 1500,
      tss: 44,
      compliancePct: null,
      zoneDistributionJson: '[]',
      segmentsJson: '[]',
      metricsSource: 'manual-planned',
    }),
  );

  const result = await service.completeSession(7, 11, {});

  assert.equal(result.ok, true);
  assert.equal((result as { completedAt: Date }).completedAt, completedAt);
  assert.equal((calls.activityUpsert as any).update.completedAt, completedAt);
  assert.equal((calls.activityUpsert as any).update.notes, 'Existing note');
  assert.equal(typeof (calls.activityUpsert as any).update.actualSnapshotJson, 'string');
  assert.equal((calls.activityUpsert as any).update.rpe, null);
});

test('reopen retains notes while removing the outcome and restoring planned status', async () => {
  const { service, calls } = createService(
    plannedSession({
      id: 20,
      completedAt: new Date('2026-08-21T08:00:00.000Z'),
      notes: 'Keep this context',
    }),
  );

  const result = await service.reopenSession(7, 11, {});

  assert.deepEqual(result, { ok: true, sessionId: 11, isDone: false, notes: 'Keep this context', completedAt: null });
  assert.deepEqual(calls.activityDelete, { where: { sessionId: 11 } });
  assert.deepEqual(calls.sessionUpdate, {
    where: { id: 11 },
    data: { status: 'planned', athleteNotes: 'Keep this context' },
  });
});

test('completion enforces ownership and bounded notes', async () => {
  const { service } = createService(plannedSession());
  assert.deepEqual(await service.completeSession(8, 11, {}), {
    ok: false,
    status: 404,
    error: 'Session not found',
  });
  assert.deepEqual(await service.completeSession(7, 11, { notes: 'x'.repeat(2001) }), {
    ok: false,
    status: 400,
    error: 'Notes are too long',
  });
});
