// Run explicitly with node --experimental-strip-types --test; excluded from the unit-test glob.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createWorkoutLibraryService } from '../lib/workout-library-service.ts';
import { createAccountService } from '../lib/account-service.ts';
import { createAccountExportService } from '../lib/account-export-service.ts';

const database = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '55432' || database.pathname !== '/tempo_acceptance') throw new Error('Acceptance requires the named disposable local PostgreSQL database.');
const db = new PrismaClient();
const draft = { sport: 'RUNNING', title: 'Concurrent save', summary: '', blocks: [{ kind: 'work', zone: 2, durationSec: 1200 }] };

test('PostgreSQL recovery: concurrent retry, revision conflict, rollback, account scope and revocation', async () => {
  const owner = await db.user.create({ data: { email: `recovery-${crypto.randomUUID()}@example.test`, name: 'Original', role: 'ATHLETE', prefsJson: '{"keep":"value"}' } });
  const other = await db.user.create({ data: { email: `other-${crypto.randomUUID()}@example.test`, name: 'Other', role: 'ATHLETE' } });
  try {
    const workouts = createWorkoutLibraryService({ db });
    const accounts = createAccountService({ db });
    const requestKey = crypto.randomUUID();
    const attempts = await Promise.all(Array.from({ length: 4 }, () => workouts.saveForOwner('athlete', owner.id, { ...draft, requestKey })));
    for (const attempt of attempts) assert.equal(attempt.ok, true);
    assert.equal(new Set(attempts.map((attempt) => attempt.ok && attempt.sessionId)).size, 1);
    assert.equal(await db.session.count({ where: { athleteId: owner.id } }), 1);
    assert.equal(await db.workoutSaveRequest.count({ where: { userId: owner.id } }), 1);
    const changed = await workouts.saveForOwner('athlete', owner.id, { ...draft, requestKey, title: 'Different' });
    assert.equal(changed.ok, false);
    const first = attempts[0]; if (!first.ok) throw new Error('Missing saved workout');
    const before = await db.session.findUniqueOrThrow({ where: { id: first.sessionId }, include: { blocks: true } });
    const edits = await Promise.all(['Edit A', 'Edit B'].map((title) => workouts.saveForOwner('athlete', owner.id, { ...draft, title, expectedUpdatedAt: before.updatedAt.toISOString() }, before.id)));
    assert.equal(edits.filter((edit) => edit.ok).length, 1);
    const current = await db.session.findUniqueOrThrow({ where: { id: before.id }, include: { blocks: true } });
    const failingDb = { ...db, session: db.session, $transaction: async (fn: (tx: unknown) => unknown) => db.$transaction(async (tx) => fn({ ...tx, session: { ...tx.session, update: async () => { throw new Error('Injected failure after block deletion'); } } })) };
    const failing = createWorkoutLibraryService({ db: failingDb as never });
    await assert.rejects(failing.saveForOwner('athlete', owner.id, { ...draft, title: 'Must roll back', expectedUpdatedAt: current.updatedAt.toISOString() }, current.id), /Injected failure/);
    const after = await db.session.findUniqueOrThrow({ where: { id: current.id }, include: { blocks: true } });
    assert.equal(after.title, current.title); assert.equal(after.updatedAt.toISOString(), current.updatedAt.toISOString()); assert.deepEqual(after.blocks, current.blocks);
    const invalidProfile = await accounts.updateProfile(owner.id, { name: 'Must not persist', performanceProfile: { heartRateMaxBpm: -1 } });
    assert.equal(invalidProfile.ok, false);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).name, 'Original');
    const userBefore = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    const profileEdits = await Promise.all(['Name A', 'Name B'].map((name) => accounts.updateProfile(owner.id, { name, expectedUpdatedAt: userBefore.updatedAt.toISOString() })));
    assert.equal(profileEdits.filter((edit) => edit.ok).length, 1);
    await db.session.create({ data: { athleteId: other.id, coachOwnerId: owner.id, title: 'Other person private session', athleteNotes: 'OTHER_PRIVATE_NOTE', sport: 'RUNNING', source: 'assigned' } });
    await db.session.create({ data: { athleteId: owner.id, title: 'PROVIDER_PRIVATE_TITLE', sport: 'RUNNING', source: 'activity-import', activity: { create: { athleteId: owner.id, completedAt: new Date(), durationSec: 60, tss: 0, zoneDistributionJson: '{}', segmentsJson: '[]', externalSource: 'STRAVA' } } } });
    const exported = await createAccountExportService({ db }).exportForUser(owner.id);
    assert.equal(exported.ok, true); if (exported.ok) { assert.equal(exported.json.includes('OTHER_PRIVATE_NOTE'), false); assert.equal(exported.json.includes('PROVIDER_PRIVATE_TITLE'), false); }
    await accounts.signOutEverywhere(owner.id);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).sessionVersion, 1);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: other.id } })).sessionVersion, 0);
    await db.session.delete({ where: { id: before.id } });
    assert.equal((await workouts.saveForOwner('athlete', owner.id, { ...draft, requestKey })).ok, false);
  } finally {
    await db.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    await db.$disconnect();
  }
});
