import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'date-fns';

import { createAssignmentService } from '../lib/assignment-service.ts';

const block = {
  kind: 'work',
  zone: 3,
  durationSec: 900,
  reps: null,
  targetType: null,
  targetLow: null,
  targetHigh: null,
  note: 'Steady',
  sortOrder: 0,
};

function createSourceDb() {
  const state = {
    copiedSessionId: 40,
    sourceAssignment: null as { sessionId: number } | null,
    sessionsCreated: [] as unknown[],
    assignmentsCreated: [] as unknown[],
    parentCreated: [] as unknown[],
  };
  const sourceSession = {
    id: 12,
    sport: 'RUNNING',
    title: 'Library threshold',
    summary: 'Controlled work',
    sportMetricsJson: null,
    timeLabel: '07:00',
    planWeekday: null,
    blocks: [block],
  };
  const sourcePlan = {
    id: 22,
    name: 'Build plan',
    sessions: [
      { ...sourceSession, id: 31, title: 'Monday run', planWeekday: 1 },
      { ...sourceSession, id: 32, title: 'Wednesday run', planWeekday: 3 },
    ],
  };
  const db = {
    user: {
      async findFirst() {
        return { id: 7 };
      },
    },
    session: {
      async findFirst() {
        return sourceSession;
      },
      async create(args: unknown) {
        state.sessionsCreated.push(args);
        return { id: state.copiedSessionId++ };
      },
    },
    plan: {
      async findFirst() {
        return { id: 90 };
      },
      async create() {
        return { id: 90 };
      },
    },
    assignment: {
      async findFirst() {
        return state.sourceAssignment;
      },
      async create(args: unknown) {
        state.assignmentsCreated.push(args);
        const data = (args as { data: { sessionId: number } }).data;
        state.sourceAssignment = { sessionId: data.sessionId };
      },
    },
    trainingPlan: {
      async findFirst() {
        return sourcePlan;
      },
    },
    trainingPlanAssignment: {
      async findUnique() {
        return null;
      },
      async create(args: unknown) {
        state.parentCreated.push(args);
        return { id: 77 };
      },
    },
    async $transaction<T>(callback: (tx: typeof db) => Promise<T>) {
      return callback(db);
    },
  };
  return { db, state };
}

test('library-session assignment snapshots blocks and is idempotent', async () => {
  const { db, state } = createSourceDb();
  const service = createAssignmentService({ db: db as never });

  const result = await service.assignSourceToAthlete({
    coachId: 2,
    athleteId: 7,
    source: { kind: 'library-session', sessionId: 12 },
    scheduledDate: '2026-08-24',
  });
  assert.deepEqual(result, { ok: true, sessionId: 40 });
  assert.equal(state.sessionsCreated.length, 1);
  assert.deepEqual((state.sessionsCreated[0] as { data: { title: string; blocks: { create: unknown[] } } }).data.blocks.create, [block]);
  assert.equal((state.assignmentsCreated[0] as { data: { sourceSessionId: number } }).data.sourceSessionId, 12);

  const reused = await service.assignSourceToAthlete({
    coachId: 2,
    athleteId: 7,
    source: { kind: 'library-session', sessionId: 12 },
    scheduledDate: '2026-08-24',
  });
  assert.deepEqual(reused, { ok: true, sessionId: 40 });
  assert.equal(state.sessionsCreated.length, 1);
});

test('training-plan assignment maps weekdays and creates a parent lineage record', async () => {
  const { db, state } = createSourceDb();
  const service = createAssignmentService({ db: db as never });

  const result = await service.assignSourceToAthlete({
    coachId: 2,
    athleteId: 7,
    source: { kind: 'training-plan', trainingPlanId: 22 },
    weekStart: '2026-08-26',
  });
  assert.deepEqual(result, { ok: true, sessionIds: [40, 41] });
  assert.equal(state.parentCreated.length, 1);
  assert.equal(format((state.sessionsCreated[0] as { data: { date: Date } }).data.date, 'yyyy-MM-dd'), '2026-08-24');
  assert.equal(format((state.sessionsCreated[1] as { data: { date: Date } }).data.date, 'yyyy-MM-dd'), '2026-08-26');
  assert.equal((state.assignmentsCreated[1] as { data: { trainingPlanAssignmentId: number } }).data.trainingPlanAssignmentId, 77);
});

test('assignment route exposes the source union through one coach-only command', async () => {
  const source = await readFile(path.join(process.cwd(), 'app/api/coach/assignments/route.ts'), 'utf8');
  assert.match(source, /assignSourceToAthlete/);
  assert.match(source, /library-session/);
  assert.match(source, /training-plan/);
  assert.match(source, /requireCoach/);
});
