import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.ts';
import { createCoachPlannerService } from '../lib/coach-planner-service.ts';
import { createCoachSessionLibraryService } from '../lib/coach-session-library-service.ts';
import { createCoachTrainingPlanService } from '../lib/coach-training-plan-service.ts';
import { createAthleteSessionAdjustmentService } from '../lib/athlete-session-adjustment-service.ts';
import { createAthleteCompletionService } from '../lib/athlete-completion-service.ts';
import { addSessionEditorBlock, createEmptySessionEditorDraft } from '../lib/session-editor.ts';
import { addPlannerBlock, createEmptyPlannerSessionDraft } from '../lib/planner-draft.ts';
import { plannerSessionInput, sessionEditorInput } from '../lib/session-write-input.ts';

const noDatabase = new Proxy(prisma, { get() { throw new Error('Something went wrong. Reload the page and try again. reached the database'); } });
const coachPlanner = createCoachPlannerService({ db: noDatabase });
const coachLibrary = createCoachSessionLibraryService({ db: noDatabase });
const trainingPlans = createCoachTrainingPlanService({ db: noDatabase });
async function databaseAccess(): Promise<never> { throw new Error('Something went wrong. Reload the page and try again. reached the database'); }
const noSessionDatabase = {
  session: { findUnique: databaseAccess, update: databaseAccess },
  plan: { findFirst: databaseAccess, create: databaseAccess },
  block: { deleteMany: databaseAccess },
  assignment: { updateMany: databaseAccess },
  activity: { upsert: databaseAccess, update: databaseAccess, delete: databaseAccess },
  $transaction: databaseAccess,
};
const adjustments = createAthleteSessionAdjustmentService({ db: noSessionDatabase });
const outcomes = createAthleteCompletionService({ db: noSessionDatabase });

const editor = addSessionEditorBlock(createEmptySessionEditorDraft({ mode: 'planned', title: 'Run', athleteId: 7, scheduledDate: '2026-11-17' }), { durationSec: 300 });
const planner = addPlannerBlock(createEmptyPlannerSessionDraft({ ownershipMode: 'athlete', athleteId: 7, scheduledDate: '2026-11-17' }));
planner.title = 'Run';

const primitives: unknown[] = [undefined, null, false, 3, 'draft', [], {}];
const invalidPlanner = [
  ...primitives,
  { ...planner, title: 3 }, { ...planner, summary: null }, { ...planner, sportMetrics: null },
  { ...planner, blocks: {} }, { ...planner, blocks: [null] },
  { ...planner, blocks: [{ ...planner.blocks[0], note: 3 }] },
  { ...planner, blocks: [{ ...planner.blocks[0], targetLow: '87.5' }] },
];
const invalidEditor = [
  ...primitives,
  { ...editor, title: 3 }, { ...editor, coachNotes: null }, { ...editor, athleteNotes: [] },
  { ...editor, blocks: {} }, { ...editor, blocks: [null] },
  { ...editor, blocks: [{ ...editor.blocks[0], target: {} }] },
  { ...editor, blocks: [{ ...editor.blocks[0], durationSec: '300' }] },
];

for (const [name, save] of [
  ['coach planner', (input: unknown) => coachPlanner.saveSession(2, input)],
  ['coach library', (input: unknown) => coachLibrary.saveForCoach(2, input)],
  ['training-plan session', (input: unknown) => trainingPlans.savePlanSession(2, 1, input)],
] satisfies Array<[string, (input: unknown) => Promise<{ ok: boolean; status?: number }>]> ) {
  test(`${name} rejects malformed session shapes before database access`, async () => {
    for (const input of invalidPlanner) {
      const result = await save(input);
      assert.equal(result.ok, false);
      assert.equal(result.status, 400);
    }
  });
}

for (const [name, save] of [
  ['planned adjustment', (input: unknown) => adjustments.savePlannedSession(7, 1, input)],
  ['actual correction', (input: unknown) => outcomes.saveActualOutcome({ role: 'ATHLETE', userId: 7 }, 1, input)],
] satisfies Array<[string, (input: unknown) => Promise<{ ok: boolean; status?: number }>]> ) {
  test(`${name} rejects malformed fields and targets without reading or mutating sessions`, async () => {
    for (const input of invalidEditor) {
      const result = await save(input);
      assert.equal(result.ok, false);
      assert.equal(result.status, 400);
    }
  });
}

for (const [name, save] of [
  ['create', (input: unknown) => trainingPlans.createPlan(2, input)],
  ['update', (input: unknown) => trainingPlans.updatePlan(2, 1, input)],
] satisfies Array<[string, (input: unknown) => Promise<{ ok: boolean; status?: number }>]> ) {
  test(`plan ${name} rejects malformed metadata before database access`, async () => {
    for (const input of [...primitives, { name: 1, sport: 'RUNNING' }, { name: 'Run', sport: 3 }, { name: 'Run', sport: 'RUNNING', summary: [] }]) {
      const result = await save(input);
      assert.equal(result.ok, false);
      assert.equal(result.status, 400);
    }
  });
}

test('transport accepts established optional planner fields and ignores unrelated extra properties', () => {
  const optionalPlanner = structuredClone(planner);
  delete optionalPlanner.id;
  delete optionalPlanner.blocks[0].id;
  delete optionalPlanner.blocks[0].skipped;
  const parsed = plannerSessionInput.safeParse({ ...optionalPlanner, extra: true });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal('extra' in parsed.data, false);
  assert.equal(parsed.data.blocks[0].skipped, undefined);
  assert.equal(parsed.data.id, undefined);
  assert.equal(sessionEditorInput.safeParse({ ...editor, extra: true }).success, true);
});

test('transport does not round invalid durations into valid planned sessions', async () => {
  const result = await adjustments.savePlannedSession(7, 1, { ...editor, blocks: [{ ...editor.blocks[0], durationSec: 1.5 }] });
  assert.equal(result.ok, false);
  assert.equal(result.ok ? undefined : result.status, 400);
  assert.equal(result.ok ? undefined : result.error, 'Every step needs a duration.');
});
