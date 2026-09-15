import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addSessionEditorBlock,
  createEmptySessionEditorDraft,
  createSessionEditorDraftFromPersisted,
  deriveSessionEditorMetrics,
  hasBaselineActualDifference,
  moveSessionEditorBlock,
  removeSessionEditorBlock,
  serializeSessionEditorDraft,
  updateSessionEditorBlock,
  updateSessionEditorFields,
  updateSessionEditorSchedule,
  validateSessionEditorDraft,
} from '../lib/session-editor.ts';

test('session editor creates an empty coach draft without inventing session content', () => {
  const draft = createEmptySessionEditorDraft({ scheduledDate: '2026-08-25' });

  assert.equal(draft.mode, 'create');
  assert.equal(draft.status, 'planned');
  assert.equal(draft.scheduledDate, '2026-08-25');
  assert.equal(draft.sport, 'RUNNING');
  assert.equal(draft.title, '');
  assert.equal(draft.summary, '');
  assert.equal(draft.coachNotes, '');
  assert.equal(draft.athleteNotes, '');
  assert.equal(draft.rpe, null);
  assert.deepEqual(draft.blocks, []);
});

test('session editor initializes all session fields from persisted data', () => {
  const draft = createSessionEditorDraftFromPersisted('actual', {
    id: 42,
    athleteId: 7,
    coachOwnerId: 3,
    trainingPlanId: 9,
    planId: 11,
    templateId: 13,
    assignedById: 3,
    date: new Date('2026-08-28T00:00:00.000Z'),
    planWeekday: null,
    timeLabel: '06:30',
    sport: 'BIKING',
    title: 'Morning over-unders',
    summary: 'Controlled pressure.',
    coachNotes: 'Hold form.',
    athleteNotes: 'Felt smooth.',
    rpe: 8,
    sportMetricsJson: JSON.stringify({ ftp: 305, thresholdPaceSecPerKm: 255, thresholdHr: 172 }),
    status: 'completed',
    source: 'template',
    adjusted: true,
    blocks: [
      {
        id: 2,
        kind: 'work',
        zone: 4,
        durationSec: 480,
        reps: 3,
        targetType: 'power',
        targetLow: 250,
        targetHigh: 270,
        note: 'Three rounds',
        skipped: true,
        sortOrder: 1,
      },
      {
        id: 1,
        kind: 'warmup',
        zone: 1,
        durationSec: 600,
        reps: null,
        targetType: null,
        targetLow: null,
        targetHigh: null,
        note: null,
        sortOrder: 0,
      },
    ],
  });

  assert.deepEqual(draft, {
    mode: 'actual',
    id: 42,
    athleteId: 7,
    coachOwnerId: 3,
    trainingPlanId: 9,
    planId: 11,
    templateId: 13,
    assignedById: 3,
    scheduledDate: '2026-08-28',
    planWeekday: null,
    timeLabel: '06:30',
    sport: 'BIKING',
    title: 'Morning over-unders',
    summary: 'Controlled pressure.',
    coachNotes: 'Hold form.',
    athleteNotes: 'Felt smooth.',
    rpe: 8,
    sportMetrics: { ftp: 305, thresholdPaceSecPerKm: 255, thresholdHr: 172 },
    status: 'completed',
    source: 'template',
    adjusted: true,
    blocks: [
      {
        clientId: 'session-42-block-1',
        id: 1,
        kind: 'warmup',
        zone: 1,
        durationSec: 600,
        reps: null,
        target: null,
        note: '',
        skipped: false,
      },
      {
        clientId: 'session-42-block-2',
        id: 2,
        kind: 'work',
        zone: 4,
        durationSec: 480,
        reps: 3,
        target: { metric: 'power', mode: 'absolute', reference: null, low: 250, high: 270 },
        note: 'Three rounds',
        skipped: true,
      },
    ],
  });
});

test('session editor keeps create, planned, and actual modes explicit', () => {
  assert.equal(createEmptySessionEditorDraft({ mode: 'create' }).mode, 'create');
  assert.equal(createEmptySessionEditorDraft({ mode: 'planned' }).mode, 'planned');
  assert.equal(createEmptySessionEditorDraft({ mode: 'actual' }).mode, 'actual');

  const completed = createSessionEditorDraftFromPersisted('actual', {
    status: 'completed',
    blocks: [],
  });
  const edited = updateSessionEditorFields(completed, { title: 'Corrected actual' });
  assert.equal(edited.mode, 'actual');
  assert.equal(edited.status, 'completed');
});

