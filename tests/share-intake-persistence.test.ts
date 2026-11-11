import test from 'node:test';
import assert from 'node:assert/strict';
import { createShareLinkService } from '../lib/share-link-service.ts';
import { createWorkoutLibraryService } from '../lib/workout-library-service.ts';
import { createAthletePlannerService } from '../lib/athlete-planner-service.ts';
import { createTemplateService } from '../lib/template-service.ts';
import { parseTemplateRoutine } from '../lib/template-routine.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

test('shared copies persist independently in the correct recipient workspace in PostgreSQL', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const owner = await db.user.create({ data: { email: 'source@example.test', role: 'ATHLETE' } });
    const athlete = await db.user.create({ data: { email: 'recipient@example.test', role: 'ATHLETE' } });
    const coach = await db.user.create({ data: { email: 'coach@example.test', role: 'COACH' } });
    const source = await db.session.create({ data: {
      athleteId: owner.id, title: 'Shared short interval', sport: 'RUNNING', source: 'athlete-library',
      athleteNotes: 'Private source note',
      blocks: { create: [{ kind: 'work', zone: 4, durationSec: 20, sortOrder: 0 }] },
    } });
    const service = createShareLinkService({
      db,
      templatePersistence: createTemplateService({ db }),
      athletePlannerPersistence: createAthletePlannerService({ db }),
      workoutLibraryPersistence: createWorkoutLibraryService({ db }),
    });
    const created = await service.createForUser(owner.id, 'session', source.id);
    assert.ok(created.ok);
    const token = created.url.split('/').at(-1);
    assert.ok(token);
    const input = {
      title: 'Recipient interval',
      scheduledDate: '2026-11-10',
      athleteId: owner.id,
      coachOwnerId: owner.id,
      templateId: 999,
      coachNotes: 'Private injected note',
      athleteNotes: 'Private injected note',
    };
    const coachCopy = await service.savePlannerCopy(coach.id, 'COACH', token, input);
    assert.ok(coachCopy.ok);
    const coachWorkout = await db.session.findUniqueOrThrow({ where: { id: coachCopy.sessionIds[0] } });
    assert.equal(coachWorkout.coachOwnerId, coach.id);
    assert.equal(coachWorkout.athleteId, null);
    assert.equal(coachWorkout.date, null);
    assert.equal(coachWorkout.planId, null);
    assert.equal(coachWorkout.templateId, null);
    const visibleWorkouts = await createWorkoutLibraryService({ db }).listForOwner('coach', coach.id);
    assert.equal(visibleWorkouts.length, 1);
    assert.equal(visibleWorkouts[0].id, coachWorkout.id);

    const athleteCopy = await service.savePlannerCopy(athlete.id, 'ATHLETE', token, input);
    assert.ok(athleteCopy.ok);
    const scheduled = await db.session.findUniqueOrThrow({ where: { id: athleteCopy.sessionIds[0] }, include: { blocks: true } });
    assert.equal(scheduled.athleteId, athlete.id);
    assert.equal(scheduled.coachOwnerId, null);
    assert.ok(scheduled.date && scheduled.planId);
    assert.equal(scheduled.date.getDate(), 10);
    assert.equal(scheduled.blocks[0].durationSec, 20);
    assert.equal(scheduled.athleteNotes, null);
    assert.equal(scheduled.coachNotes, null);

    assert.deepEqual(await service.saveTemplateCopy(athlete.id, token, input), { ok: true });
    const templates = await createTemplateService({ db }).listForOwner(athlete.id);
    assert.equal(templates.length, 1);
    assert.equal(templates[0].name, 'Recipient interval');
    assert.equal(parseTemplateRoutine(templates[0].routineJson)?.entries[0]?.blocks[0]?.durationSec, 20);
    await db.session.update({ where: { id: source.id }, data: { title: 'Changed source', blocks: { updateMany: { where: {}, data: { durationSec: 600 } } } } });
    assert.equal((await service.loadPreview(token))?.title, 'Shared short interval');
    assert.equal((await db.block.findUniqueOrThrow({ where: { id: scheduled.blocks[0].id } })).durationSec, 20);
  });
});
