import test from 'node:test';
import assert from 'node:assert/strict';
import { format } from 'date-fns';

import { createCoachPlannerService } from '../lib/coach-planner-service.ts';

const block = {
  id: 1,
  kind: 'work',
  zone: 3,
  durationSec: 1800,
  reps: null,
  targetType: null,
  targetLow: null,
  targetHigh: null,
  note: 'Steady',
  sortOrder: 0,
};

test('coach planner loads roster, templates, and a Monday-first visible week', async () => {
  const service = createCoachPlannerService({
    db: {
      user: {
        async findMany(args: { where: { coachId: number; role: string }; orderBy: { name: string } }) {
          assert.deepEqual(args.where, { coachId: 2, role: 'ATHLETE' });
          return [{ id: 5, name: 'Mara Holt', email: 'mara@example.com' }];
        },
      },
      template: {
        async findMany() {
          return [{ id: 9, sport: 'RUNNING', name: 'Easy aerobic', summary: null, blocks: [block] }];
        },
      },
      session: {
        async findMany(args: { where: { athlete: { coachId: number }; date: { gte: Date; lte: Date } } }) {
          assert.equal(args.where.athlete.coachId, 2);
          assert.equal(format(args.where.date.gte, 'yyyy-MM-dd'), '2026-06-22');
          assert.equal(format(args.where.date.lte, 'yyyy-MM-dd'), '2026-06-28');
          return [
            {
              id: 12,
              athleteId: 5,
              templateId: null,
              assignedById: 2,
              date: new Date('2026-06-25T00:00:00.000Z'),
              timeLabel: null,
              sport: 'RUNNING',
              title: 'Endurance',
              summary: 'Steady',
              status: 'planned',
              source: 'coach',
              adjusted: false,
              blocks: [block],
            },
          ];
        },
      },
    } as never,
  });

  const view = await service.loadWorkspace(2, '2026-06-25');

  assert.equal(view.athletes[0].id, 5);
  assert.equal(view.templates[0].id, 9);
  assert.equal(view.days.length, 7);
  assert.equal(view.days[0].isoDate, '2026-06-22');
  assert.equal(view.days[3].sessions[0].id, 12);
  assert.equal(view.days[3].sessions[0].durationSec, 1800);
});

test('coach planner creates a direct coach session and assignment record', async () => {
  const calls: {
    planCreate?: unknown;
    sessionCreate?: {
      athleteId: number;
      planId: number;
      templateId: number | null;
      assignedById: number;
      sport: string;
      title: string;
      source: string;
      blocks: { create: Array<{ kind: string; zone: number; durationSec: number; sortOrder: number }> };
    };
    assignmentUpsert?: unknown;
  } = {};

  const service = createCoachPlannerService({
    db: {
      user: {
        async findFirst(args: { where: { id: number; coachId: number; role: string } }) {
          assert.deepEqual(args.where, { id: 5, coachId: 2, role: 'ATHLETE' });
          return { id: 5 };
        },
      },
      plan: {
        async findFirst() {
          return null;
        },
        async create(args: unknown) {
          calls.planCreate = args;
          return { id: 77 };
        },
      },
      session: {
        async create(args: {
          data: NonNullable<typeof calls.sessionCreate> & {
            date: Date;
            summary: string | null;
            status: string;
            adjusted: boolean;
            timeLabel: string | null;
          };
        }) {
          calls.sessionCreate = args.data;
          return { id: 88 };
        },
      },
      assignment: {
        async upsert(args: unknown) {
          calls.assignmentUpsert = args;
          return { id: 99 };
        },
      },
    } as never,
    now: () => new Date('2026-06-23T12:00:00.000Z'),
  });

  const result = await service.saveSession(2, {
    athleteId: 5,
    scheduledDate: '2026-06-25',
    sport: 'RUNNING',
    title: 'Endurance build',
    summary: 'Keep it smooth.',
    sourceTemplateId: null,
    blocks: [{ ...block, clientId: 'b1' }],
  });

  assert.deepEqual(result, { ok: true, sessionId: 88 });
  assert.ok(calls.planCreate);
  assert.equal(calls.sessionCreate?.athleteId, 5);
  assert.equal(calls.sessionCreate?.planId, 77);
  assert.equal(calls.sessionCreate?.assignedById, 2);
  assert.equal(calls.sessionCreate?.source, 'coach');
  assert.equal(calls.sessionCreate?.blocks.create[0].sortOrder, 0);
  assert.ok(calls.assignmentUpsert);
});

test('coach planner updates only sessions owned by roster athletes', async () => {
  let deletedBlocks = false;
  let updatedSession = false;
  const service = createCoachPlannerService({
    db: {
      session: {
        async findUnique() {
          return { id: 88, athleteId: 5, adjusted: true };
        },
        async update() {
          updatedSession = true;
          return { id: 88 };
        },
      },
      user: {
        async findFirst() {
          return { id: 5 };
        },
      },
      plan: {
        async findFirst() {
          return { id: 77 };
        },
        async create() {
          throw new Error('plan.create should not run when a plan exists');
        },
      },
      block: {
        async deleteMany() {
          deletedBlocks = true;
          return { count: 1 };
        },
      },
      assignment: {
        async upsert() {
          return { id: 99 };
        },
      },
      $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    } as never,
  });

  const result = await service.saveSession(
    2,
    {
      athleteId: 5,
      scheduledDate: '2026-06-25',
      sport: 'RUNNING',
      title: 'Edited endurance',
      summary: '',
      sourceTemplateId: null,
      blocks: [{ ...block, clientId: 'b1', durationSec: 2400 }],
    },
    88,
  );

  assert.deepEqual(result, { ok: true, sessionId: 88 });
  assert.equal(deletedBlocks, true);
  assert.equal(updatedSession, true);
});

test('coach planner deletes only sessions owned by roster athletes', async () => {
  let deletedSessionId: number | undefined;
  const service = createCoachPlannerService({
    db: {
      session: {
        async findUnique(args: { where: { id: number } }) {
          assert.deepEqual(args.where, { id: 88 });
          return { id: 88, athleteId: 5, athlete: { coachId: 2 } };
        },
        async delete(args: { where: { id: number } }) {
          deletedSessionId = args.where.id;
          return { id: args.where.id };
        },
      },
    } as never,
  });

  const result = await service.deleteSession(2, 88);

  assert.deepEqual(result, { ok: true, sessionId: 88 });
  assert.equal(deletedSessionId, 88);
});
