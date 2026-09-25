import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySessionEditorDraft, createSessionEditorBlock, normalizeSessionEditorDraft, serializeSessionEditorDraft, validateSessionEditorDraft } from '../lib/session-editor.ts';
import { deriveSessionMetrics } from '../lib/session-math.ts';
import { formatDurationExact } from '../lib/format-duration.ts';
import { insertPauseAfterSelection, insertPauseBeforeSelection, repeatPatternWithPauses } from '../lib/workout-pattern.ts';

test('a seconds-based pause is inserted only between existing blocks', () => {
  const first = createSessionEditorBlock({ kind: 'work', zone: 4, durationSec: 60 });
  const second = createSessionEditorBlock({ kind: 'work', zone: 4, durationSec: 60 });
  const blocks = [first, second];
  const withPause = insertPauseAfterSelection(blocks, [first.clientId], 25);
  assert.deepEqual(withPause.map((block) => [block.kind, block.durationSec]), [['work', 60], ['pause', 25], ['work', 60]]);
  assert.equal(insertPauseAfterSelection(blocks, [second.clientId], 25), blocks);
  const beforeSecond = insertPauseBeforeSelection(blocks, [second.clientId], 25);
  assert.deepEqual(beforeSecond.map((block) => [block.kind, block.durationSec]), [['work', 60], ['pause', 25], ['work', 60]]);
  assert.equal(insertPauseBeforeSelection(blocks, [first.clientId], 25), blocks);
  assert.equal(insertPauseBeforeSelection(withPause, [second.clientId], 25), withPause);
  assert.equal(validateSessionEditorDraft(createEmptySessionEditorDraft({ title: 'Pause only', blocks: [withPause[1]] })), 'Add an active workout block before saving.');
});

test('repeating a set adds a pause between sets without a trailing pause', () => {
  const work = createSessionEditorBlock({ kind: 'work', zone: 4, durationSec: 60 });
  const blocks = repeatPatternWithPauses([work], [work.clientId], 3, 30);
  assert.deepEqual(blocks.map((block) => block.kind), ['work', 'pause', 'work', 'pause', 'work']);
  assert.deepEqual(blocks.map((block) => block.durationSec), [60, 30, 60, 30, 60]);
  assert.equal(new Set(blocks.map((block) => block.clientId)).size, blocks.length);
  const metrics = deriveSessionMetrics(blocks);
  assert.equal(metrics.durationSec, 240);
  assert.equal(metrics.zoneDistributionSec[0], 0);
  assert.equal(metrics.zoneDistributionSec[3], 180);
  assert.equal(metrics.segments[1].label, 'Pause');
  assert.equal(formatDurationExact(1230), '20m 30s');
  const draft = createEmptySessionEditorDraft({ title: 'Intervals', blocks });
  assert.equal(validateSessionEditorDraft(draft), null);
  const serialized = serializeSessionEditorDraft(draft);
  assert.equal(serialized.blocks[1].kind, 'pause');
  assert.equal(normalizeSessionEditorDraft(serialized).blocks[1].durationSec, 30);
});
