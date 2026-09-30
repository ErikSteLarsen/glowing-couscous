import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountService } from '../lib/account-service.ts';
import { createEmptyPerformanceProfile } from '../lib/performance-profile.ts';

test('profile validates all fields before persistence and writes name, metrics and preferences atomically', async () => {
  const revision = new Date('2026-09-30T12:00:00Z');
  const writes: Array<Record<string, unknown>> = [];
  const tx = { user: { async findUnique() { return { updatedAt: revision, prefsJson: '{"keep":"existing"}' }; }, async updateMany(args: { where: { id: number; updatedAt: Date }; data: Record<string, unknown> }) { assert.equal(args.where.id, 7); assert.equal(args.where.updatedAt, revision); writes.push(args.data); return { count: 1 }; } } };
  const service = createAccountService({ db: { async $transaction(fn: (client: typeof tx) => unknown) { return fn(tx); } } as never });
  const invalid = await service.updateProfile(7, { name: 'New name', performanceProfile: { heartRateMaxBpm: -1 } });
  assert.equal(invalid.ok, false); assert.equal(writes.length, 0);
  const result = await service.updateProfile(7, { name: '  New name ', performanceProfile: createEmptyPerformanceProfile(), overviewCards: ['trend'], expectedUpdatedAt: revision.toISOString() });
  assert.equal(result.ok, true); assert.equal(writes.length, 1);
  assert.equal(writes[0].name, 'New name');
  assert.ok(writes[0].performanceProfileJson);
  assert.deepEqual(JSON.parse(writes[0].prefsJson as string), { keep: 'existing', overviewCards: ['trend'] });
});

test('profile refuses stale and concurrently replaced revisions without partial changes', async () => {
  const revision = new Date('2026-09-30T12:00:00Z'); let attempts = 0;
  const tx = { user: { async findUnique() { return { updatedAt: revision, prefsJson: null }; }, async updateMany() { attempts++; return { count: 0 }; } } };
  const service = createAccountService({ db: { async $transaction(fn: (client: typeof tx) => unknown) { return fn(tx); } } as never });
  const stale = await service.updateProfile(7, { name: 'Changed', expectedUpdatedAt: new Date(0).toISOString() });
  assert.equal(stale.ok, false); assert.equal(attempts, 0);
  const raced = await service.updateProfile(7, { name: 'Changed', expectedUpdatedAt: revision.toISOString() });
  assert.equal(raced.ok, false); assert.equal(attempts, 1);
});

test('Home sport selection preserves unrelated preferences and rejects invalid choices before writes', async () => {
  const revision = new Date('2026-09-30T12:00:00Z');
  const writes: Array<Record<string, unknown>> = [];
  const tx = { user: { async findUnique() { return { updatedAt: revision, prefsJson: '{"overviewCards":["trend"],"keep":"existing"}' }; }, async updateMany(args: { data: Record<string, unknown> }) { writes.push(args.data); return { count: 1 }; } } };
  const service = createAccountService({ db: { async $transaction(fn: (client: typeof tx) => unknown) { return fn(tx); } } as never });
  const invalid = await service.updateProfile(7, { trainingSports: ['unknown'] });
  assert.equal(invalid.ok, false); assert.equal(writes.length, 0);
  const result = await service.updateProfile(7, { trainingSports: ['running'], expectedUpdatedAt: revision.toISOString() });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(writes[0].prefsJson as string), { overviewCards: ['trend'], keep: 'existing', trainingSports: ['running'] });
  assert.equal(writes[0].name, undefined);
  assert.equal(writes[0].performanceProfileJson, undefined);
});
