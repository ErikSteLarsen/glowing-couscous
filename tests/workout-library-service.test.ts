import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkoutLibraryService } from '../lib/workout-library-service.ts';

const validDraft = {
  sport: 'RUNNING',
  title: 'Steady run',
  summary: 'A standalone workout',
  templateId: null,
  scheduledDate: null,
  planWeekday: null,
  blocks: [
    {
      kind: 'work',
      zone: 3,
      durationSec: 1800,
      reps: null,
      target: null,
      note: 'Stay controlled',
    },
  ],
};

test('workout library only lists truly standalone sessions', async () => {
  let where: Record<string, unknown> | undefined;
  const service = createWorkoutLibraryService({
    db: {
      session: {
        async findMany(args: { where: Record<string, unknown> }) {
          where = args.where;
          return [];
        },
      },
    } as never,
  });

  await service.listForOwner('coach', 2);

  assert.deepEqual(where, {
    coachOwnerId: 2,
    athleteId: null,
    trainingPlanId: null,
    planId: null,
    date: null,
  });
});

test('workout library saves a source-owned standalone session', async () => {
  let createdData: Record<string, unknown> | undefined;
  const service = createWorkoutLibraryService({
    db: {
      session: {
        async create(args: { data: Record<string, unknown> }) {
          createdData = args.data;
          return { id: 12 };
        },
      },
    } as never,
  });

  const result = await service.saveForOwner('athlete', 7, validDraft);

  assert.deepEqual(result, { ok: true, sessionId: 12 });
  assert.equal(createdData?.athleteId, 7);
  assert.equal(createdData?.coachOwnerId, null);
  assert.equal(createdData?.planId, null);
  assert.equal(createdData?.trainingPlanId, null);
  assert.equal(createdData?.date, null);
});

test('workout library rejects a template owned by another user', async () => {
  let created = false;
  const service = createWorkoutLibraryService({
    db: {
      template: {
        async findFirst() {
          return null;
        },
      },
      session: {
        async create() {
          created = true;
          return { id: 13 };
        },
      },
    } as never,
  });

  const result = await service.saveForOwner('athlete', 7, {
    ...validDraft,
    templateId: 99,
  });

  assert.deepEqual(result, { ok: false, error: 'Template not found.', status: 404 });
  assert.equal(created, false);
});

test('workout library cannot edit a scheduled session as a standalone source', async () => {
  let lookup: Record<string, unknown> | undefined;
  const service = createWorkoutLibraryService({
    db: {
      session: {
        async findFirst(args: { where: Record<string, unknown> }) {
          lookup = args.where;
          return null;
        },
      },
    } as never,
  });

  const result = await service.saveForOwner('coach', 2, validDraft, 41);

  assert.deepEqual(result, { ok: false, error: 'Workout not found.', status: 404 });
  assert.equal(lookup?.date, null);
  assert.equal(lookup?.planId, null);
  assert.equal(lookup?.trainingPlanId, null);
});
