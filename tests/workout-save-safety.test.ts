import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkoutLibraryService } from '../lib/workout-library-service.ts';

const draft = { sport: 'RUNNING', title: 'Recovery run', summary: '', blocks: [{ kind: 'work', zone: 2, durationSec: 1200 }], requestKey: '12345678-1234-1234-1234-123456789abc' };
const revision = new Date('2026-09-30T12:00:00Z');

test('new workout retry returns the original save and refuses changed or deleted content', async () => {
  let record: { id: number; payloadHash: string; sessionId: number | null } | null = null;
  let creates = 0; let available = true;
  const tx = {
    workoutSaveRequest: {
      async create({ data }: { data: { payloadHash: string } }) { record = { id: 1, ...data, sessionId: null }; return record; },
      async update({ data }: { data: { sessionId: number } }) { record!.sessionId = data.sessionId; },
    },
    session: { async create() { creates++; return { id: 12, updatedAt: revision }; } },
  };
  const db = { workoutSaveRequest: { async findUnique() { return record; } }, session: { async findFirst({ where }: { where: Record<string, unknown> }) { assert.equal(where.athleteId, 7); return available ? { id: 12, updatedAt: revision } : null; } }, async $transaction(fn: (client: typeof tx) => unknown) { return fn(tx); } };
  const service = createWorkoutLibraryService({ db: db as never });
  const first = await service.saveForOwner('athlete', 7, draft);
  assert.deepEqual(await service.saveForOwner('athlete', 7, draft), first);
  assert.equal(creates, 1);
  const changed = await service.saveForOwner('athlete', 7, { ...draft, title: 'Changed' });
  assert.equal(changed.ok, false); assert.equal(creates, 1);
  available = false;
  assert.equal((await service.saveForOwner('athlete', 7, draft)).ok, false);
});

test('workout revision conflicts leave blocks untouched, including a race after initial lookup', async () => {
  let deleted = false; let updated = false; let claims = 0;
  const tx = { session: { async updateMany({ where }: { where: Record<string, unknown> }) { claims++; assert.equal(where.athleteId, 7); assert.deepEqual(where.activity, { is: null }); return { count: 0 }; }, async update() { updated = true; } }, block: { async deleteMany() { deleted = true; } } };
  const db = { session: { async findFirst() { return { id: 12, updatedAt: revision, activity: null }; } }, async $transaction(fn: (client: typeof tx) => unknown) { return fn(tx); } };
  const service = createWorkoutLibraryService({ db: db as never });
  assert.equal((await service.saveForOwner('athlete', 7, { ...draft, expectedUpdatedAt: new Date(0).toISOString() }, 12)).ok, false);
  assert.equal(claims, 0);
  assert.equal((await service.saveForOwner('athlete', 7, { ...draft, expectedUpdatedAt: revision.toISOString() }, 12)).ok, false);
  assert.equal(claims, 1); assert.equal(deleted, false); assert.equal(updated, false);
});
