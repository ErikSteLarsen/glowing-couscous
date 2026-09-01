import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPlannerEditorDraftFromSharedProjection,
  createTemplateEditorDraftFromSharedProjection,
} from '../lib/session-editor-adapters.ts';
import {
  createSharedWorkoutProjection,
  parseSharedWorkoutProjection,
} from '../lib/share-link.ts';

test('shared projection keeps workout definition content and drops private session fields', () => {
  const projection = createSharedWorkoutProjection({
    sourceKind: 'session',
    sport: 'RUNNING',
    title: 'Threshold session',
    summary: 'Controlled work',
    blocks: [
      {
        id: 91,
        kind: 'work',
        zone: 4,
        durationSec: 900,
        reps: 3,
        targetType: 'pace',
        targetLow: 240,
        targetHigh: 250,
        note: 'Hold form',
        skipped: false,
        sortOrder: 0,
      },
    ],
  });

  assert.deepEqual(projection, {
    snapshotVersion: 1,
    sourceKind: 'session',
    sport: 'RUNNING',
    title: 'Threshold session',
    summary: 'Controlled work',
    blocks: [
      {
        kind: 'work',
        zone: 4,
        durationSec: 900,
        reps: 3,
        target: { type: 'pace', low: 240, high: 250 },
        note: 'Hold form',
        skipped: false,
      },
    ],
    metrics: {
      durationSec: 900,
      tss: 24,
      segments: [
        {
          key: 'work-0',
          zone: 4,
          durationSec: 900,
          label: 'Z4 Threshold',
          color: '#F97316',
          tint: '#FEEDE0',
        },
      ],
    },
  });
  assert.equal('id' in projection, false);
  assert.equal('scheduledDate' in projection, false);
  assert.equal('rpe' in projection, false);
});

test('shared projection excludes skipped blocks from derived metrics', () => {
  const projection = createSharedWorkoutProjection({
    sourceKind: 'template',
    name: 'Mixed session',
    sport: 'BIKING',
    blocks: [
      { kind: 'work', zone: 4, durationSec: 1200, skipped: true, sortOrder: 0 },
      { kind: 'recovery', zone: 1, durationSec: 300, skipped: false, sortOrder: 1 },
    ],
  });

  assert.equal(projection.blocks.length, 2);
  assert.equal(projection.metrics.durationSec, 300);
  assert.equal(projection.metrics.tss, 3);
});

test('shared import creates independent canonical drafts with no source identity or schedule', () => {
  const projection = createSharedWorkoutProjection({
    sourceKind: 'template',
    name: 'Shared workout',
    sport: 'SWIMMING',
    summary: 'Public summary',
    blocks: [{ kind: 'work', zone: 3, durationSec: 600, sortOrder: 0 }],
  });

  const templateDraft = createTemplateEditorDraftFromSharedProjection(projection);
  const athleteDraft = createPlannerEditorDraftFromSharedProjection(projection, {
    ownershipMode: 'athlete',
    athleteId: 12,
    scheduledDate: '2026-09-04',
  });
  const coachDraft = createPlannerEditorDraftFromSharedProjection(projection, {
    ownershipMode: 'coach-library',
    scheduledDate: '2026-09-04',
  });

  for (const draft of [templateDraft, athleteDraft, coachDraft]) {
    assert.equal(draft.mode, 'create');
    assert.equal(draft.id, null);
    assert.equal(draft.templateId, null);
    assert.equal(draft.coachOwnerId, null);
    assert.equal(draft.planId, null);
    assert.equal(draft.trainingPlanId, null);
    assert.equal(draft.assignedById, null);
    assert.equal(draft.status, 'planned');
    assert.equal(draft.source, 'share');
    assert.equal(draft.coachNotes, '');
    assert.equal(draft.athleteNotes, '');
    assert.equal(draft.rpe, null);
  }
  assert.equal(templateDraft.scheduledDate, null);
  assert.equal(athleteDraft.athleteId, 12);
  assert.equal(athleteDraft.scheduledDate, '2026-09-04');
  assert.equal(coachDraft.scheduledDate, '2026-09-04');
  assert.equal(coachDraft.ownershipMode, 'coach-library');
});

test('shared projection parser rejects malformed snapshots', () => {
  assert.equal(parseSharedWorkoutProjection(undefined), null);
  assert.equal(parseSharedWorkoutProjection('{"snapshotVersion":1}'), null);
});
