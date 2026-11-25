import assert from 'node:assert/strict';
import test from 'node:test';
import { blockEffortLabel } from '../lib/ride/ride-chart.ts';

const steady = { kind: 'work' as const, zone: 4, startWatts: 300, endWatts: 300 };
const room = (widthPx: number, heightPx = 80) => ({ widthPx, heightPx, fontPx: 11 });

test('writes the longest effort that fits a block', () => {
  assert.equal(blockEffortLabel(steady, room(120)), '300 W');
  assert.equal(blockEffortLabel(steady, room(35)), '300');
  assert.equal(blockEffortLabel(steady, room(20)), null);
  assert.equal(blockEffortLabel(steady, room(120, 15)), null);
  const ramp = { ...steady, startWatts: 150, endWatts: 250 };
  assert.equal(blockEffortLabel(ramp, room(120)), '150–250 W');
  assert.equal(blockEffortLabel(ramp, room(60)), '150–250');
  assert.equal(blockEffortLabel(ramp, room(45)), null);
});

test('follows the intensity change and falls back to the zone', () => {
  assert.equal(blockEffortLabel(steady, room(120), 5), '315 W');
  const free = { ...steady, startWatts: null, endWatts: null };
  assert.equal(blockEffortLabel(free, room(120)), 'Z4');
  assert.equal(blockEffortLabel({ ...free, kind: 'pause' }, room(120)), null);
});
