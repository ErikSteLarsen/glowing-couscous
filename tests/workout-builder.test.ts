import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySessionEditorDraft, createSessionEditorBlock, deriveSessionEditorMetrics, validateSessionEditorDraft, type SessionEditorBlock } from '../lib/session-editor.ts';
import {
  addStepToSet,
  buildBuilderRows,
  createStepBlocks,
  duplicateRow,
  locateBlock,
  moveRow,
  moveSetStep,
  nudgeDuration,
  parseDuration,
  patchSetStep,
  removeRow,
  removeSetStep,
  repeatWithNext,
  representativeIndex,
  setRepeatCount,
  stepName,
  zonePatch,
  zoneTotals,
  type BuilderSetRow,
} from '../lib/workout-builder.ts';

function step(kind: SessionEditorBlock['kind'], zone: SessionEditorBlock['zone'], durationSec: number, extra: Partial<SessionEditorBlock> = {}) {
  return createSessionEditorBlock({ kind, zone, durationSec, ...extra });
}

function draftOf(blocks: SessionEditorBlock[]) {
  return createEmptySessionEditorDraft({ title: 'Test', sport: 'BIKING', blocks });
}

function shape(blocks: SessionEditorBlock[]) {
  return blocks.map((block) => `${block.kind[0]}${block.zone}:${block.durationSec}${block.reps ? `x${block.reps}` : ''}`);
}

function intervalDraft() {
  const effort = step('work', 5, 180);
  const recovery = step('recovery', 1, 120);
  const pairs = Array.from({ length: 5 }, () => [step('work', 5, 180), step('recovery', 1, 120)]).flat();
  pairs.splice(0, 2, effort, recovery);
  return draftOf([step('warmup', 2, 600), ...pairs, step('cooldown', 1, 600)]);
}

test('rows fold a repeated two-step pattern into one set and keep other steps as rows', () => {
  const draft = intervalDraft();
  const rows = buildBuilderRows(draft.blocks);
  assert.deepEqual(rows.map((row) => row.type), ['step', 'set', 'step']);
  const set = rows[1] as BuilderSetRow;
  assert.deepEqual({ start: set.start, end: set.end, width: set.width, repeats: set.repeats, dropsLastStep: set.dropsLastStep }, { start: 1, end: 11, width: 2, repeats: 5, dropsLastStep: false });
  assert.equal(set.id, draft.blocks[1].clientId);
});

test('identical single steps stay separate rows so a duplicate stays visible', () => {
  const block = step('work', 2, 600);
  const { draft } = duplicateRow(draftOf([block]), { type: 'step', id: block.clientId, index: 0 });
  assert.deepEqual(buildBuilderRows(draft.blocks).map((row) => row.type), ['step', 'step']);
});

test('a set stored without its final recovery is recognised and keeps that shape', () => {
  const blocks = [step('work', 4, 60), step('recovery', 1, 30), step('work', 4, 60), step('recovery', 1, 30), step('work', 4, 60)];
  const draft = draftOf(blocks);
  const set = buildBuilderRows(blocks)[0] as BuilderSetRow;
  assert.equal(set.repeats, 3);
  assert.equal(set.dropsLastStep, true);
  const more = setRepeatCount(draft, set, 4);
  assert.deepEqual(shape(more.blocks), ['w4:60', 'r1:30', 'w4:60', 'r1:30', 'w4:60', 'r1:30', 'w4:60']);
  assert.deepEqual(shape(setRepeatCount(draft, set, 2).blocks), ['w4:60', 'r1:30', 'w4:60']);
});

test('changing the repeat count adds copies with new client ids and removes trailing repetitions', () => {
  const draft = intervalDraft();
  const set = buildBuilderRows(draft.blocks)[1] as BuilderSetRow;
  const more = setRepeatCount(draft, set, 7);
  assert.equal(more.blocks.length, draft.blocks.length + 4);
  assert.equal(new Set(more.blocks.map((block) => block.clientId)).size, more.blocks.length);
  assert.equal(more.blocks.at(-1)?.kind, 'cooldown');
  assert.equal((buildBuilderRows(more.blocks)[1] as BuilderSetRow).repeats, 7);
  const fewer = setRepeatCount(draft, set, 2);
  assert.deepEqual(shape(fewer.blocks), ['w2:600', 'w5:180', 'r1:120', 'w5:180', 'r1:120', 'c1:600']);
  assert.equal(setRepeatCount(draft, set, 5), draft);
  assert.equal(deriveSessionEditorMetrics(more).durationSec, 600 + 7 * 300 + 600);
});

test('editing a set step changes it in every repetition and keeps the set together', () => {
  const draft = intervalDraft();
  const set = buildBuilderRows(draft.blocks)[1] as BuilderSetRow;
  const next = patchSetStep(draft, set, 0, { durationSec: 240 });
  assert.equal(next.blocks.filter((block) => block.durationSec === 240).length, 5);
  const rows = buildBuilderRows(next.blocks);
  assert.equal((rows[1] as BuilderSetRow).repeats, 5);
});

test('removing a step from a two-step set leaves one repeated step', () => {
  const draft = intervalDraft();
  const set = buildBuilderRows(draft.blocks)[1] as BuilderSetRow;
  const next = removeSetStep(draft, set, 1);
  assert.deepEqual(shape(next.blocks), ['w2:600', 'w5:180x5', 'c1:600']);
  assert.equal(deriveSessionEditorMetrics(next).durationSec, 600 + 5 * 180 + 600);
});

