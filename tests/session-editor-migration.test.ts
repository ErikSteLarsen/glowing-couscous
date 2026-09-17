import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createEmptyPlannerEditorDraft,
  createTemplateEditorDraftFromRecord,
  serializePlannerEditorDraftForSave,
  serializeTemplateEditorDraftForSave,
  updatePlannerEditorBlock,
} from '../lib/session-editor-adapters.ts';

const root = process.cwd();
const read = (relativePath: string) => readFile(path.join(root, relativePath), 'utf8');

test('planner editor adapter preserves ownership modes while using canonical blocks', () => {
  const draft = createEmptyPlannerEditorDraft({
    ownershipMode: 'training-plan',
    scheduledDate: null,
    planWeekday: 3,
  });
  const updated = updatePlannerEditorBlock(draft, 1, {
    target: { metric: 'power', mode: 'absolute', reference: null, low: 250, high: 270 },
    skipped: true,
  });
  const payload = serializePlannerEditorDraftForSave(updated);

  assert.equal(updated.ownershipMode, 'training-plan');
  assert.equal(updated.planWeekday, 3);
  assert.equal(updated.blocks[1].skipped, true);
  assert.deepEqual(payload.blocks[1], {
    id: null,
    kind: 'work',
    zone: 3,
    durationSec: 1800,
    reps: null,
    targetType: 'power',
    targetMode: 'absolute',
    targetReference: null,
    targetLow: 250,
    targetHigh: 270,
    targetLowDecimal: '250',
    targetHighDecimal: '270',
    note: 'Main work',
    skipped: true,
    sortOrder: 1,
  });
});

test('template editor adapter initializes and serializes the canonical session draft', () => {
  const draft = createTemplateEditorDraftFromRecord({
    id: 8,
    sport: 'BIKING',
    name: 'Over-unders',
    summary: 'Controlled pressure.',
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
  });

  assert.equal(draft.mode, 'create');
  assert.equal(draft.title, 'Over-unders');
  assert.equal(draft.blocks[0].target?.metric, 'power');
  assert.deepEqual(serializeTemplateEditorDraftForSave(draft), {
    name: 'Over-unders',
    sport: 'BIKING',
    summary: 'Controlled pressure.',
    blocks: [
      {
        id: 80,
        kind: 'work',
        zone: 4,
        durationSec: 720,
        reps: 3,
        targetType: 'power',
        targetMode: 'absolute',
        targetReference: null,
        targetLow: 250,
        targetHigh: 270,
        targetLowDecimal: '250',
        targetHighDecimal: '270',
        note: 'Three rounds',
        skipped: false,
        sortOrder: 0,
      },
    ],
  });
});

test('libraries and session detail own editing while planners place sources', async () => {
  const [coachPlannerSource, athletePlannerSource, templatesSource, composerSource] = await Promise.all([
    read('app/(app)/coach/planner/PlannerClient.tsx'),
    read('app/(app)/athlete/planner/AthletePlannerClient.tsx'),
    read('app/(app)/coach/templates/CoachTemplatesClient.tsx'),
    read('components/WorkoutBuilder.tsx'),
  ]);

  assert.doesNotMatch(coachPlannerSource, /WorkoutBuilder/);
  assert.doesNotMatch(athletePlannerSource, /WorkoutBuilder/);
  assert.match(templatesSource, /WorkoutBuilder/);
  assert.match(composerSource, /@dnd-kit/);
  assert.doesNotMatch(coachPlannerSource, /from ['"]@\/lib\/planner-draft['"]/);
  assert.doesNotMatch(templatesSource, /type TemplateDraftBlock/);
  assert.doesNotMatch(coachPlannerSource, /duplicatePlannerBlock/);
});
