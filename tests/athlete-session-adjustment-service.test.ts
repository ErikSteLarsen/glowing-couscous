import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createEmptySessionEditorDraft, addSessionEditorBlock } from '../lib/session-editor.ts';
import { createAthleteSessionAdjustmentService } from '../lib/athlete-session-adjustment-service.ts';
import { createAthleteCompletionService } from '../lib/athlete-completion-service.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

const baselineJson = JSON.stringify({
  snapshotVersion: 1,
  scheduledDate: '2026-08-24',
  sport: 'RUNNING',
  title: 'Coach baseline',
  summary: 'Original plan',
  coachNotes: 'Keep this controlled.',
  athleteNotes: null,
  rpe: null,
  sportMetrics: { ftp: null, thresholdPaceSecPerKm: null, thresholdHr: null },
  blocks: [
    {
      id: 4,
      kind: 'work',
      zone: 3,
      durationSec: 900,
      reps: null,
      targetType: null,
      targetLow: null,
      targetHigh: null,
      note: 'Original work',
      skipped: false,
      sortOrder: 0,
    },
  ],
});

function createDraft() {
  const draftWithSkippedBlock = addSessionEditorBlock(
    createEmptySessionEditorDraft({
      mode: 'planned',
      id: 40,
      athleteId: 7,
      scheduledDate: '2026-08-27',
      sport: 'RUNNING',
      title: 'Athlete-adjusted plan',
      summary: 'Shorter today',
      athleteNotes: 'Need to keep this easy.',
    }),
    { kind: 'work', zone: 2, durationSec: 600, skipped: true, note: 'Skip if tired' },
  );
  return addSessionEditorBlock(draftWithSkippedBlock, {
    kind: 'work',
    zone: 2,
    durationSec: 300,
    note: 'Active work',
  });
}

function createDb({
  activity = null as unknown,
  coachBaselineJson = baselineJson as string | null,
  assignedById = 2 as number | null,
  claimCount = 1,
} = {}) {
  const calls = {
    sessionUpdate: undefined as { data: Record<string, unknown> } | undefined,
    assignmentUpdate: undefined as { where: Record<string, unknown>; data: Record<string, unknown> } | undefined,
    deletedBlocks: undefined as unknown,
    claimWhere: undefined as Record<string, unknown> | undefined,
  };
  const db = {
    session: {
      async findUnique() {
        return {
          id: 40,
          athleteId: 7,
          coachOwnerId: null,
          trainingPlanId: null,
          planId: 10,
          templateId: 12,
          assignedById,
          date: new Date('2026-08-24T00:00:00.000Z'),
          planWeekday: null,
          timeLabel: null,
          sport: 'RUNNING',
          title: 'Coach baseline',
          summary: 'Original plan',
          coachNotes: 'Keep this controlled.',
          athleteNotes: null,
          sportMetricsJson: null,
          rpe: null,
          status: 'planned',
          updatedAt: new Date('2026-08-20T10:00:00.000Z'),
          source: 'template',
          adjusted: false,
          coachBaselineJson,
          blocks: [
            {
              id: 4,
              kind: 'work',
              zone: 3,
              durationSec: 900,
              reps: null,
              targetType: null,
              targetLow: null,
              targetHigh: null,
              note: 'Original work',
              skipped: false,
              sortOrder: 0,
            },
          ],
          activity,
        };
      },
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        calls.claimWhere = args.where;
        if (claimCount !== 1) return { count: claimCount };
        calls.sessionUpdate = { data: { ...args.data } };
        return { count: 1 };
      },
      async update(args: { data: Record<string, unknown> }) {
        calls.sessionUpdate = { data: { ...calls.sessionUpdate?.data, ...args.data } };
        return { id: 40 };
      },
    },
    plan: {
      async findFirst() {
        return { id: 11 };
      },
      async create() {
        return { id: 11 };
      },
    },
    block: {
      async deleteMany(args: unknown) {
        calls.deletedBlocks = args;
        return { count: 1 };
      },
    },
    assignment: {
      async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        calls.assignmentUpdate = args;
        return { count: 1 };
      },
    },
    async $transaction(run: (tx: unknown) => Promise<unknown>) {
      return run(db);
    },
  };
  return { db, calls };
}