test('steps inside a set can be reordered and extended', () => {
  const draft = intervalDraft();
  const set = buildBuilderRows(draft.blocks)[1] as BuilderSetRow;
  const swapped = moveSetStep(draft, set, 0, 1);
  assert.deepEqual(shape(swapped.blocks).slice(1, 5), ['r1:120', 'w5:180', 'r1:120', 'w5:180']);
  assert.equal(moveSetStep(draft, set, 0, -1), draft);
  const extended = addStepToSet(draft, set, step('pause', 1, 30));
  assert.equal(extended.blocks.length, draft.blocks.length + 5);
  assert.equal((buildBuilderRows(extended.blocks)[1] as BuilderSetRow).width, 3);
});

test('a step and the next step become a set of two', () => {
  const draft = draftOf([step('work', 4, 300), step('recovery', 1, 120)]);
  const next = repeatWithNext(draft, 0);
  const rows = buildBuilderRows(next.blocks);
  assert.equal(rows.length, 1);
  assert.equal((rows[0] as BuilderSetRow).repeats, 2);
  assert.equal(repeatWithNext(draft, 1), draft);
});

test('whole rows move, duplicate and delete as one unit', () => {
  const draft = intervalDraft();
  const rows = buildBuilderRows(draft.blocks);
  assert.deepEqual(shape(moveRow(draft, rows, 1, 0).blocks).slice(0, 3), ['w5:180', 'r1:120', 'w5:180']);
  assert.equal(moveRow(draft, rows, 1, 0).blocks[10].kind, 'warmup');
  assert.deepEqual(shape(moveRow(draft, rows, 1, 2).blocks).slice(0, 3), ['w2:600', 'c1:600', 'w5:180']);
  assert.deepEqual(shape(moveRow(draft, rows, 0, 2).blocks).at(-1), 'w2:600');
  const duplicated = duplicateRow(draft, rows[1]);
  assert.equal(duplicated.draft.blocks.length, draft.blocks.length + 10);
  assert.equal(duplicated.draft.blocks[11].clientId, duplicated.firstId);
  assert.deepEqual(shape(removeRow(draft, rows[1]).blocks), ['w2:600', 'c1:600']);
});

test('a profile step maps to the first repetition of its set step', () => {
  const draft = intervalDraft();
  const rows = buildBuilderRows(draft.blocks);
  assert.equal(representativeIndex(rows, 8), 2);
  assert.equal(representativeIndex(rows, 7), 1);
  assert.equal(representativeIndex(rows, 11), 11);
  assert.equal(locateBlock(rows, 8)?.offset, 1);
  assert.equal(locateBlock(rows, 99), null);
});

test('durations parse minutes, seconds and clock times, and nudge by sensible steps', () => {
  assert.equal(parseDuration('10'), 600);
  assert.equal(parseDuration('1.5'), 90);
  assert.equal(parseDuration('90s'), 90);
  assert.equal(parseDuration('3m'), 180);
  assert.equal(parseDuration('2m 30s'), 150);
  assert.equal(parseDuration('1:30'), 90);
  assert.equal(parseDuration('1:05:00'), 3900);
  assert.equal(parseDuration('1h 5m'), 3900);
  assert.equal(parseDuration(''), null);
  assert.equal(parseDuration('0'), null);
  assert.equal(parseDuration('abc'), null);
  assert.equal(parseDuration('1:75'), null);
  assert.equal(nudgeDuration(600, 1), 660);
  assert.equal(nudgeDuration(600, -1), 540);
  assert.equal(nudgeDuration(90, 1), 105);
  assert.equal(nudgeDuration(120, -1), 105);
  assert.equal(nudgeDuration(15, -1), 15);
  assert.equal(nudgeDuration(600, 1, true), 900);
});

test('add options create valid steps; cycling steps get a %FTP target and ramps', () => {
  const warmup = createStepBlocks('warmup', 'BIKING', null);
  assert.equal(warmup.length, 1);
  assert.deepEqual(warmup[0].target, { metric: 'power', mode: 'relative', reference: 'ftp', low: 50, high: 70 });
  assert.equal(createStepBlocks('steady', 'RUNNING', null)[0].target, null);
  const intervals = createStepBlocks('intervals', 'BIKING', null);
  assert.equal(intervals.length, 10);
  assert.equal(new Set(intervals.map((block) => block.clientId)).size, 10);
  const rows = buildBuilderRows(intervals);
  assert.equal((rows[0] as BuilderSetRow).repeats, 5);
  assert.equal(validateSessionEditorDraft(draftOf(intervals)), null);
  assert.deepEqual(createStepBlocks('unknown', 'BIKING', null), []);
});

test('changing zone moves an existing target to that zone and leaves untargeted steps alone', () => {
  const [steady] = createStepBlocks('steady', 'BIKING', null);
  assert.deepEqual(zonePatch(steady, 4, 'BIKING', null), { zone: 4, target: { metric: 'power', mode: 'relative', reference: 'ftp', low: 97.5, high: 97.5 } });
  assert.deepEqual(zonePatch(step('work', 2, 60), 3, 'RUNNING', null), { zone: 3 });
});

test('step names and zone totals read the stored blocks', () => {
  assert.equal(stepName({ kind: 'work', zone: 4 }), 'Threshold');
  assert.equal(stepName({ kind: 'cooldown', zone: 1 }), 'Cool-down');
  const totals = zoneTotals([step('work', 4, 300, { reps: 3 }), step('pause', 1, 60), step('work', 2, 60, { skipped: true }), step('recovery', 1, 120)]);
  assert.deepEqual(totals.map((item) => item.durationSec), [120, 0, 0, 900, 0]);
});
