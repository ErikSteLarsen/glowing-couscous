import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addPlacementDate,
  findRepeatedPlacementDates,
  getPlacementButtonLabel,
  getPlacementReturnHref,
  getRoutineDates,
  getRoutineRangeLabel,
  parsePlacedCount,
  removePlacementDate,
} from '../lib/calendar-placement.ts';

test('workout button names the single date, or counts several', () => {
  assert.equal(getPlacementButtonLabel('workout', ['2026-11-24']), 'Add to Tue\u00A024\u00A0Nov');
  assert.equal(getPlacementButtonLabel('workout', ['2026-11-24', '2026-11-26', '2026-11-28']), 'Add to 3 days');
  assert.equal(getPlacementButtonLabel('workout', []), 'Choose a date');
});

test('routine button names the week or month it applies to', () => {
  assert.equal(getPlacementButtonLabel('template', getRoutineDates('week', '2026-11-25'), 'week'), 'Apply to week of 23\u00A0Nov');
  assert.equal(getPlacementButtonLabel('template', getRoutineDates('month', '2026-11-25'), 'month'), 'Apply to November');
});

test('routine dates match the server contract: a Monday week or the whole calendar month', () => {
  const week = getRoutineDates('week', '2026-11-25');
  assert.equal(week.length, 7);
  assert.equal(week[0], '2026-11-23');
  assert.equal(week.at(-1), '2026-11-29');
  const month = getRoutineDates('month', '2026-02-10');
  assert.equal(month.length, 28);
  assert.equal(month[0], '2026-02-01');
  assert.equal(getRoutineDates('month', '2026-12-31').length, 31);
  assert.deepEqual(getRoutineDates('week', 'nope'), []);
});

test('routine range labels read as plain dates', () => {
  assert.equal(getRoutineRangeLabel(getRoutineDates('week', '2026-11-25')), 'Mon\u00A023\u00A0Nov–Sun\u00A029\u00A0Nov');
  assert.equal(getRoutineRangeLabel(getRoutineDates('month', '2026-11-25')), 'Sun\u00A01\u00A0Nov–Mon\u00A030\u00A0Nov');
  assert.equal(getRoutineRangeLabel([]), '');
});

test('adding and removing dates keeps a sorted unique list', () => {
  assert.deepEqual(addPlacementDate(['2026-11-26'], '2026-11-24'), ['2026-11-24', '2026-11-26']);
  assert.deepEqual(addPlacementDate(['2026-11-24'], '2026-11-24'), ['2026-11-24']);
  assert.deepEqual(addPlacementDate(['2026-11-24'], 'bad'), ['2026-11-24']);
  assert.deepEqual(removePlacementDate(['2026-11-24', '2026-11-26'], '2026-11-24'), ['2026-11-26']);
});

test('repeated placements are found by title and sport on the same date', () => {
  const existing = { '2026-11-24': [{ title: 'Tempo run', sport: 'RUNNING' }], '2026-11-25': [{ title: 'Tempo run', sport: 'CYCLING' }] };
  assert.deepEqual(findRepeatedPlacementDates([
    { date: '2026-11-24', title: 'Tempo run', sport: 'RUNNING' },
    { date: '2026-11-25', title: 'Tempo run', sport: 'RUNNING' },
    { date: '2026-11-26', title: 'Tempo run', sport: 'RUNNING' },
  ], existing), ['2026-11-24']);
});

test('success returns to Calendar on the first placed date with a count', () => {
  assert.equal(getPlacementReturnHref('week', ['2026-11-26', '2026-11-24'], 2), '/athlete/calendar?view=week&date=2026-11-24&placed=2');
  assert.equal(getPlacementReturnHref('week', getRoutineDates('month', '2026-11-25'), 12, 'month'), '/athlete/calendar?view=month&date=2026-11-01&placed=12');
  assert.equal(parsePlacedCount('3'), 3);
  assert.equal(parsePlacedCount('0'), null);
  assert.equal(parsePlacedCount('x'), null);
  assert.equal(parsePlacedCount(undefined), null);
});
