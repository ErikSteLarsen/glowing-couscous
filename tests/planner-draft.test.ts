import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addPlannerBlock,
  createEmptyPlannerSessionDraft,
  duplicatePlannerBlock,
  movePlannerBlock,
  parseSportMetricsJson,
  plannerDraftToTempoBlocks,
  serializePlannerDraftForSave,
  templateToPlannerDraft,
  updatePlannerBlock,
  validatePlannerSessionDraft,
} from '../lib/planner-draft.ts';

test('createEmptyPlannerSessionDraft seeds a professional default workout', () => {
  const draft = createEmptyPlannerSessionDraft({
    athleteId: 5,
    scheduledDate: '2026-06-25',
  });

  assert.equal(draft.athleteId, 5);
  assert.equal(draft.scheduledDate, '2026-06-25');
  assert.equal(draft.sport, 'RUNNING');
  assert.equal(draft.blocks.length, 3);
  assert.deepEqual(
    draft.blocks.map((block) => [block.kind, block.zone, block.durationSec]),
    [
      ['warmup', 1, 600],
      ['work', 3, 1800],
      ['cooldown', 1, 600],
    ],
  );
});

test('planner block helpers add, update, duplicate, and reorder immutable drafts', () => {
  const draft = createEmptyPlannerSessionDraft({ athleteId: 5, scheduledDate: '2026-06-25' });
  const added = addPlannerBlock(draft, 'recovery');
  const updated = updatePlannerBlock(added, added.blocks.length - 1, {
    zone: 2,
    durationSec: 300,
    note: 'Float recovery',
  });
  const duplicated = duplicatePlannerBlock(updated, updated.blocks.length - 1);
  const moved = movePlannerBlock(duplicated, duplicated.blocks.length - 1, 1);

  assert.equal(draft.blocks.length, 3);
  assert.equal(added.blocks.length, 4);
  assert.equal(updated.blocks.at(-1)?.note, 'Float recovery');
  assert.equal(duplicated.blocks.length, 5);
  assert.notEqual(duplicated.blocks.at(-1)?.clientId, updated.blocks.at(-1)?.clientId);
  assert.equal(moved.blocks[1].note, 'Float recovery');
});

test('templateToPlannerDraft preloads template blocks for a chosen athlete and date', () => {
  const draft = templateToPlannerDraft(
    {
      id: 8,
      sport: 'BIKING',
      name: 'Over-unders',
      summary: 'Controlled aerobic pressure.',
      blocks: [
        {
          id: 80,
          kind: 'work',
          zone: 4,
          durationSec: 720,
          reps: 3,
          targetType: 'power',
          targetLow: 250,
          targetHigh: 270,
          note: 'Three rounds',
          sortOrder: 0,
        },
      ],
    },
    { athleteId: 5, scheduledDate: '2026-06-25' },
  );

  assert.equal(draft.sourceTemplateId, 8);
  assert.equal(draft.title, 'Over-unders');
  assert.equal(draft.sport, 'BIKING');
  assert.equal(draft.blocks[0].targetType, 'power');
  assert.equal(draft.blocks[0].targetLow, 250);
});

test('validatePlannerSessionDraft catches missing title and invalid targets', () => {
  const draft = createEmptyPlannerSessionDraft({ athleteId: 5, scheduledDate: '2026-06-25' });

  assert.equal(validatePlannerSessionDraft({ ...draft, title: '' }), 'Session title is required.');
  assert.equal(
    validatePlannerSessionDraft({
      ...draft,
      title: 'Threshold',
      blocks: [{ ...draft.blocks[0], durationSec: 0 }],
    }),
    'Every block needs a positive duration.',
  );
  assert.equal(
    validatePlannerSessionDraft({
      ...draft,
      title: 'Threshold',
      blocks: [{ ...draft.blocks[0], targetType: 'power', targetLow: 280, targetHigh: 260 }],
    }),
    'Target range low must be less than or equal to target high.',
  );
});

test('plannerDraftToTempoBlocks projects block drafts into metric-ready Tempo blocks', () => {
  const draft = {
    ...createEmptyPlannerSessionDraft({ athleteId: 5, scheduledDate: '2026-06-25' }),
    title: 'Steady endurance',
  };

  const tempoBlocks = plannerDraftToTempoBlocks(draft.blocks);

  assert.equal(tempoBlocks.length, 3);
  assert.deepEqual(tempoBlocks[1], {
    kind: 'work',
    zone: 3,
    durationSec: 1800,
    reps: null,
    target: null,
  });
});

test('validatePlannerSessionDraft enforces standalone coach session rules', () => {
  const draft = createEmptyPlannerSessionDraft({
    ownershipMode: 'coach-library',
    scheduledDate: '2026-06-25',
  });

  assert.equal(validatePlannerSessionDraft({ ...draft, scheduledDate: '' }), 'A coach session date is required.');
  assert.equal(
    validatePlannerSessionDraft({ ...draft, planWeekday: 3 }),
    'Standalone coach sessions cannot have a training-plan weekday.',
  );
});

test('validatePlannerSessionDraft enforces training-plan session weekday rules', () => {
  const draft = createEmptyPlannerSessionDraft({
    ownershipMode: 'training-plan',
    scheduledDate: null,
  });

  assert.equal(validatePlannerSessionDraft({ ...draft, planWeekday: null }), 'Choose a weekday for the training-plan session.');
  assert.equal(
    validatePlannerSessionDraft({ ...draft, scheduledDate: '2026-06-25', planWeekday: 2 }),
    'Training-plan sessions use a weekday instead of a fixed date.',
  );
});

test('serializePlannerDraftForSave preserves shared sport metrics', () => {
  const draft = {
    ...createEmptyPlannerSessionDraft({
      ownershipMode: 'coach-library',
      scheduledDate: '2026-06-25',
    }),
    title: 'Bike threshold',
    sport: 'BIKING',
    sportMetrics: {
      ftp: 305,
      thresholdPaceSecPerKm: null,
      thresholdHr: 172,
    },
  };

  assert.deepEqual(serializePlannerDraftForSave(draft).sportMetrics, {
    ftp: 305,
    thresholdPaceSecPerKm: null,
    thresholdHr: 172,
  });
});

test('parseSportMetricsJson returns parsed metrics from a valid JSON string', () => {
  const json = JSON.stringify({ ftp: 280, thresholdPaceSecPerKm: 255, thresholdHr: 168 });
  const result = parseSportMetricsJson(json);
  assert.deepEqual(result, { ftp: 280, thresholdPaceSecPerKm: 255, thresholdHr: 168 });
});

test('parseSportMetricsJson returns empty metrics for null, undefined, or invalid input', () => {
  const empty = { ftp: null, thresholdPaceSecPerKm: null, thresholdHr: null };
  assert.deepEqual(parseSportMetricsJson(null), empty);
  assert.deepEqual(parseSportMetricsJson(undefined), empty);
  assert.deepEqual(parseSportMetricsJson('not-json'), empty);
  assert.deepEqual(parseSportMetricsJson('{}'), empty);
});
