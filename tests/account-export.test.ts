import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountExportService } from '../lib/account-export-service.ts';

test('training export uses owner filters and explicit fields, excluding credentials and provider measurements', async () => {
  const requests: Array<{ table: string; where: unknown; select: unknown }> = [];
  const table = (name: string) => ({ async count() { return 1; }, async findMany(args: { where: unknown; select: unknown }) { requests.push({ table: name, ...args }); return []; } });
  const tx = { user: { async findUnique({ where, select }: { where: unknown; select: unknown }) { assert.deepEqual(where, { id: 7 }); assert.equal('passwordHash' in (select as object), false); return { email: 'owner@example.test', name: 'Owner', createdAt: new Date(0), prefsJson: '{"secret":"excluded"}', performanceProfileJson: null }; } }, session: table('session'), template: table('template'), activity: table('activity'), plan: table('plan'), trainingPlan: table('trainingPlan') };
  const service = createAccountExportService({ db: { async $transaction(fn: (client: typeof tx) => unknown) { const client = { ...tx, block: { async count() { return 0; } } }; return fn(client); } } as never });
  const result = await service.exportForUser(7);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const exported = JSON.parse(result.json);
  assert.equal(exported.version, 1); assert.equal(exported.account.email, 'owner@example.test'); assert.equal(result.json.includes('secret'), false);
  assert.deepEqual(requests.find((request) => request.table === 'session')!.where, { OR: [{ athleteId: 7 }, { coachOwnerId: 7, athleteId: null }], NOT: { source: 'activity-import', activity: { is: { externalSource: 'STRAVA' } } } });
  assert.deepEqual(requests.find((request) => request.table === 'activity')!.where, { athleteId: 7, OR: [{ externalSource: null }, { externalSource: { not: 'STRAVA' } }] });
  for (const request of requests) assert.equal(JSON.stringify(request.select).includes('accessToken'), false);
});

test('oversized training accounts return an error before reading collections, never a partial download', async () => {
  let reads = 0;
  const table = { async count() { return 5001; }, async findMany() { reads++; return []; } };
  const tx = { user: { async findUnique() { return { email: 'owner@example.test' }; } }, session: table, template: table, activity: table, plan: table, trainingPlan: table };
  const service = createAccountExportService({ db: { async $transaction(fn: (client: typeof tx) => unknown) { return fn(tx); } } as never });
  const result = await service.exportForUser(7);
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.status, 413); assert.equal(reads, 0);
});