test('session editor updates all editable session fields and schedule independently', () => {
  const draft = createEmptySessionEditorDraft();
  const updated = updateSessionEditorFields(draft, {
    sport: 'SWIMMING',
    title: 'Technique set',
    summary: 'Long form.',
    coachNotes: 'Keep the stroke quiet.',
    athleteNotes: 'Shoulder felt good.',
    sportMetrics: { ftp: null, thresholdPaceSecPerKm: 90, thresholdHr: 165 },
    rpe: 6,
  });
  const scheduled = updateSessionEditorSchedule(updated, {
    scheduledDate: '2026-09-01',
    planWeekday: 2,
    timeLabel: '07:15',
  });

  assert.equal(scheduled.sport, 'SWIMMING');
  assert.equal(scheduled.title, 'Technique set');
  assert.equal(scheduled.summary, 'Long form.');
  assert.equal(scheduled.coachNotes, 'Keep the stroke quiet.');
  assert.equal(scheduled.athleteNotes, 'Shoulder felt good.');
  assert.deepEqual(scheduled.sportMetrics, { ftp: null, thresholdPaceSecPerKm: 90, thresholdHr: 165 });
  assert.equal(scheduled.rpe, 6);
  assert.equal(scheduled.scheduledDate, '2026-09-01');
  assert.equal(scheduled.planWeekday, 2);
  assert.equal(scheduled.timeLabel, '07:15');
});

test('session editor adds, updates, removes, and reorders blocks immutably', () => {
  const draft = createEmptySessionEditorDraft();
  const added = addSessionEditorBlock(draft, {
    kind: 'work',
    zone: 3,
    durationSec: 900,
    reps: 4,
    target: { type: 'pace', low: 240, high: 250 },
    note: 'Cruise intervals',
  });
  const addedRecovery = addSessionEditorBlock(added, { kind: 'recovery', zone: 1, durationSec: 300 });
  const updated = updateSessionEditorBlock(addedRecovery, 0, {
    kind: 'cooldown',
    zone: 2,
    durationSec: 360,
    reps: 2,
    target: null,
    note: 'Easy finish',
  });
  const reordered = moveSessionEditorBlock(updated, 0, 1);
  const removed = removeSessionEditorBlock(reordered, 0);

  assert.equal(draft.blocks.length, 0);
  assert.equal(added.blocks.length, 1);
  assert.equal(addedRecovery.blocks.length, 2);
  assert.deepEqual(updated.blocks[0], {
    ...added.blocks[0],
    kind: 'cooldown',
    zone: 2,
    durationSec: 360,
    reps: 2,
    target: null,
    note: 'Easy finish',
  });
  assert.equal(reordered.blocks[1].kind, 'cooldown');
  assert.equal(removed.blocks.length, 1);
  assert.equal(removed.blocks[0].kind, 'cooldown');
});

test('session editor represents skipped blocks and excludes them from Tempo metrics', () => {
  const draft = addSessionEditorBlock(createEmptySessionEditorDraft(), {
    kind: 'work',
    zone: 4,
    durationSec: 600,
    skipped: true,
  });
  const active = addSessionEditorBlock(draft, { kind: 'recovery', zone: 1, durationSec: 300 });

  assert.equal(active.blocks[0].skipped, true);
  assert.deepEqual(deriveSessionEditorMetrics(active), {
    durationSec: 300,
    tss: 3,
    zoneDistributionSec: [300, 0, 0, 0, 0],
    segments: [
      {
        key: 'recovery-0',
        zone: 1,
        durationSec: 300,
        label: 'Z1 Recovery',
        color: '#3B82F6',
        tint: '#E8F0FE',
      },
    ],
  });
});

