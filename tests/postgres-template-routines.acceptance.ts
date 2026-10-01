// Explicit integration check; requires the named disposable local PostgreSQL database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createTemplateService } from '../lib/template-service.ts';
import { createAthletePlannerService } from '../lib/athlete-planner-service.ts';
import { templateDatesForSelection } from '../lib/template-period.ts';

const database = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '55432' || database.pathname !== '/tempo_acceptance') throw new Error('Acceptance requires the named disposable local PostgreSQL database.');
const db = new PrismaClient();

test('PostgreSQL routine composition, snapshots, ownership, week/month expansion, replay and rollback', async () => {
  const owner = await db.user.create({ data: { email: `routine-${crypto.randomUUID()}@example.test`, role: 'ATHLETE' } });
  const other = await db.user.create({ data: { email: `routine-other-${crypto.randomUUID()}@example.test`, role: 'ATHLETE' } });
  try {
    const templates = createTemplateService({ db });
    const planner = createAthletePlannerService({ db });
    const easy = await db.session.create({ data: { source: 'athlete-library', athleteId: owner.id, title: 'Easy run', sport: 'RUNNING', blocks: { create: [{ kind: 'work', zone: 1, durationSec: 1800, targetType: 'pace', targetMode: 'relative', targetReference: 'profile-pace-zone-1', targetLow: 100, targetHigh: 100, targetLowDecimal: '99.94', targetHighDecimal: '100.25', sortOrder: 0 }] } } });
    const intervals = await db.session.create({ data: { source: 'athlete-library', athleteId: owner.id, title: 'Intervals', sport: 'RUNNING', blocks: { create: [{ kind: 'work', zone: 4, durationSec: 300, reps: 4, sortOrder: 0 }] } } });
    const foreign = await db.session.create({ data: { source: 'athlete-library', athleteId: other.id, title: 'Private workout', sport: 'RUNNING' } });
    assert.ok((await templates.saveForOwner(owner.id, { name: 'Foreign', entries: [{ weekday: 0, workoutId: foreign.id }] })).error);
    assert.equal(await db.template.count({ where: { ownerId: owner.id } }), 0);
    const entries = [0, 2, 4].map(weekday => ({ weekday, workoutId: easy.id })).concat([1, 3].map(weekday => ({ weekday, workoutId: intervals.id })));
    assert.deepEqual(await templates.saveForOwner(owner.id, { name: 'Base week', summary: 'Easy and intervals', entries }), { error: null });
    const template = await db.template.findFirstOrThrow({ where: { ownerId: owner.id } });
    assert.ok((await templates.saveForOwner(other.id, { name: 'Stolen', entries }, template.id)).error);
    assert.deepEqual(await templates.duplicateForOwner(owner.id, template.id), { error: null });
    assert.equal((await db.template.findFirstOrThrow({ where: { ownerId: owner.id, name: 'Base week (Copy)' } })).routineJson, template.routineJson);
    // Snapshots survive source edits/deletion and do not turn into dynamic links.
    await db.session.delete({ where: { id: easy.id } });
    const input = { sourceKind: 'template', sourceId: template.id, requestKey: crypto.randomUUID(), dates: templateDatesForSelection('week', '2026-10-05') };
    const first = await planner.assignSource(owner.id, input);
    if (!first.ok) throw new Error(first.error);
    assert.equal(first.ok, true);
    assert.equal(first.sessionIds.length, 5);
    assert.deepEqual(await planner.assignSource(owner.id, input), first);
    const sessions = await db.session.findMany({ where: { id: { in: first.sessionIds } }, include: { blocks: true }, orderBy: { date: 'asc' } });
    assert.deepEqual(sessions.map(session => session.title), ['Easy run', 'Intervals', 'Easy run', 'Intervals', 'Easy run']);
    assert.equal(sessions[0].blocks[0].targetReference, 'profile-pace-zone-1');
    assert.equal(sessions[0].blocks[0].targetLowDecimal, '99.94');
    assert.equal(sessions[1].blocks[0].reps, 4);
    const month = await planner.assignSource(owner.id, { ...input, requestKey: crypto.randomUUID(), dates: templateDatesForSelection('month', '2026-11-12') });
    if (!month.ok) throw new Error(month.error);
    assert.equal(month.ok, true);
    assert.equal(month.sessionIds.length, 21);
    assert.equal((await planner.assignSource(other.id, { ...input, requestKey: crypto.randomUUID() })).ok, false);
    assert.equal((await planner.assignSource(owner.id, { ...input, requestKey: crypto.randomUUID(), dates: ['2026-10-05'] })).ok, false);
    const before = await db.session.count({ where: { athleteId: owner.id } });
    const failureKey = crypto.randomUUID();
    let writes = 0;
    const failingDb = { ...db, $transaction: async (fn: (tx: unknown) => unknown) => db.$transaction(async tx => fn({ ...tx, session: { ...tx.session, create: async (args: Parameters<typeof tx.session.create>[0]) => { if (++writes === 2) throw new Error('Injected routine failure'); return tx.session.create(args); } } })) };
    await assert.rejects(createAthletePlannerService({ db: failingDb as never }).assignSource(owner.id, { ...input, requestKey: failureKey }), /Injected routine failure/);
    assert.equal(await db.session.count({ where: { athleteId: owner.id } }), before);
    assert.equal(await db.placementRequest.count({ where: { userId: owner.id, requestKey: failureKey } }), 0);
    assert.deepEqual(await templates.deleteForOwner(owner.id, template.id), { error: null });
    assert.equal(await db.session.count({ where: { id: { in: first.sessionIds } } }), 5);
  } finally {
    await db.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    await db.$disconnect();
  }
});
