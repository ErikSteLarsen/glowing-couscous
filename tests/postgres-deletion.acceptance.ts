// Explicit integration acceptance: synthetic accounts in the named disposable DB only.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createAccountDeletionService } from '../lib/account-deletion-service.ts';
import { createShareLinkService } from '../lib/share-link-service.ts';
import { createSessionSnapshotJson } from '../lib/session-snapshot-service.ts';
import { stravaService } from '../lib/strava-service.ts';

const database = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '55432' || database.pathname !== '/tempo_acceptance') throw new Error('Deletion acceptance requires the named disposable local PostgreSQL database.');
const db = new PrismaClient();
const ids: number[] = [];
const linkIds: number[] = [];
const password = 'Disposable-test-password';
const passwordHash = await bcrypt.hash(password, 4);
const identity = { sessionVersion: 0 };
const input = { confirmation: 'DELETE', password };
async function user(withPassword = true) {
  const result = await db.user.create({ data: { email: `deletion-${crypto.randomUUID()}@example.test`, name: 'PRIVATE_NAME', role: 'ATHLETE', passwordHash: withPassword ? passwordHash : null, image: 'PRIVATE_IMAGE', prefsJson: '{"private":"preferences"}', performanceProfileJson: '{"private":"health"}' } });
  ids.push(result.id); return result;
}
async function session(athleteId: number) {
  return db.session.create({ data: { athleteId, sport: 'RUNNING', title: 'PRIVATE_NAME workout', summary: 'PRIVATE_EMAIL', source: 'personal', blocks: { create: { kind: 'work', zone: 2, durationSec: 300, reps: 2, note: 'PRIVATE_ADDRESS', sortOrder: 0 } } } });
}
after(async () => {
  await db.shareLink.deleteMany({ where: { id: { in: linkIds } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

test('account erasure retains anonymized shares and independent copies, removes credentials and provider records', async () => {
  const owner = await user(); const other = await user();
  const source = await session(owner.id); const independent = await session(other.id);
  const shares = createShareLinkService({ db });
  const link = await shares.createForUser(owner.id, 'session', source.id); assert.ok(link.ok);
  const savedLink = await db.shareLink.findFirstOrThrow({ where: { sessionId: source.id } }); linkIds.push(savedLink.id);
  const token = link.url.slice('/share/'.length);
  const providerId = crypto.randomUUID();
  await db.account.create({ data: { userId: owner.id, type: 'oauth', provider: 'google', providerAccountId: providerId, access_token: 'PRIVATE_GOOGLE_TOKEN', refresh_token: 'PRIVATE_REFRESH' } });
  await db.passwordResetToken.create({ data: { userId: owner.id, tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 60_000) } });
  await db.placementRequest.create({ data: { userId: owner.id, requestKey: crypto.randomUUID(), payloadHash: 'hash', sessionIdsJson: '[]' } });
  await db.workoutSaveRequest.create({ data: { userId: owner.id, owner: 'athlete', requestKey: crypto.randomUUID(), payloadHash: 'hash' } });
  await db.activity.create({ data: { sessionId: source.id, athleteId: owner.id, completedAt: new Date(), durationSec: 300, tss: 1, zoneDistributionJson: '{}', segmentsJson: '[]', notes: 'PRIVATE_OUTCOME', telemetryJson: '{"private":"sensor"}' } });
  const athleteId = `${Date.now()}${owner.id}`;
  const connection = await db.stravaConnection.create({ data: { userId: owner.id, athleteId, athleteName: 'PRIVATE_STRAVA_NAME', accessTokenEncrypted: 'PRIVATE_ACCESS', refreshTokenEncrypted: 'PRIVATE_REFRESH', expiresAt: 1, scopes: 'activity:read' } });
  await db.stravaInboxActivity.create({ data: { connectionId: connection.id, stravaActivityId: '9', title: 'PRIVATE_IMPORT', sportType: 'Run', startedAt: new Date(), durationSec: 3 } });
  await db.stravaWebhookEvent.create({ data: { eventKey: crypto.randomUUID(), ownerAthleteId: athleteId, objectId: '9', objectType: 'activity', aspectType: 'create', eventTime: 1, subscriptionId: 1 } });
  let revoked = 0;
  const deletion = createAccountDeletionService({ db, revokeStrava: async (encrypted) => {
    assert.equal(encrypted, 'PRIVATE_REFRESH'); assert.equal(await db.user.count({ where: { id: owner.id } }), 0); revoked++; throw new Error('Provider unavailable');
  } });
  assert.deepEqual(await deletion.preview(owner.id), { sharedLinks: 1 });
  const result = await deletion.deleteAccount(owner.id, input, identity);
  assert.deepEqual(result, { ok: true, providerRevoked: false }); assert.equal(revoked, 1);
  assert.equal(await db.user.count({ where: { id: owner.id } }), 0);
  for (const model of [db.account, db.passwordResetToken, db.placementRequest, db.workoutSaveRequest, db.accountDeletionAttempt, db.stravaConnection]) assert.equal(await (model as typeof db.account).count({ where: { userId: owner.id } }), 0);
  assert.equal(await db.activity.count({ where: { athleteId: owner.id } }), 0);
  assert.equal(await db.session.count({ where: { athleteId: owner.id } }), 0);
  assert.equal(await db.stravaInboxActivity.count({ where: { connectionId: connection.id } }), 0);
  assert.equal(await db.stravaWebhookEvent.count({ where: { ownerAthleteId: athleteId } }), 0);
  assert.ok(await db.session.findUnique({ where: { id: independent.id } }));
  const retained = await db.shareLink.findUniqueOrThrow({ where: { id: savedLink.id } });
  assert.equal(retained.createdById, null); assert.equal(retained.sessionId, null); assert.equal(retained.ownerDeleted, true);
  assert.equal(retained.snapshotJson.includes('PRIVATE'), false);
  const preview = await shares.loadPreview(token); assert.ok(preview); assert.equal(preview.ownerDeleted, true); assert.equal(preview.metrics.durationSec, 600);
  assert.equal((await deletion.deleteAccount(owner.id, input, identity)).ok, false);
  assert.equal(await stravaService.enqueueWebhookEvent({ ownerAthleteId: athleteId, objectId: '10', objectType: 'activity', aspectType: 'create', updates: { personal: 'PRIVATE' }, eventTime: 2, subscriptionId: 1 }), null);
  assert.equal(await db.stravaWebhookEvent.count({ where: { ownerAthleteId: athleteId } }), 0);
});

test('unshare removes owner links including another creator’s links to owner content, but preserves others’ content', async () => {
  const owner = await user(); const other = await user();
  const first = await session(owner.id); const second = await session(other.id);
  const shares = createShareLinkService({ db });
  for (const [creator, source] of [[owner.id, first.id], [other.id, second.id]]) {
    const link = await shares.createForUser(creator, 'session', source); assert.ok(link.ok);
  }
  const othersLink = await db.shareLink.findFirstOrThrow({ where: { sessionId: second.id } }); linkIds.push(othersLink.id);
  await db.shareLink.create({ data: { createdById: other.id, sessionId: first.id, tokenHash: crypto.randomUUID(), snapshotJson: '{}' } });
  const deletion = createAccountDeletionService({ db });
  const result = await deletion.unshare(owner.id); assert.deepEqual(result, { ok: true, removed: 2 });
  assert.equal(await db.shareLink.count({ where: { sessionId: first.id } }), 0);
  assert.ok(await db.shareLink.findUnique({ where: { id: othersLink.id } }));
  assert.ok(await db.session.findUnique({ where: { id: first.id } }));
});

test('coach deletion preserves recipient sessions and outcomes while stripping coach identity and authored free text', async () => {
  const coach = await user(); const recipient = await user();
  await db.user.update({ where: { id: recipient.id }, data: { coachId: coach.id } });
  const plan = await db.trainingPlan.create({ data: { coachOwnerId: coach.id, name: 'PRIVATE_NAME plan', sport: 'RUNNING' } });
  const source = await session(recipient.id);
  const snapshot = createSessionSnapshotJson({ athleteId: recipient.id, coachOwnerId: coach.id, assignedById: coach.id, trainingPlanId: plan.id, title: 'PRIVATE_NAME', sport: 'RUNNING', coachNotes: 'PRIVATE_ADDRESS', athleteNotes: 'RECIPIENT_NOTES', blocks: [{ kind: 'work', zone: 2, durationSec: 300, note: 'PRIVATE_ADDRESS' }] });
  await db.session.update({ where: { id: source.id }, data: { coachOwnerId: coach.id, assignedById: coach.id, trainingPlanId: plan.id, athleteNotes: 'RECIPIENT_NOTES', coachNotes: 'PRIVATE_ADDRESS', coachBaselineJson: snapshot } });
  await db.activity.create({ data: { sessionId: source.id, athleteId: recipient.id, completedAt: new Date(), durationSec: 300, tss: 1, zoneDistributionJson: '{}', segmentsJson: '[]', notes: 'RECIPIENT_NOTES', actualSnapshotJson: snapshot } });
  const result = await createAccountDeletionService({ db }).deleteAccount(coach.id, input, identity); assert.equal(result.ok, true);
  const kept = await db.session.findUniqueOrThrow({ where: { id: source.id }, include: { activity: true, blocks: true } });
  assert.equal(kept.coachOwnerId, null); assert.equal(kept.assignedById, null); assert.equal(kept.trainingPlanId, null);
  assert.equal(kept.athleteNotes, 'RECIPIENT_NOTES'); assert.equal(kept.activity?.notes, 'RECIPIENT_NOTES');
  assert.equal(JSON.stringify(kept).includes('PRIVATE'), false);
  assert.ok(kept.activity?.actualSnapshotJson?.includes('RECIPIENT_NOTES'));
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: recipient.id } })).coachId, null);
});