test('session editor validates duration, repetitions, targets, schedule, and RPE', () => {
  const draft = addSessionEditorBlock(
    updateSessionEditorFields(createEmptySessionEditorDraft({ scheduledDate: '2026-08-25' }), { title: 'Valid set' }),
    { durationSec: 600 },
  );

  assert.equal(
    validateSessionEditorDraft({ ...draft, blocks: [{ ...draft.blocks[0], durationSec: 0 }] }),
    'Every block needs a positive integer duration.',
  );
  assert.equal(
    validateSessionEditorDraft({ ...draft, blocks: [{ ...draft.blocks[0], reps: 1.5 }] }),
    'Repetitions must be a positive integer when provided.',
  );
  assert.equal(
    validateSessionEditorDraft({
      ...draft,
      blocks: [{ ...draft.blocks[0], target: { type: 'power', low: 280, high: 260 } }],
    }),
    'Target low must be less than or equal to target high.',
  );
  assert.equal(
    validateSessionEditorDraft({
      ...draft,
      blocks: [{ ...draft.blocks[0], target: { type: 'power', low: -1, high: 260 } }],
    }),
    'Target values must be non-negative numbers.',
  );
  assert.equal(validateSessionEditorDraft({ ...draft, rpe: 0 }), 'RPE must be an integer from 1 through 10.');
  assert.equal(validateSessionEditorDraft({ ...draft, rpe: 11 }), 'RPE must be an integer from 1 through 10.');
  assert.equal(validateSessionEditorDraft({ ...draft, rpe: 7 }), null);
  assert.equal(validateSessionEditorDraft({ ...draft, rpe: null }), null);
  assert.equal(
    validateSessionEditorDraft({ ...draft, scheduledDate: 'not-a-date' }),
    'Scheduled date must be a valid calendar date.',
  );
  assert.equal(
    validateSessionEditorDraft({ ...draft, planWeekday: 8 as never }),
    'Plan weekday must be an integer from 1 through 7.',
  );
});

test('session editor serializes canonical fields into the persistence block shape', () => {
  const draft = updateSessionEditorSchedule(
    updateSessionEditorFields(
      addSessionEditorBlock(createEmptySessionEditorDraft(), {
        id: 5,
        kind: 'work',
        zone: 3,
        durationSec: 900,
        reps: 2,
        target: { type: 'hr', low: 150, high: 165 },
        note: '  Hold steady  ',
        skipped: true,
      }),
      {
        title: '  Threshold  ',
        summary: '  Main set  ',
        coachNotes: '  Coach cue  ',
        athleteNotes: '  Athlete context  ',
        rpe: 5,
      },
    ),
    { scheduledDate: '2026-08-30', timeLabel: '06:00' },
  );

  assert.deepEqual(serializeSessionEditorDraft(draft), {
    id: null,
    athleteId: null,
    coachOwnerId: null,
    trainingPlanId: null,
    planId: null,
    templateId: null,
    assignedById: null,
    scheduledDate: '2026-08-30',
    planWeekday: null,
    timeLabel: '06:00',
    sport: 'RUNNING',
    title: 'Threshold',
    summary: 'Main set',
    coachNotes: 'Coach cue',
    athleteNotes: 'Athlete context',
    rpe: 5,
    sportMetrics: { ftp: null, thresholdPaceSecPerKm: null, thresholdHr: null },
    status: 'planned',
    source: 'coach',
    adjusted: false,
    blocks: [
      {
        id: 5,
        kind: 'work',
        zone: 3,
        durationSec: 900,
        reps: 2,
        targetType: 'hr',
        targetMode: 'absolute',
        targetReference: null,
        targetLow: 150,
        targetHigh: 165,
        targetLowDecimal: '150',
        targetHighDecimal: '165',
        note: 'Hold steady',
        skipped: true,
        sortOrder: 0,
      },
    ],
  });
});

test('session editor difference identity includes blocks and schedule only', () => {
  const baseline = addSessionEditorBlock(createEmptySessionEditorDraft({ scheduledDate: '2026-08-25' }), {
    kind: 'work',
    zone: 3,
    durationSec: 900,
  });

  for (const patch of [
    { title: 'New title' },
    { sport: 'BIKING' },
    { summary: 'New summary' },
    { coachNotes: 'New coach note' },
    { athleteNotes: 'New athlete note' },
    { rpe: 9 },
  ]) {
    assert.equal(hasBaselineActualDifference(baseline, updateSessionEditorFields(baseline, patch)), false);
  }

  assert.equal(
    hasBaselineActualDifference(
      baseline,
      updateSessionEditorBlock(baseline, 0, { durationSec: 960 }),
    ),
    true,
  );
  assert.equal(
    hasBaselineActualDifference(
      baseline,
      updateSessionEditorSchedule(baseline, { scheduledDate: '2026-08-26' }),
    ),
    true,
  );
  assert.equal(
    hasBaselineActualDifference(
      baseline,
      updateSessionEditorBlock(baseline, 0, { skipped: true }),
    ),
    true,
  );
});
