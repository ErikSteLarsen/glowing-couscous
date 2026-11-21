import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createAthleteCompletionService } from '../lib/athlete-completion-service.ts';
import { addSessionEditorBlock, createEmptySessionEditorDraft } from '../lib/session-editor.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

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
    activityUpdate: undefined as unknown,
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
      async update(args: unknown) {
        calls.activityUpdate = args;
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
    activity: activity && { metricsSource: 'manual-actual', ...activity },
    athlete: { coachId: 2 },
    ...overrides,
  };
}

function actualDraft() {
  return actualDraftFor(11, 7);
}

function actualDraftFor(id: number, athleteId: number) {
  return addSessionEditorBlock(
    createEmptySessionEditorDraft({
      mode: 'actual',
      id,
      athleteId,
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

test('manual completion preserves the scheduled date and stores an estimate without fabricated compliance', async () => {
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
  assert.equal((calls.sessionUpdate as any).data.date.toISOString(), '2026-08-24T00:00:00.000Z');
  assert.equal((calls.sessionUpdate as any).data.athleteNotes, 'Controlled effort');
  const baseline = JSON.parse((calls.sessionUpdate as any).data.coachBaselineJson);
  assert.equal(baseline.title, 'Planned session');
  assert.equal(baseline.blocks.length, 2);
  assert.equal(baseline.blocks[1].durationSec, 900);
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

test('legacy completed sessions without a baseline do not mislabel old actual data as the plan', async () => {
  const { service, calls } = createService(
    plannedSession(
      {
        id: 20,
        completedAt: new Date('2026-08-21T08:00:00.000Z'),
        notes: 'Legacy outcome',
      },
      { status: 'completed', coachBaselineJson: null, title: 'Already-recorded actual' },
    ),
  );

  const result = await service.saveActualOutcome({ role: 'ATHLETE', userId: 7 }, 11, actualDraft());

  assert.equal(result.ok, true);
  assert.equal((calls.sessionUpdate as any).data.coachBaselineJson, null);
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

test('actual outcome routes keep role guards while session detail stays read-only', async () => {
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
  const detailPage = await readFile(
    path.join(process.cwd(), 'app/(app)/athlete/session/[sessionId]/page.tsx'),
    'utf8',
  );

  assert.match(athleteRoute, /requireAthlete/);
  assert.match(athleteRoute, /saveActualOutcome/);
  assert.match(coachRoute, /requireCoach/);
  assert.match(coachRoute, /saveActualOutcome/);
  assert.match(detailClient, /SessionComparisonDialog/);
  // Planned completions keep the actual-correction editor; activity-derived outcomes
  // are read-only here and are corrected through their own forms.
  assert.match(detailClient, /isDone \? '\/actual' : ''/);
  assert.doesNotMatch(detailClient, /ManualActivityCorrectionForm/);
  assert.match(detailPage, /\['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'\]\.includes\(detail\.session\.metricsSource/);
});


test('actual corrections preserve decimal targets in snapshots and integer compatibility fields in rows', async () => {
  const { service, calls } = createService(plannedSession({ id: 20 }, { status: 'completed' }));
  const draft = actualDraft();
  draft.blocks[0].target = { metric: 'pace', mode: 'relative', reference: 'threshold-pace', low: 87.5, high: 92.5 };

  assert.equal((await service.saveActualOutcome({ role: 'ATHLETE', userId: 7 }, 11, draft)).ok, true);
  assert.partialDeepStrictEqual(calls.sessionUpdate, { data: { blocks: { create: [
    { targetLow: 88, targetHigh: 93, targetLowDecimal: '87.5', targetHighDecimal: '92.5', targetReference: 'threshold-pace' },
  ] } } });
  assert.ok(calls.activityUpsert && typeof calls.activityUpsert === 'object' && 'update' in calls.activityUpsert);
  const update = calls.activityUpsert.update;
  assert.ok(update && typeof update === 'object' && 'actualSnapshotJson' in update && typeof update.actualSnapshotJson === 'string');
  assert.partialDeepStrictEqual(JSON.parse(update.actualSnapshotJson), { blocks: [{ targetLow: 87.5, targetHigh: 92.5 }] });
});

test('updating the note on a recorded outcome keeps the recorded duration, source, measurements and load', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const coach = await db.user.create({ data: { email: 'recorded-coach@example.test', role: 'COACH' } });
    const athlete = await db.user.create({ data: { email: 'recorded@example.test', role: 'ATHLETE', coachId: coach.id } });
    const completedAt = new Date('2026-11-20T08:25:00.000Z');
    const session = await db.session.create({ data: {
      athleteId: athlete.id,
      date: new Date('2026-11-20T00:00:00.000Z'),
      sport: 'BIKING',
      title: 'Planned hour',
      source: 'athlete-planner',
      status: 'completed',
      blocks: { create: [{ kind: 'work', zone: 2, durationSec: 3600, sortOrder: 0 }] },
      activity: { create: {
        athleteId: athlete.id,
        completedAt,
        durationSec: 1500,
        tss: 21,
        distanceMeters: 12000,
        zoneDistributionJson: '{"2":1500}',
        segmentsJson: '[{"durationSec":1500}]',
        telemetryJson: '{"samples":[1,2,3]}',
        metricsSource: 'file-import',
      } },
    } });
    const service = createAthleteCompletionService({ db: db as never });

    const result = await service.completeSession(athlete.id, session.id, { notes: 'Legs were flat' });

    assert.equal(result.ok, true);
    const saved = await db.session.findUniqueOrThrow({ where: { id: session.id }, include: { activity: true, blocks: true } });
    assert.equal(saved.athleteNotes, 'Legs were flat');
    assert.equal(saved.blocks.length, 1);
    assert.equal(saved.blocks[0].durationSec, 3600);
    assert.partialDeepStrictEqual(saved.activity, {
      notes: 'Legs were flat',
      completedAt,
      durationSec: 1500,
      tss: 21,
      distanceMeters: 12000,
      zoneDistributionJson: '{"2":1500}',
      segmentsJson: '[{"durationSec":1500}]',
      telemetryJson: '{"samples":[1,2,3]}',
      metricsSource: 'file-import',
      actualSnapshotJson: null,
    });

    const reopen = await service.reopenSession(athlete.id, session.id, {});
    assert.equal(reopen.ok, false);
    assert.equal(!reopen.ok && reopen.status, 409);
    const coachCorrection = await service.saveActualOutcome({ role: 'COACH', userId: coach.id }, session.id, actualDraftFor(session.id, athlete.id));
    assert.equal(!coachCorrection.ok && coachCorrection.status, 409);
    const stillRecorded = await db.activity.findUniqueOrThrow({ where: { sessionId: session.id } });
    assert.equal(stillRecorded.durationSec, 1500);
    assert.equal(stillRecorded.metricsSource, 'file-import');
  });
});

test('recorded outcomes accept note-only updates and reject rebuilds, removal and replacement for every recorded source', async () => {
  for (const metricsSource of ['file-import', 'strava-import', 'tcx-import', 'fit-import', 'gpx-import', 'manual-paired']) {
    const completedAt = new Date('2026-08-24T08:25:00.000Z');
    const recorded = () => plannedSession({ completedAt, notes: null, metricsSource }, { status: 'completed' });
    const notesOnly = createService(recorded());
    const result = await notesOnly.service.completeSession(7, 11, { notes: 'Short ride' });
    assert.deepEqual(result, { ok: true, sessionId: 11, isDone: true, notes: 'Short ride', completedAt }, metricsSource);
    assert.deepEqual(notesOnly.calls.activityUpdate, { where: { sessionId: 11 }, data: { notes: 'Short ride' } });
    assert.deepEqual(notesOnly.calls.sessionUpdate, { where: { id: 11 }, data: { athleteNotes: 'Short ride' } });
    assert.equal(notesOnly.calls.activityUpsert, undefined);
    assert.equal(notesOnly.calls.blockDeleteMany, undefined);

    const reopen = createService(recorded());
    assert.equal((await reopen.service.reopenSession(7, 11, {}) as { status?: number }).status, 409);
    assert.equal(reopen.calls.activityDelete, undefined);

    for (const actor of [{ role: 'ATHLETE' as const, userId: 7 }, { role: 'COACH' as const, userId: 2 }]) {
      const replace = createService(recorded());
      assert.equal((await replace.service.saveActualOutcome(actor, 11, actualDraft()) as { status?: number }).status, 409);
      assert.equal(replace.calls.activityUpsert, undefined);
    }
    const foreignCoach = createService(recorded());
    assert.equal((await foreignCoach.service.saveActualOutcome({ role: 'COACH', userId: 99 }, 11, actualDraft()) as { status?: number }).status, 404);
    assert.equal((await createService(recorded()).service.completeSession(8, 11, { notes: 'x' }) as { status?: number }).status, 404);
  }
});