test('athlete planned edits move one assigned session, mark it adjusted, and preserve the coach baseline', async () => {
  const { db, calls } = createDb();
  const service = createAthleteSessionAdjustmentService({ db: db as never });

  const result = await service.savePlannedSession(7, 40, { ...createDraft(), ignoredTransportField: true });

  assert.deepEqual(result, { ok: true, sessionId: 40 });
  assert.equal(calls.sessionUpdate?.data.adjusted, true);
  assert.equal(calls.sessionUpdate?.data.status, 'planned');
  assert.equal(calls.sessionUpdate?.data.templateId, 12);
  assert.equal(calls.sessionUpdate?.data.source, 'template');
  assert.equal(calls.sessionUpdate?.data.coachBaselineJson, baselineJson);
  assert.equal((calls.sessionUpdate?.data.date as Date).toISOString().slice(0, 10), '2026-08-27');
  assert.deepEqual(calls.assignmentUpdate?.where, { sessionId: 40, athleteId: 7 });
  assert.deepEqual(calls.assignmentUpdate?.data, { targetDate: new Date('2026-08-27T00:00:00.000Z') });
  assert.equal((calls.sessionUpdate?.data.blocks as { create: Array<{ skipped: boolean }> }).create[0].skipped, true);
});

test('self-planned edits leave baseline capture until completion so comparison reflects the final plan', async () => {
  const { db, calls } = createDb({ coachBaselineJson: null, assignedById: null });
  const service = createAthleteSessionAdjustmentService({ db: db as never });

  const result = await service.savePlannedSession(7, 40, createDraft());

  assert.deepEqual(result, { ok: true, sessionId: 40 });
  assert.equal(calls.sessionUpdate?.data.coachBaselineJson, null);
});

test('athlete planned edits enforce ownership and completed-session protection', async () => {
  const { db } = createDb();
  const service = createAthleteSessionAdjustmentService({ db: db as never });

  assert.deepEqual(await service.savePlannedSession(8, 40, createDraft()), {
    ok: false,
    status: 404,
    error: 'Session not found.',
  });

  const completed = createAthleteSessionAdjustmentService({ db: createDb({ activity: { id: 90 } }).db as never });
  assert.deepEqual(await completed.savePlannedSession(7, 40, createDraft()), {
    ok: false,
    status: 409,
    error: 'Completed sessions cannot be adjusted.',
  });
});

test('athlete planned edits claim the validated revision and refuse to overwrite a session that changed', async () => {
  const { db, calls } = createDb();
  const service = createAthleteSessionAdjustmentService({ db: db as never });
  assert.equal((await service.savePlannedSession(7, 40, createDraft())).ok, true);
  assert.deepEqual(calls.claimWhere, {
    id: 40,
    athleteId: 7,
    status: 'planned',
    updatedAt: new Date('2026-08-20T10:00:00.000Z'),
    activity: { is: null },
  });

  const raced = createDb({ claimCount: 0 });
  const racedService = createAthleteSessionAdjustmentService({ db: raced.db as never });
  const result = await racedService.savePlannedSession(7, 40, createDraft());
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.status, 409);
  assert.match(!result.ok ? result.error : '', /changed while you were editing/);
  assert.equal(raced.calls.deletedBlocks, undefined);
  assert.equal(raced.calls.sessionUpdate, undefined);
});

test('athlete planned edits reject create-mode drafts and invalid notes', async () => {
  const { db } = createDb();
  const service = createAthleteSessionAdjustmentService({ db: db as never });

  assert.deepEqual(await service.savePlannedSession(7, 40, { ...createDraft(), mode: 'create' }), {
    ok: false,
    status: 400,
    error: 'Planned session edits require planned mode.',
  });
  assert.deepEqual(await service.savePlannedSession(7, 40, { ...createDraft(), athleteNotes: 'x'.repeat(2001) }), {
    ok: false,
    status: 400,
    error: 'Notes are too long.',
  });
});

test('athlete planned-edit route stays a thin authenticated transport adapter', async () => {
  const source = await readFile(
    path.join(process.cwd(), 'app/api/athlete/sessions/[sessionId]/route.ts'),
    'utf8',
  );

  assert.match(source, /requireAthlete/);
  assert.match(source, /parsePositiveInteger/);
  assert.match(source, /readJsonObject/);
  assert.match(source, /athleteSessionAdjustmentService\.savePlannedSession/);
});

