import assert from 'node:assert/strict';
import test from 'node:test';
import { createStravaInboxService } from '../lib/strava-inbox-service.ts';

function fixture({ connected = true, activities = [] as unknown[], imported = [] as unknown[] } = {}) {
  const calls: Array<{ operation: string; args: unknown }> = [];
  const db = {
    stravaConnection: { findUnique: async (args: unknown) => { calls.push({ operation: 'connection', args }); return connected ? { id: 'owner-connection' } : null; } },
    activity: { findMany: async (args: unknown) => { calls.push({ operation: 'imports', args }); return imported; } },
    stravaInboxActivity: {
      findMany: async (args: unknown) => { calls.push({ operation: 'inbox', args }); return activities; },
      updateMany: async (args: unknown) => { calls.push({ operation: 'review', args }); return { count: 1 }; },
    },
  };
  const importer = { listForUser: async (userId: number) => { calls.push({ operation: 'plans', args: userId }); return { plannedSessions: [{ id: 9, sport: 'RUNNING' }] }; } };
  return { calls, service: createStravaInboxService({ db: db as never, importer: importer as never }) };
}

test('disconnected accounts need no inbox, import, or plan reads', async () => {
  const { service, calls } = fixture({ connected: false });
  assert.deepEqual(await service.notificationsForUser(7), { connected: false, activities: [], plannedSessions: [] });
  assert.deepEqual(calls.map((call) => call.operation), ['connection']);
  assert.deepEqual(calls[0].args, { where: { userId: 7 }, select: { id: true } });
});

test('notifications exclude imported, already notified, and discarded activities before the batch limit', async () => {
  const { service, calls } = fixture({ imported: [{ externalActivityId: '12' }, { externalActivityId: null }] });
  const result = await service.notificationsForUser(7);
  assert.deepEqual(result.activities, []);
  assert.ok(!calls.some((call) => call.operation === 'plans'));
  assert.deepEqual(calls.find((call) => call.operation === 'imports')?.args, {
    where: { athleteId: 7, externalSource: 'STRAVA', externalActivityId: { not: null } }, select: { externalActivityId: true },
  });
  const query = calls.find((call) => call.operation === 'inbox')?.args as { where: unknown; take: number; orderBy: unknown };
  assert.deepEqual(query.where, { connectionId: 'owner-connection', notifiedAt: null, dismissedAt: null, stravaActivityId: { notIn: ['12'] } });
  assert.deepEqual(query.orderBy, { id: 'asc' });
  assert.equal(query.take, 50);
});

test('new activity summaries normalize sport and request only the current owner’s match candidates', async () => {
  const { service, calls } = fixture({ activities: [{ stravaActivityId: '42', title: 'Morning run', sportType: 'Run', startedAt: new Date('2026-09-30T07:00:00Z'), durationSec: 1800, distanceMeters: 5000 }] });
  const result = await service.notificationsForUser(7);
  assert.equal(result.activities[0].id, '42');
  assert.equal(result.activities[0].sport, 'RUNNING');
  assert.equal(result.activities[0].startedAt, '2026-09-30T07:00:00.000Z');
  assert.deepEqual(calls.find((call) => call.operation === 'plans')?.args, 7);
});

test('discard is an owner-scoped state update and never removes inbox or imported activity data', async () => {
  const { service, calls } = fixture();
  assert.deepEqual(await service.reviewForUser(7, ['42'], 'discard'), { updated: 1 });
  const query = calls[0].args as { where: unknown; data: { dismissedAt: Date; notifiedAt: Date } };
  assert.deepEqual(query.where, { connection: { userId: 7 }, stravaActivityId: { in: ['42'] } });
  assert.ok(query.data.dismissedAt instanceof Date);
  assert.ok(query.data.notifiedAt instanceof Date);
  assert.deepEqual(calls.map((call) => call.operation), ['review']);
});

test('restore makes a discarded activity eligible again without changing its provider data', async () => {
  const { service, calls } = fixture();
  await service.reviewForUser(7, ['42'], 'restore');
  assert.deepEqual(calls[0].args, { where: { connection: { userId: 7 }, stravaActivityId: { in: ['42'] } }, data: { dismissedAt: null, notifiedAt: null } });
});

test('review later acknowledges exactly the displayed ids without discarding them', async () => {
  const { service, calls } = fixture();
  await service.reviewForUser(7, ['42', '43'], 'notify');
  const query = calls[0].args as { where: unknown; data: Record<string, unknown> };
  assert.deepEqual(query.where, { connection: { userId: 7 }, stravaActivityId: { in: ['42', '43'] } });
  assert.deepEqual(Object.keys(query.data), ['notifiedAt']);
  assert.ok(query.data.notifiedAt instanceof Date);
});
