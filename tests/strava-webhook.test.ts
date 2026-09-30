import assert from 'node:assert/strict';
import { createCipheriv } from 'node:crypto';
import test from 'node:test';

// Install a plain database double before the singleton is loaded. Prisma's
// generated delegates are proxies and cannot be patched with mock.method.
const delegate = () => ({ updateMany: async () => ({ count: 0 }), findUnique: async () => null, findMany: async () => [], update: async () => null });
globalThis.prisma = {
  stravaWebhookEvent: delegate(), stravaConnection: delegate(), stravaInboxActivity: delegate(), activity: delegate(),
  $transaction: async () => null,
} as never;
const { prisma } = await import('../lib/prisma.ts');
const { stravaService } = await import('../lib/strava-service.ts');

test('duplicate or leased webhook work makes no provider request', async (context) => {
  context.mock.method(prisma.stravaWebhookEvent, 'updateMany', async () => ({ count: 0 }));
  const find = context.mock.method(prisma.stravaWebhookEvent, 'findUnique', async () => { throw new Error('must not read'); });
  await stravaService.processWebhookEvent(1);
  assert.equal(find.mock.callCount(), 0);
});

test('provider failures remain queued with backoff after more than three attempts', async (context) => {
  context.mock.method(prisma.stravaWebhookEvent, 'updateMany', async () => ({ count: 1 }));
  context.mock.method(prisma.stravaWebhookEvent, 'findUnique', async () => ({ id: 1, status: 'processing', objectType: 'activity', aspectType: 'create', ownerAthleteId: '99', objectId: '42', attemptCount: 5 }));
  context.mock.method(prisma.stravaConnection, 'findUnique', async () => ({ id: 'connection', athleteId: '99', expiresAt: 2 ** 31 - 1, accessTokenEncrypted: 'invalid' }));
  const update = context.mock.method(prisma.stravaWebhookEvent, 'update', async (args: unknown) => args);
  const before = Date.now();
  await stravaService.processWebhookEvent(1);
  const args = update.mock.calls[0].arguments[0] as { data: { status: string; processingUntil: unknown; nextAttemptAt: Date; attemptCount: unknown } };
  assert.equal(args.data.status, 'pending');
  assert.equal(args.data.processingUntil, null);
  assert.ok(args.data.nextAttemptAt.getTime() >= before + 960_000);
  assert.deepEqual(args.data.attemptCount, { increment: 1 });
});

test('webhook upsert preserves notification/discard state and deduplicates the activity by connection', async (context) => {
  const key = Buffer.alloc(32, 1);
  const iv = Buffer.alloc(12, 2);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update('access-token'), cipher.final()]);
  const previousKey = process.env.STRAVA_TOKEN_ENCRYPTION_KEY;
  process.env.STRAVA_TOKEN_ENCRYPTION_KEY = key.toString('hex');
  context.after(() => { if (previousKey === undefined) delete process.env.STRAVA_TOKEN_ENCRYPTION_KEY; else process.env.STRAVA_TOKEN_ENCRYPTION_KEY = previousKey; });
  context.mock.method(prisma.stravaWebhookEvent, 'updateMany', async () => ({ count: 1 }));
  context.mock.method(prisma.stravaWebhookEvent, 'findUnique', async () => ({ id: 1, status: 'processing', objectType: 'activity', aspectType: 'create', ownerAthleteId: '99', objectId: '42', attemptCount: 0 }));
  context.mock.method(prisma.stravaConnection, 'findUnique', async () => ({ id: 'connection', athleteId: '99', expiresAt: 2 ** 31 - 1, accessTokenEncrypted: `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}` }));
  context.mock.method(globalThis, 'fetch', async () => Response.json({ id: 42, athlete: { id: 99 }, name: 'New run', sport_type: 'Run', start_date: '2026-09-30T07:00:00Z', elapsed_time: 1800, distance: 5000 }));
  const upserts: unknown[] = [];
  context.mock.method(prisma, '$transaction', async (callback: (transaction: unknown) => Promise<unknown>) => callback({
    $queryRaw: async () => [{ id: 'connection' }],
    stravaInboxActivity: { upsert: async (args: unknown) => { upserts.push(args); } },
  }));
  const done = context.mock.method(prisma.stravaWebhookEvent, 'update', async (args: unknown) => args);
  await stravaService.processWebhookEvent(1);
  assert.equal(upserts.length, 1);
  const upsert = upserts[0] as { where: unknown; update: Record<string, unknown> };
  assert.deepEqual(upsert.where, { connectionId_stravaActivityId: { connectionId: 'connection', stravaActivityId: '42' } });
  assert.equal(upsert.update.title, 'New run');
  assert.ok(!('dismissedAt' in upsert.update));
  assert.ok(!('notifiedAt' in upsert.update));
  assert.equal((done.mock.calls[0].arguments[0] as { data: { status: string } }).data.status, 'processed');
});

test('queue recovery is scoped to the signed-in Strava owner and includes expired leases', async (context) => {
  context.mock.method(prisma.stravaConnection, 'findUnique', async () => ({ athleteId: '99' }));
  const events = context.mock.method(prisma.stravaWebhookEvent, 'findMany', async () => []);
  assert.equal(await stravaService.processPendingWebhookEvents(7), 0);
  const args = events.mock.calls[0].arguments[0] as { where: { ownerAthleteId: string; OR: Array<{ status: string }> }; take: number };
  assert.equal(args.where.ownerAthleteId, '99');
  assert.deepEqual(args.where.OR.map((clause) => clause.status), ['pending', 'processing']);
  assert.equal(args.take, 3);
});

test('discarded activities remain reachable for restore after falling out of the recent page', async (context) => {
  context.mock.method(prisma.stravaConnection, 'findUnique', async () => ({ id: 'connection', athleteName: 'Owner' }));
  context.mock.method(prisma.activity, 'findMany', async () => [{ externalActivityId: '43' }]);
  const old = { stravaActivityId: '42', title: 'Older discarded run', sportType: 'Run', startedAt: new Date('2026-01-01'), durationSec: 1800, distanceMeters: 5000, elevationGainMeters: 0, metadataJson: null, dismissedAt: new Date() };
  const recent = { ...old, stravaActivityId: '43', title: 'Imported run', startedAt: new Date('2026-09-30'), dismissedAt: null };
  let reads = 0;
  const inbox = context.mock.method(prisma.stravaInboxActivity, 'findMany', async () => ++reads === 1 ? [recent] : [old]);
  const result = await stravaService.connectionForUser(7);
  assert.deepEqual(result.activities.map((activity) => [activity.id, activity.imported, activity.dismissed]), [['43', true, false], ['42', false, true]]);
  assert.deepEqual((inbox.mock.calls[1].arguments[0] as { where: unknown }).where, { connectionId: 'connection', stravaActivityId: { notIn: ['43'] } });
});
