import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateService } from '../lib/template-service.ts';

test('routine service snapshots only owner library workouts and ignores submitted workout content', async () => {
  let query: any;
  let saved: any;
  const block = { kind: 'work', zone: 1, durationSec: 1800, reps: 2, targetType: 'pace', targetMode: 'relative', targetReference: 'profile-pace-zone-1', targetLow: 100, targetHigh: 100, targetLowDecimal: '99.94', targetHighDecimal: '100.25', note: 'Easy', skipped: false };
  const db: any = { session: { async findMany(args: any) { query = args; return [{ id: 4, title: 'Saved easy run', sport: 'RUNNING', summary: null, sportMetricsJson: null, blocks: [block] }]; } }, template: { async create(args: any) { saved = args.data; } }, async $transaction(fn: any) { return fn(db); } };
  const service = createTemplateService({ db });
  assert.deepEqual(await service.saveForOwner(7, { name: 'Base week', entries: [{ weekday: 0, workoutId: 4, title: 'Injected title', blocks: [] }, { weekday: 2, workoutId: 4 }] }), { error: null });
  assert.deepEqual(query.where, { id: { in: [4, 4] }, athleteId: 7, coachOwnerId: null, date: null, planId: null, trainingPlanId: null });
  const routine = JSON.parse(saved.routineJson);
  assert.equal(routine.entries[0].title, 'Saved easy run');
  assert.equal(routine.entries[0].blocks[0].targetReference, 'profile-pace-zone-1');
  assert.equal(routine.entries[0].blocks[0].targetLowDecimal, '99.94');
  assert.equal(routine.entries[0].blocks[0].reps, 2);
  assert.equal(saved.blocks, undefined);
});

test('routine service refuses missing workouts, foreign templates and invalid weekdays before writes', async () => {
  let writes = 0;
  const db: any = { session: { async findMany() { return []; } }, template: { async findFirst() { return null; }, async create() { writes++; } }, async $transaction(fn: any) { return fn(db); } };
  const service = createTemplateService({ db });
  assert.ok((await service.saveForOwner(7, { name: 'Week', entries: [{ weekday: 0, workoutId: 99 }] })).error);
  assert.ok((await service.saveForOwner(7, { name: 'Week', entries: [{ weekday: 0, workoutId: 4 }] }, 90)).error);
  assert.ok((await service.saveForOwner(7, { name: 'Week', entries: [{ weekday: 7, workoutId: 4 }] })).error);
  assert.ok((await service.saveForOwner(7, { name: 'Week', blocks: [{ kind: 'work', durationSec: 600 }] })).error);
  assert.equal(writes, 0);
});
