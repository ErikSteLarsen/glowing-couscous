import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySessionEditorDraft, createSessionEditorBlock, normalizeSessionEditorDraft, serializeSessionEditorDraft, validateSessionEditorDraft } from '../lib/session-editor.ts';
import { deriveSessionMetrics } from '../lib/session-math.ts';

const pause = () => createSessionEditorBlock({ kind: 'pause', zone: 1, durationSec: 30, reps: null, target: null, note: '' });
const work = () => createSessionEditorBlock({ kind: 'work', zone: 4, durationSec: 60 });

test('a pause-only workout cannot be saved', () => {
  assert.equal(validateSessionEditorDraft(createEmptySessionEditorDraft({ title: 'Pause only', blocks: [pause()] })), 'Add an active workout block before saving.');
});

test('pauses between sets count toward time, not zone load, and survive serialization', () => {
  const blocks = [work(), pause(), work(), pause(), work()];
  const metrics = deriveSessionMetrics(blocks);
  assert.equal(metrics.durationSec, 240);
  assert.equal(metrics.zoneDistributionSec[0], 0);
  assert.equal(metrics.zoneDistributionSec[3], 180);
  assert.equal(metrics.segments[1].label, 'Pause');
  const draft = createEmptySessionEditorDraft({ title: 'Intervals', blocks });
  assert.equal(validateSessionEditorDraft(draft), null);
  const serialized = serializeSessionEditorDraft(draft);
  assert.equal(serialized.blocks[1].kind, 'pause');
  assert.equal(normalizeSessionEditorDraft(serialized).blocks[1].durationSec, 30);
});
