// Disposable database only. This check never reads configured account/provider data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createActivityImportService } from '../lib/activity-import-service.ts';
import { createActivityAnalysisService } from '../lib/activity-analysis-service.ts';
import { newActivityAnalysisJob } from '../lib/activity-analysis-job.ts';

const url = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432' || url.pathname !== '/tempo_acceptance') throw new Error('Use disposable localhost:55432/tempo_acceptance only.');
const db = new PrismaClient();
test.after(() => db.$disconnect());

test('PostgreSQL analysis atomic import, owner isolation, concurrent workers, stale leases and deletion', async () => {
  const owner = await db.user.create({ data: { email: `analysis-${crypto.randomUUID()}@example.test`, role: 'ATHLETE' } });
  const other = await db.user.create({ data: { email: `analysis-other-${crypto.randomUUID()}@example.test`, role: 'ATHLETE' } });
  const imports = createActivityImportService({ db: db as never });
  const input = { title: 'Intervals', sport: 'RUNNING', startedAt: '2026-10-01T08:00:00Z', durationSec: 120,
    distanceMeters: 360, elevationGainMeters: null, analyzeWorkout: true,
    points: Array.from({ length: 121 }, (_, elapsedSec) => ({ elapsedSec, distanceMeters: elapsedSec * 3, heartRateBpm: 140 })) };
  try {
    const imported = await imports.importForUser(owner.id, input);
    if (!imported.ok) throw new Error(imported.error);
    assert.equal(await db.activityAnalysis.count({ where: { activityId: imported.activityId } }), 1);
    assert.equal((await imports.importForUser(owner.id, input)).ok, false);
    assert.equal(await db.activityAnalysis.count({ where: { activity: { athleteId: owner.id } } }), 1);
    let calls = 0;
    const service = createActivityAnalysisService({ db, interpret: async measured => { calls++; return measured; } });
    assert.equal(await service.readForUser(other.id, imported.activityId), null);
    assert.equal((await service.requestForUser(other.id, imported.activityId)).ok, false);
    await service.processOne(imported.activityId, other.id);
    assert.equal(calls, 0);
    await Promise.all([service.processOne(imported.activityId), service.processOne(imported.activityId)]);
    assert.equal(calls, 1);
    assert.equal((await service.readForUser(owner.id, imported.activityId))?.status, 'completed');
    assert.equal((await service.correctForUser(owner.id, imported.activityId, { repetitions: 8, durationSec: 240, recoverySec: 120, paceSecPerKm: 250 })).ok, true);
    assert.equal((await service.readForUser(owner.id, imported.activityId))?.correction?.repetitions, 8);
    assert.equal((await service.correctForUser(other.id, imported.activityId, { repetitions: 8, durationSec: 240, recoverySec: 120, paceSecPerKm: 250 })).ok, false);
    assert.equal((await service.requestForUser(owner.id, imported.activityId)).ok, false); // cooldown

    // Transaction rollback covers the nested job as well as Activity/Session creation.
    const rollbackDb = { user: db.user, session: db.session, activity: db.activity,
      $transaction: (operation: Parameters<typeof db.$transaction>[0]) => db.$transaction(async tx => {
      await (operation as (value: typeof tx) => Promise<unknown>)(tx); throw new Error('Injected rollback');
    }) };
    await assert.rejects(createActivityImportService({ db: rollbackDb as never }).importForUser(owner.id, { ...input, startedAt: '2026-10-01T09:00:00Z' }));
    assert.equal(await db.activity.count({ where: { athleteId: owner.id } }), 1);

    // A deleted Activity must not be recreated by an in-flight interpretation.
    await db.activityAnalysis.update({ where: { activityId: imported.activityId }, data: { status: 'queued', attemptCount: 0 } });
    const deleting = createActivityAnalysisService({ db, interpret: async measured => {
      await imports.deleteImportedActivityForUser(owner.id, imported.activityId); return measured;
    } });
    await deleting.processOne(imported.activityId);
    assert.equal(await db.activityAnalysis.count({ where: { activity: { athleteId: owner.id } } }), 0);
    assert.equal(await db.activity.count({ where: { id: imported.activityId } }), 0);

    const matched = await db.session.create({ data: { source: 'athlete-planner', title: 'Saved plan', sport: 'RUNNING', athleteId: owner.id, date: new Date('2026-10-01'), blocks: { create: [{ kind: 'work', durationSec: 240, zone: 3, sortOrder: 0 }] } } });
    const matchedImport = await imports.importForUser(owner.id, { ...input, plannedSessionId: matched.id });
    if (!matchedImport.ok) throw new Error(matchedImport.error);
    await service.processOne(matchedImport.activityId);
    assert.equal((await db.session.findUniqueOrThrow({ where: { id: matched.id }, include: { blocks: true } })).blocks[0].durationSec, 240);
    await imports.deleteImportedActivityForUser(owner.id, matchedImport.activityId);
    assert.equal((await db.session.findUniqueOrThrow({ where: { id: matched.id } })).status, 'planned');
    assert.equal(await db.activityAnalysis.count({ where: { activity: { athleteId: owner.id } } }), 0);

    const second = await imports.importForUser(owner.id, { ...input, startedAt: '2026-10-01T10:00:00Z' });
    if (!second.ok) throw new Error(second.error);
    // Stale worker cannot publish after its lease has been replaced.
    const stale = createActivityAnalysisService({ db, interpret: async measured => {
      await db.activityAnalysis.update({ where: { activityId: second.activityId }, data: { leaseToken: 'replacement-worker' } }); return measured;
    } });
    await stale.processOne(second.activityId);
    assert.equal((await db.activityAnalysis.findUniqueOrThrow({ where: { activityId: second.activityId } })).resultJson, null);
    await db.activityAnalysis.update({ where: { activityId: second.activityId }, data: { leaseUntil: new Date(0), attemptCount: 3 } });
    await service.processOne(second.activityId);
    assert.equal((await service.readForUser(owner.id, second.activityId))?.status, 'failed');

    // Even a mistakenly queued Strava row is refused before the model adapter.
    const activity = await db.activity.update({ where: { id: second.activityId }, data: { metricsSource: 'strava-import', externalSource: 'STRAVA' } });
    await db.activityAnalysis.update({ where: { activityId: second.activityId }, data: { ...newActivityAnalysisJob(activity.telemetryJson!, activity.durationSec, '{}'), status: 'queued', attemptCount: 0 } });
    const before = calls;
    await service.processOne(second.activityId);
    assert.equal(calls, before);
    assert.equal((await service.readForUser(owner.id, second.activityId))?.status, 'cancelled');
    await db.user.delete({ where: { id: owner.id } });
    assert.equal(await db.activityAnalysis.count({ where: { activity: { athleteId: owner.id } } }), 0);
  } finally {
    await db.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
  }
});
