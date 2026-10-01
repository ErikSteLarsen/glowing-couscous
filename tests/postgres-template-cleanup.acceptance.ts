// Run once against the guarded disposable DB after applying the pre-cleanup migrations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const database = new URL(process.env[key] ?? '');
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '55432' || database.pathname !== '/tempo_acceptance') throw new Error('Cleanup acceptance requires the named disposable local PostgreSQL database.');
}
const db = new PrismaClient();

test('retiring old templates removes definitions and shares while keeping routines, calendar blocks and outcomes', async () => {
  const owner = await db.user.create({ data: { email: `cleanup-${crypto.randomUUID()}@example.test`, role: 'ATHLETE' } });
  try {
    const [legacy] = await db.$queryRaw<Array<{ id: number }>>`INSERT INTO "Template" ("ownerId", "name", "sport", "cadence", "updatedAt") VALUES (${owner.id}, 'Retired workout', 'RUNNING', 'day', NOW()) RETURNING "id"`;
    await db.$executeRaw`INSERT INTO "Block" ("templateId", "kind", "zone", "durationSec", "sortOrder") VALUES (${legacy.id}, 'work', 2, 600, 0)`;
    const session = await db.session.create({ data: { athleteId: owner.id, templateId: legacy.id, date: new Date('2026-10-01T12:00:00Z'), sport: 'RUNNING', title: 'Applied workout', source: 'template', status: 'completed', blocks: { create: { kind: 'work', zone: 2, durationSec: 600, sortOrder: 0 } } } });
    const activity = await db.activity.create({ data: { sessionId: session.id, athleteId: owner.id, completedAt: new Date(), durationSec: 620, tss: 5, zoneDistributionJson: '[0,620,0,0,0]', segmentsJson: '[]', notes: 'Preserve outcome' } });
    const snapshot = '{"sourceKind":"template"}';
    await db.$executeRaw`INSERT INTO "ShareLink" ("tokenHash", "templateId", "createdById", "snapshotJson") VALUES (${crypto.randomUUID()}, ${legacy.id}, ${owner.id}, ${snapshot})`;
    await db.$executeRaw`INSERT INTO "ShareLink" ("tokenHash", "ownerDeleted", "snapshotJson") VALUES (${crypto.randomUUID()}, true, ${snapshot})`;
    const routineJson = JSON.stringify({ version: 1, entries: [{ weekday: 0, workoutId: session.id, title: 'Saved workout', sport: 'RUNNING', summary: null, sportMetricsJson: null, blocks: [{ kind: 'work', zone: 2, durationSec: 600, reps: null, targetType: null, targetLow: null, targetHigh: null, note: null, sortOrder: 0 }] }] });
    const [routine] = await db.$queryRaw<Array<{ id: number }>>`INSERT INTO "Template" ("ownerId", "name", "sport", "cadence", "routineJson", "updatedAt") VALUES (${owner.id}, 'Keep routine', 'RUNNING', 'week', ${routineJson}, NOW()) RETURNING "id"`;

    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'pipe', env: process.env });

    assert.equal(await db.template.findUnique({ where: { id: legacy.id } }), null);
    assert.equal((await db.template.findUniqueOrThrow({ where: { id: routine.id } })).routineJson, routineJson);
    const retained = await db.session.findUniqueOrThrow({ where: { id: session.id }, include: { blocks: true, activity: true } });
    assert.equal(retained.templateId, null);
    assert.equal(retained.status, 'completed');
    assert.equal(retained.blocks[0].durationSec, 600);
    assert.equal(retained.activity?.id, activity.id);
    assert.equal(retained.activity?.durationSec, 620);
    assert.equal(retained.activity?.notes, 'Preserve outcome');
    assert.equal(await db.shareLink.count({ where: { snapshotJson: snapshot } }), 0);
    const columns = await db.$queryRaw<Array<{ table_name: string; column_name: string }>>`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='Template' AND column_name IN ('sport','cadence')) OR (table_name IN ('Block','ShareLink') AND column_name='templateId'))`;
    assert.deepEqual(columns, []);
  } finally {
    await db.user.delete({ where: { id: owner.id } });
    await db.$disconnect();
  }
});