test('athlete session detail keeps the overview read-only, exposes the shared adjustment editor, and offers the workout chooser and links to its reusable source', async () => {
  const client = await readFile(
    path.join(process.cwd(), 'app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx'),
    'utf8',
  );
  const page = await readFile(
    path.join(process.cwd(), 'app/(app)/athlete/session/[sessionId]/page.tsx'),
    'utf8',
  );

  // The merged detail keeps the shared editor for planned adjustments and actual corrections.
  // The scheduled overview stays read-only (asserted below).
  assert.match(client, /WorkoutBuilder/);
  assert.match(client, /Adjust planned session/);
  assert.match(client, /showSchedule/);
  assert.match(client, /\/actual/);
  assert.match(client, /SessionComparisonDialog/);
  assert.match(page, /SessionWorkoutOverview/);
  const overview = await readFile(path.join(process.cwd(), 'components/SessionWorkoutOverview.tsx'), 'utf8');
  assert.match(overview, /Read-only scheduled copy/);
  assert.doesNotMatch(overview, /fetch\(|WorkoutBuilder/);
  assert.match(page, /<WorkoutStartChooser/);
  assert.match(page, /sourceWorkout/);
});


test('planned edits retain decimal prescriptions while writing integer legacy target fields', async () => {
  const { db, calls } = createDb();
  const service = createAthleteSessionAdjustmentService({ db: db as never });
  const draft = createDraft();
  draft.blocks[1].target = { metric: 'pace', mode: 'relative', reference: 'threshold-pace', low: 87.5, high: 92.5 };

  assert.equal((await service.savePlannedSession(7, 40, draft)).ok, true);
  assert.partialDeepStrictEqual(calls.sessionUpdate, { data: { blocks: { create: [
    { skipped: true },
    { targetLow: 88, targetHigh: 93, targetLowDecimal: '87.5', targetHighDecimal: '92.5', targetReference: 'threshold-pace', skipped: false },
  ] } } });
});

test('a planned edit that read the session before a completion committed cannot reopen it', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'edit-race@example.test', role: 'ATHLETE' } });
    const session = await db.session.create({ data: {
      athleteId: athlete.id,
      date: new Date('2026-08-24T00:00:00.000Z'),
      sport: 'RUNNING',
      title: 'Before edit',
      source: 'athlete',
      blocks: { create: [{ kind: 'work', zone: 3, durationSec: 900, sortOrder: 0 }] },
    } });

    // Hold the edit between its eligibility read and its write while the completion commits.
    let releaseEdit!: () => void;
    const editMayWrite = new Promise<void>((resolve) => { releaseEdit = resolve; });
    let editHasRead!: () => void;
    const editRead = new Promise<void>((resolve) => { editHasRead = resolve; });
    const pausedDb = new Proxy(db, {
      get(target, property, receiver) {
        if (property !== 'session') return Reflect.get(target, property, receiver);
        return new Proxy(target.session, {
          get(sessionTarget, method, sessionReceiver) {
            if (method !== 'findUnique') return Reflect.get(sessionTarget, method, sessionReceiver);
            return async (args: Parameters<typeof db.session.findUnique>[0]) => {
              const row = await sessionTarget.findUnique(args);
              editHasRead();
              await editMayWrite;
              return row;
            };
          },
        });
      },
    });

    const adjustment = createAthleteSessionAdjustmentService({ db: pausedDb as never });
    const completion = createAthleteCompletionService({ db: db as never });
    const draft = { ...createDraft(), id: session.id, athleteId: athlete.id, title: 'Edited' };

    const [edited, completed] = await Promise.all([
      adjustment.savePlannedSession(athlete.id, session.id, draft),
      (async () => {
        await editRead;
        const result = await completion.completeSession(athlete.id, session.id, {});
        releaseEdit();
        return result;
      })(),
    ]);

    assert.equal(completed.ok, true);
    assert.equal(edited.ok, false);
    assert.equal(!edited.ok && edited.status, 409);
    const stored = await db.session.findUniqueOrThrow({ where: { id: session.id }, include: { activity: true, blocks: true } });
    assert.equal(stored.status, 'completed');
    assert.ok(stored.activity);
    assert.notEqual(stored.title, 'Edited');
    assert.equal(stored.blocks.length, 1);
  });
});
