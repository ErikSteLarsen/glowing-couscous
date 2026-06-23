import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createAssignmentService } from '../lib/assignment-service.ts';

const root = process.cwd();
const read = (relativePath: string) => readFile(path.join(root, relativePath), 'utf8');

test('assignment service creates an assigned session from a coach template', async () => {
  const calls: {
    planCreate?: {
      athleteId: number;
      name: string;
      startDate: Date;
      endDate: Date;
    };
    sessionCreate?: {
      athleteId: number;
      planId: number;
      templateId: number;
      assignedById: number;
      sport: string;
      title: string;
      summary: string | null;
      source: string;
      adjusted: boolean;
      blocks: {
        create: Array<{
          kind: string;
          zone: number;
          durationSec: number;
          reps: number | null;
          targetType: string | null;
          targetLow: number | null;
          targetHigh: number | null;
          note: string | null;
          sortOrder: number;
        }>;
      };
    };
    assignmentUpsert?: {
      where: { sessionId_athleteId: { sessionId: number; athleteId: number } };
      update: { assignedBy: number; assignedAt: Date };
      create: { sessionId: number; athleteId: number; assignedBy: number; assignedAt: Date };
    };
  } = {};

  const db = {
    user: {
      async findFirst(args: { where: { id: number; coachId: number; role: string } }) {
        assert.deepEqual(args.where, { id: 5, coachId: 2, role: 'ATHLETE' });
        return { id: 5, name: 'Mara Holt' };
      },
    },
    template: {
      async findFirst(args: { where: { id: number; ownerId: number }; include: { blocks: { orderBy: { sortOrder: 'asc' } } } }) {
        assert.equal(args.where.id, 7);
        assert.equal(args.where.ownerId, 2);
        return {
          id: 7,
          ownerId: 2,
          sport: 'RUNNING',
          name: 'Threshold 4×8′',
          summary: 'Controlled threshold session.',
          blocks: [
            {
              kind: 'warmup',
              zone: 1,
              durationSec: 720,
              reps: null,
              targetType: null,
              targetLow: null,
              targetHigh: null,
              note: '12 min easy',
              sortOrder: 0,
            },
            {
              kind: 'work',
              zone: 4,
              durationSec: 480,
              reps: 4,
              targetType: 'power',
              targetLow: 250,
              targetHigh: 265,
              note: 'Threshold reps',
              sortOrder: 1,
            },
          ],
        };
      },
    },
    plan: {
      async findFirst() {
        return null;
      },
      async create(args: {
        data: {
          athleteId: number;
          name: string;
          startDate: Date;
          endDate: Date;
        };
      }) {
        calls.planCreate = args.data;
        return { id: 11 };
      },
    },
    session: {
      async findFirst() {
        return null;
      },
      async create(args: {
        data: {
          athleteId: number;
          planId: number;
          templateId: number;
          assignedById: number;
          date: Date;
          timeLabel: string | null;
          sport: string;
          title: string;
          summary: string | null;
          status: string;
          source: string;
          adjusted: boolean;
          blocks: {
            create: Array<{
              kind: string;
              zone: number;
              durationSec: number;
              reps: number | null;
              targetType: string | null;
              targetLow: number | null;
              targetHigh: number | null;
              note: string | null;
              sortOrder: number;
            }>;
          };
        };
      }) {
        calls.sessionCreate = args.data;
        return { id: 13 };
      },
    },
    assignment: {
      async upsert(args: {
        where: { sessionId_athleteId: { sessionId: number; athleteId: number } };
        update: { assignedBy: number; assignedAt: Date };
        create: { sessionId: number; athleteId: number; assignedBy: number; assignedAt: Date };
      }) {
        calls.assignmentUpsert = args;
        return { id: 17 };
      },
    },
  };

  const assignedAt = new Date('2026-06-23T07:30:00.000Z');
  const assignmentService = createAssignmentService({
    db,
    now: () => assignedAt,
  });

  const result = await assignmentService.assignTemplateToAthlete({
    coachId: 2,
    athleteId: 5,
    templateId: 7,
    scheduledDate: '2026-06-25',
  });

  assert.deepEqual(result, { ok: true, sessionId: 13 });
  assert.equal(calls.planCreate?.athleteId, 5);
  assert.equal(calls.sessionCreate?.athleteId, 5);
  assert.equal(calls.sessionCreate?.planId, 11);
  assert.equal(calls.sessionCreate?.templateId, 7);
  assert.equal(calls.sessionCreate?.assignedById, 2);
  assert.equal(calls.sessionCreate?.source, 'template');
  assert.equal(calls.sessionCreate?.sport, 'RUNNING');
  assert.equal(calls.sessionCreate?.title, 'Threshold 4×8′');
  assert.equal(calls.sessionCreate?.blocks.create.length, 2);
  assert.equal(calls.assignmentUpsert?.where.sessionId_athleteId.sessionId, 13);
  assert.equal(calls.assignmentUpsert?.create.athleteId, 5);
  assert.equal(calls.assignmentUpsert?.create.assignedBy, 2);
  assert.equal(calls.assignmentUpsert?.create.assignedAt.toISOString(), assignedAt.toISOString());
});

test('builder route is backed by a real client and assignment API path', async () => {
  const builderPageSource = await read(['app/(app)/coach', 'builder', 'page.tsx'].join('/'));
  const builderClientSource = await read(['app/(app)/coach', 'builder', 'BuilderClient.tsx'].join('/'));
  const assignmentRouteSource = await read('app/api/coach/assignments/route.ts');

  assert.match(builderPageSource, /BuilderClient/);
  assert.match(builderPageSource, /athleteId\?: string/);
  assert.match(builderPageSource, /const initialAthleteId = Number\(athleteId\)/);
  assert.match(builderClientSource, /initialAthleteId: number \| null/);
  assert.doesNotMatch(builderPageSource, /still in progress|next migration slice/i);
  assert.match(builderClientSource, /isValid/);
  assert.match(assignmentRouteSource, /assignmentService\.assignTemplateToAthlete/);
  assert.match(assignmentRouteSource, /Number\.isInteger/);
});

test('assignment service reuses an existing matching scheduled session instead of creating a duplicate', async () => {
  let createdSession = false;

  const db = {
    user: {
      async findFirst() {
        return { id: 5, name: 'Mara Holt' };
      },
    },
    template: {
      async findFirst() {
        return {
          id: 7,
          ownerId: 2,
          sport: 'RUNNING',
          name: 'Threshold 4×8′',
          summary: 'Controlled threshold session.',
          blocks: [
            {
              kind: 'warmup',
              zone: 1,
              durationSec: 720,
              reps: null,
              targetType: null,
              targetLow: null,
              targetHigh: null,
              note: '12 min easy',
              sortOrder: 0,
            },
          ],
        };
      },
    },
    plan: {
      async findFirst() {
        return { id: 11 };
      },
      async create() {
        throw new Error('plan.create should not run when a matching plan exists');
      },
    },
    session: {
      async findFirst() {
        return { id: 13 };
      },
      async create() {
        createdSession = true;
        return { id: 14 };
      },
    },
    assignment: {
      async upsert() {
        return { id: 17 };
      },
    },
  };

  const assignmentService = createAssignmentService({
    db,
    now: () => new Date('2026-06-23T07:30:00.000Z'),
  });

  const result = await assignmentService.assignTemplateToAthlete({
    coachId: 2,
    athleteId: 5,
    templateId: 7,
    scheduledDate: '2026-06-25',
  });

  assert.deepEqual(result, { ok: true, sessionId: 13 });
  assert.equal(createdSession, false);
});
