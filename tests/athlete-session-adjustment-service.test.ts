import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createEmptySessionEditorDraft, addSessionEditorBlock } from '../lib/session-editor.ts';
import { createAthleteSessionAdjustmentService } from '../lib/athlete-session-adjustment-service.ts';

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
  return addSessionEditorBlock(
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
}

function createDb({
  activity = null as unknown,
  coachBaselineJson = baselineJson as string | null,
  assignedById = 2 as number | null,
} = {}) {
  const calls = {
    sessionUpdate: undefined as { data: Record<string, unknown> } | undefined,
    assignmentUpdate: undefined as { where: Record<string, unknown>; data: Record<string, unknown> } | undefined,
    deletedBlocks: undefined as unknown,
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
      async update(args: { data: Record<string, unknown> }) {
        calls.sessionUpdate = args;
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
    async $transaction(operations: Array<Promise<unknown>>) {
      return Promise.all(operations);
    },
  };
  return { db, calls };
}

test('athlete planned edits move one assigned session, mark it adjusted, and preserve the coach baseline', async () => {
  const { db, calls } = createDb();
  const service = createAthleteSessionAdjustmentService({ db: db as never });

  const result = await service.savePlannedSession(7, 40, createDraft());

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

test('athlete session detail is read-only and links to live execution and its reusable source', async () => {
  const client = await readFile(
    path.join(process.cwd(), 'app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx'),
    'utf8',
  );
  const page = await readFile(
    path.join(process.cwd(), 'app/(app)/athlete/session/[sessionId]/page.tsx'),
    'utf8',
  );

  assert.doesNotMatch(client, /WorkoutBuilder|Adjust planned session|showSchedule|\/actual/);
  assert.match(client, /SessionComparisonDialog/);
  assert.match(page, /SessionPlanCanvas/);
  assert.match(page, /Read-only scheduled copy/);
  assert.match(page, /Start live/);
  assert.match(page, /sourceWorkout/);
});
