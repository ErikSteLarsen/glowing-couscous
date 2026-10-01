import test from 'node:test';
import assert from 'node:assert/strict';
import { anonymizeAssignedSnapshot, anonymizeSharedWorkout } from '../lib/account-deletion-privacy.ts';
import { createSharedWorkoutProjection, parseSharedWorkoutProjection } from '../lib/share-link.ts';
import { createSessionSnapshotJson, deserializeSessionSnapshot } from '../lib/session-snapshot-service.ts';

test('retained share removes free text and unknown fields while preserving workout structure and targets', () => {
  const original = createSharedWorkoutProjection({ sourceKind: 'session', sport: 'RUNNING', title: 'Personal name', summary: 'email@example.test', blocks: [{ kind: 'work', zone: 4, durationSec: 300, reps: 4, targetType: 'pace', targetLow: 240, targetHigh: 250, note: 'Private address' }] });
  const json = anonymizeSharedWorkout(JSON.stringify({ ...original, ownerEmail: 'email@example.test' }));
  const retained = parseSharedWorkoutProjection(json)!;
  assert.equal(retained.title, 'Shared workout'); assert.equal(retained.summary, '');
  assert.deepEqual(retained.blocks, original.blocks.map((block) => ({ ...block, note: '' })));
  assert.deepEqual(retained.metrics, original.metrics);
  for (const secret of ['Personal name', 'email@example.test', 'Private address', 'ownerEmail']) assert.equal(json.includes(secret), false);
});

test('invalid retained snapshot fails closed instead of keeping a corrupt personal blob', () => {
  for (const raw of ['private@email.test', '{"owner":"secret"}', '{']) {
    const json = anonymizeSharedWorkout(raw);
    const retained = JSON.parse(json);
    assert.equal(retained.blocks.length, 0); assert.equal(retained.title, 'Shared workout');
    assert.equal(parseSharedWorkoutProjection(json), null); // Corrupt content stays unavailable.
    assert.equal(json.includes('secret'), false); assert.equal(json.includes('private@'), false);
  }
});

test('assigned snapshots remove coach text and lineage while preserving recipient actual notes', () => {
  const input = createSessionSnapshotJson({ sport: 'RUNNING', title: 'Coach name', summary: 'Coach email', coachOwnerId: 42, assignedById: 42, trainingPlanId: 13, templateId: 15, athleteId: 17, coachNotes: 'Coach address', athleteNotes: 'Recipient own notes', blocks: [{ kind: 'work', zone: 2, durationSec: 120, note: 'Coach instruction' }] });
  const actual = deserializeSessionSnapshot('actual', anonymizeAssignedSnapshot(input, true))!;
  assert.equal(actual.athleteId, 17); assert.equal(actual.athleteNotes, 'Recipient own notes');
  assert.equal(actual.coachOwnerId, null); assert.equal(actual.assignedById, null); assert.equal(actual.templateId, null);
  assert.equal(actual.coachNotes, ''); assert.equal(actual.blocks[0].note, '');
  const planned = deserializeSessionSnapshot('planned', anonymizeAssignedSnapshot(input, false))!;
  assert.equal(planned.athleteNotes, ''); assert.equal(planned.blocks[0].durationSec, 120);
  assert.equal(anonymizeAssignedSnapshot('broken', false), null);
});
