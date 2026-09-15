import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createAthleteCompletionService } from '../lib/athlete-completion-service.ts';
import { addSessionEditorBlock, createEmptySessionEditorDraft } from '../lib/session-editor.ts';

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
    blockDeleteMany: undefined as unknown,
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
    block: {
      async deleteMany(args: unknown) {
        calls.blockDeleteMany = args;
        return { count: 1 };
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

function plannedSession(activity: Record<string, unknown> | null = null, overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    athleteId: 7,
    date: new Date('2026-08-24T00:00:00.000Z'),
    timeLabel: null,
    sport: 'RUNNING',
    title: 'Planned session',
    summary: null,
    coachNotes: null,
    athleteNotes: null,
    sportMetricsJson: null,
    rpe: null,
    status: 'planned',
    source: 'coach',
    adjusted: false,
    coachBaselineJson: null,
    blocks,
    activity,
    athlete: { coachId: 2 },
    ...overrides,
  };
}

function actualDraft() {
  return addSessionEditorBlock(
    createEmptySessionEditorDraft({
      mode: 'actual',
      id: 11,
      athleteId: 7,
      scheduledDate: '2026-08-24',
      sport: 'RUNNING',
      title: 'Actual corrected run',
      summary: 'Shorter than planned',
      athleteNotes: 'Stopped early for heat.',
      rpe: 9,
    }),
    { kind: 'work', zone: 4, durationSec: 300, note: 'Performed interval' },
  );
}

test('manual completion stores an estimate without fabricated compliance', async () => {
  const { service, calls } = createService(plannedSession());

  const result = await service.completeSession(7, 11, { notes: 'Controlled effort' });

  assert.equal(result.ok, true);
  assert.equal(calls.activityUpsert && (calls.activityUpsert as any).create.compliancePct, null);
  assert.equal(calls.activityUpsert && (calls.activityUpsert as any).create.metricsSource, 'manual-actual');
  assert.equal(typeof (calls.activityUpsert as any).create.segmentsJson, 'string');
  assert.equal(typeof (calls.activityUpsert as any).create.actualSnapshotJson, 'string');
  assert.equal((calls.activityUpsert as any).create.rpe, null);
  assert.equal((calls.sessionUpdate as any).where.id, 11);
  assert.equal((calls.sessionUpdate as any).data.status, 'completed');
  assert.equal((calls.sessionUpdate as any).data.athleteNotes, 'Controlled effort');
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

test('direct actual correction replaces Session blocks and Activity metrics while retaining completed status', async () => {
  const baselineJson = JSON.stringify({ title: 'Coach baseline' });
  const { service, calls } = createService(
    plannedSession(
      {
        id: 20,
        completedAt: new Date('2026-08-21T08:00:00.000Z'),
        notes: 'Existing note',
      },
      { status: 'completed', coachBaselineJson: baselineJson },
    ),
  );

  const result = await service.saveActualOutcome({ role: 'ATHLETE', userId: 7 }, 11, actualDraft());

  assert.equal(result.ok, true);
  assert.equal(calls.blockDeleteMany && (calls.blockDeleteMany as any).where.sessionId, 11);
  assert.equal((calls.activityUpsert as any).update.metricsSource, 'manual-actual');
  assert.equal(typeof (calls.activityUpsert as any).update.actualSnapshotJson, 'string');
  assert.equal((calls.activityUpsert as any).update.rpe, 9);
  assert.equal((calls.sessionUpdate as any).data.status, 'completed');
  assert.equal((calls.sessionUpdate as any).data.coachBaselineJson, baselineJson);
  assert.equal((calls.sessionUpdate as any).data.blocks.create[0].durationSec, 300);
});

test('actual correction permits the roster coach, rejects unrelated coaches, and validates actual drafts', async () => {
  const { service } = createService(plannedSession({ id: 20, completedAt: new Date('2026-08-21T08:00:00.000Z') }, { status: 'completed' }));

  assert.equal((await service.saveActualOutcome({ role: 'COACH', userId: 2 }, 11, actualDraft())).ok, true);
  assert.deepEqual(await service.saveActualOutcome({ role: 'COACH', userId: 99 }, 11, actualDraft()), {
    ok: false,
    status: 404,
    error: 'Session not found',
  });
  assert.deepEqual(await service.saveActualOutcome({ role: 'ATHLETE', userId: 7 }, 11, { ...actualDraft(), rpe: 11 }), {
    ok: false,
    status: 400,
    error: 'RPE must be an integer from 1 through 10.',
  });
});

test('actual outcome route adapters keep role guards and use the shared save command', async () => {
  const athleteRoute = await readFile(
    path.join(process.cwd(), 'app/api/athlete/sessions/[sessionId]/actual/route.ts'),
    'utf8',
  );
  const coachRoute = await readFile(
    path.join(process.cwd(), 'app/api/coach/sessions/[sessionId]/actual/route.ts'),
    'utf8',
  );
  const detailClient = await readFile(
    path.join(process.cwd(), 'app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx'),
    'utf8',
  );

  assert.match(athleteRoute, /requireAthlete/);
  assert.match(athleteRoute, /saveActualOutcome/);
  assert.match(coachRoute, /requireCoach/);
  assert.match(coachRoute, /saveActualOutcome/);
  assert.match(detailClient, /Correct completed outcome/);
  assert.match(detailClient, /\/actual/);
  assert.match(detailClient, /WorkoutBuilder/);
});
