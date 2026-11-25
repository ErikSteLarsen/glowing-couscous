import assert from 'node:assert/strict';
import test from 'node:test';
import { blockLabelLines, shortDuration } from '../lib/ride/ride-chart.ts';

const steady = { kind: 'work' as const, zone: 4, durationSec: 300, startWatts: 300, endWatts: 300 };
const room = (widthPx: number, heightPx = 80) => ({ widthPx, heightPx, fontPx: 11 });

test('writes the most of a block that fits', () => {
  assert.deepEqual(blockLabelLines(steady, room(120)), ['5m – 300 W']);
  assert.deepEqual(blockLabelLines(steady, room(50)), ['5m', '300 W']);
  assert.deepEqual(blockLabelLines(steady, room(50, 25)), ['300 W']);
  assert.deepEqual(blockLabelLines(steady, room(30)), ['5m', '300']);
  assert.deepEqual(blockLabelLines(steady, room(30, 25)), ['300']);
  assert.deepEqual(blockLabelLines(steady, room(20)), []);
  assert.deepEqual(blockLabelLines(steady, room(120, 15)), []);
  const ramp = { ...steady, startWatts: 150, endWatts: 250 };
  assert.deepEqual(blockLabelLines(ramp, room(120)), ['5m – 150–250 W']);
  assert.deepEqual(blockLabelLines(ramp, room(80)), ['5m', '150–250 W']);
});

test('follows the intensity change and falls back to the zone', () => {
  assert.deepEqual(blockLabelLines(steady, room(120), 5), ['5m – 315 W']);
  const free = { ...steady, startWatts: null, endWatts: null };
  assert.deepEqual(blockLabelLines(free, room(120)), ['5m – Z4']);
  assert.deepEqual(blockLabelLines({ ...free, kind: 'pause' }, room(120)), ['5m']);
});

test('keeps block lengths short', () => {
  assert.deepEqual([45, 60, 150, 300, 4500].map(shortDuration), ['45s', '1m', '2:30', '5m', '75m']);
});