test('password checks are bounded before hashing and session/password changes invalidate deletion', async () => {
  const owner = await user(); let checks = 0;
  const deletion = createAccountDeletionService({ db, verifyPassword: async () => { checks++; return false; } });
  for (let i = 0; i < 5; i++) assert.equal((await deletion.deleteAccount(owner.id, { ...input, password: 'wrong' }, identity)).ok, false);
  const limited = await deletion.deleteAccount(owner.id, input, identity); assert.equal(limited.ok, false); if (!limited.ok) assert.equal(limited.status, 429); assert.equal(checks, 5);
  await db.accountDeletionAttempt.delete({ where: { userId: owner.id } });
  const changed = createAccountDeletionService({ db, verifyPassword: async () => { await db.user.update({ where: { id: owner.id }, data: { sessionVersion: 1 } }); return true; } });
  assert.equal((await changed.deleteAccount(owner.id, input, identity)).ok, false);
  assert.ok(await db.user.findUnique({ where: { id: owner.id } }));
});

test('Google deletion requires a fresh server-authenticated provider sign-in', async () => {
  const owner = await user(false); const timestamp = Date.now();
  await db.account.create({ data: { userId: owner.id, type: 'oauth', provider: 'google', providerAccountId: crypto.randomUUID() } });
  const deletion = createAccountDeletionService({ db, now: () => timestamp });
  for (const proof of [identity, { ...identity, signInProvider: 'credentials', authenticatedAt: timestamp }, { ...identity, signInProvider: 'google', authenticatedAt: timestamp - 300001 }, { ...identity, signInProvider: 'google', authenticatedAt: timestamp + 1 }]) assert.equal((await deletion.deleteAccount(owner.id, { confirmation: 'DELETE' }, proof)).ok, false);
  assert.equal((await deletion.deleteAccount(owner.id, { confirmation: 'DELETE' }, { ...identity, signInProvider: 'google', authenticatedAt: timestamp })).ok, true);
});

test('a failure after anonymization rolls back every deletion write; concurrent submissions delete once', async () => {
  const owner = await user(); const source = await session(owner.id);
  const shares = createShareLinkService({ db }); await shares.createForUser(owner.id, 'session', source.id);
  const before = await db.shareLink.findFirstOrThrow({ where: { sessionId: source.id } }); linkIds.push(before.id);
  const failingDb = { ...db, $transaction: async (operation: (tx: unknown) => unknown, options: object) => db.$transaction(async (tx) => operation({ ...tx, user: { ...tx.user, delete: async () => { throw new Error('Injected deletion failure'); } } }), options) };
  const deletion = createAccountDeletionService({ db: failingDb as never });
  await assert.rejects(deletion.deleteAccount(owner.id, input, identity), /Injected deletion failure/);
  assert.deepEqual(await db.shareLink.findUniqueOrThrow({ where: { id: before.id } }), before);
  assert.ok(await db.user.findUnique({ where: { id: owner.id } }));
  const working = createAccountDeletionService({ db });
  const results = await Promise.all([working.deleteAccount(owner.id, input, identity), working.deleteAccount(owner.id, input, identity)]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(await db.user.count({ where: { id: owner.id } }), 0);
});
