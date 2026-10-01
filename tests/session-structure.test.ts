import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSessionStructure, describeStructureGroup, type StructureBlock } from '../lib/session-structure.ts';

function block(id: number, kind = 'work', overrides: Partial<StructureBlock> = {}): StructureBlock {
  return { id, kind, zone: kind === 'work' ? 4 : 1, durationSec: kind === 'work' ? 600 : 120, reps: null, targetLabel: null, note: null, skipped: false, ...overrides };
}

test('four efforts with three pauses fold without inventing a final pause or losing block identity', () => {
  const blocks = [block(1, 'warmup'), block(2), block(3, 'pause'), block(4), block(5, 'pause'), block(6), block(7, 'pause'), block(8), block(9, 'cooldown')];
  const groups = groupSessionStructure(blocks);
  assert.equal(groups.length, 3);
  assert.equal(describeStructureGroup(groups[1]), '4 × 10m zone 4, 2m pause between efforts');
  assert.deepEqual(groups.flatMap((group) => group.blocks), blocks);
});

test('recovery after the final effort is described accurately', () => {
  const groups = groupSessionStructure([block(1), block(2, 'recovery'), block(3), block(4, 'recovery')]);
  assert.equal(describeStructureGroup(groups[0]), '2 × 10m zone 4, 2m recovery after each effort');
});

test('different targets, notes, skip state and relative basis do not become identical repetitions', () => {
  for (const change of [{ targetLabel: '4:10 /km' }, { note: 'Faster finish' }, { skipped: true }, { targetBasis: '90% FTP' }, { durationSec: 599 }, { reps: 2 }, { zone: 5 }]) {
    const blocks = [block(1), block(2, 'pause'), block(3, 'work', change)];
    assert.equal(groupSessionStructure(blocks).length, 3);
  }
});

test('multi-step repeats preserve the complete pattern and all originals', () => {
  const blocks = [block(1), block(2, 'work', { zone: 5 }), block(3, 'pause'), block(4), block(5, 'work', { zone: 5 }), block(6, 'pause')];
  const groups = groupSessionStructure(blocks);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].repeats, 2);
  assert.equal(groups[0].pattern.length, 3);
  assert.deepEqual(groups[0].blocks, blocks);
});

test('empty, single, skipped and stored-repetition structures remain truthful', () => {
  assert.deepEqual(groupSessionStructure([]), []);
  assert.equal(describeStructureGroup(groupSessionStructure([block(1, 'work', { reps: 4 })])[0]), '4 × 10m zone 4');
  assert.match(describeStructureGroup(groupSessionStructure([block(1, 'work', { skipped: true })])[0]), /skipped/);
  assert.equal(groupSessionStructure([block(1, 'warmup'), block(2, 'warmup')]).length, 2);
});
