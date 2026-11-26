import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addPlacementDate,
  getDateRangeLabel,
  getDefaultPlanStart,
  getPlacementReturnHref,
  getPlanButtonLabel,
  getPlanDates,
  getWorkoutButtonLabel,
  parsePlacedCount,
  removePlacementDate,
  splitSourceKey,
} from '../lib/calendar-placement.ts';
import { validateWeekRange } from '../lib/template-period.ts';
import { validateRoutineDates } from '../lib/template-routine.ts';

test('workout button names the single date, or counts several', () => {
  assert.equal(getWorkoutButtonLabel(['2026-11-24']), 'Add to Tue\u00A024\u00A0Nov');
  assert.equal(getWorkoutButtonLabel(['2026-11-24', '2026-11-26', '2026-11-28']), 'Add to 3 days');
  assert.equal(getWorkoutButtonLabel([]), 'Choose a date');
});

test('plan button counts the workouts it adds', () => {
  assert.equal(getPlanButtonLabel(1), 'Add 1 workout to Calendar');
  assert.equal(getPlanButtonLabel(20), 'Add 20 workouts to Calendar');
});

test('plan dates are whole Monday-first weeks from the week of the start day', () => {
  const one = getPlanDates('2026-11-25', 1);
  assert.equal(one.length, 7);
  assert.equal(one[0], '2026-11-23');
  assert.equal(one.at(-1), '2026-11-29');
  const four = getPlanDates('2026-11-30', 4);
  assert.equal(four.length, 28);
  assert.equal(four.at(-1), '2026-12-27');
  assert.deepEqual(getPlanDates('nope', 1), []);
  assert.deepEqual(getPlanDates('2026-11-30', 0), []);
  assert.deepEqual(getPlanDates('2026-11-30', 13), []);
});

test('the server accepts the same whole-week ranges, and older one-month ranges for own plans', () => {
  assert.equal(validateWeekRange(getPlanDates('2026-11-30', 1)), null);
  assert.equal(validateWeekRange(getPlanDates('2026-11-30', 12)), null);
  assert.match(validateWeekRange(getPlanDates('2026-11-30', 1).slice(1)) ?? '', /whole weeks/);
  const fromTuesday = Array.from({ length: 7 }, (_, index) => `2026-12-0${index + 1}`);
  assert.match(validateWeekRange(fromTuesday) ?? '', /Monday/);
  const gap = [...getPlanDates('2026-11-30', 1), ...getPlanDates('2026-12-14', 1)];
  assert.match(validateWeekRange(gap) ?? '', /in a row/);
  assert.equal(validateRoutineDates(getPlanDates('2026-11-30', 4)), null);
  const december = Array.from({ length: 31 }, (_, index) => `2026-12-${String(index + 1).padStart(2, '0')}`);
  assert.equal(validateRoutineDates(december), null);
});

test('a plan starts on the week being viewed, or next week once this week has begun', () => {
  assert.equal(getDefaultPlanStart('2026-11-26', null), '2026-11-30');
  assert.equal(getDefaultPlanStart('2026-11-26', '2026-11-24'), '2026-11-30');
  assert.equal(getDefaultPlanStart('2026-11-26', '2026-12-10'), '2026-12-07');
  assert.equal(getDefaultPlanStart('2026-11-23', null), '2026-11-23');
  assert.equal(getDefaultPlanStart('2026-11-26', '2026-10-01'), '2026-11-30');
});

test('range labels read as plain dates and source keys split once', () => {
  assert.equal(getDateRangeLabel(getPlanDates('2026-11-25', 1)), 'Mon\u00A023\u00A0Nov–Sun\u00A029\u00A0Nov');
  assert.equal(getDateRangeLabel([]), '');
  assert.deepEqual(splitSourceKey('catalog:long-ride'), ['catalog', 'long-ride']);
  assert.deepEqual(splitSourceKey('built-in-plan:triathlon-build'), ['built-in-plan', 'triathlon-build']);
});

test('adding and removing dates keeps a sorted unique list', () => {
  assert.deepEqual(addPlacementDate(['2026-11-26'], '2026-11-24'), ['2026-11-24', '2026-11-26']);
  assert.deepEqual(addPlacementDate(['2026-11-24'], '2026-11-24'), ['2026-11-24']);
  assert.deepEqual(addPlacementDate(['2026-11-24'], 'bad'), ['2026-11-24']);
  assert.deepEqual(removePlacementDate(['2026-11-24', '2026-11-26'], '2026-11-24'), ['2026-11-26']);
});

test('success returns to Calendar on the first placed date with a count', () => {
  assert.equal(getPlacementReturnHref('week', ['2026-11-26', '2026-11-24'], 2), '/athlete/calendar?view=week&date=2026-11-24&placed=2');
  assert.equal(getPlacementReturnHref('week', getPlanDates('2026-11-30', 4), 12), '/athlete/calendar?view=month&date=2026-12-06&placed=12');
  assert.equal(getPlacementReturnHref('week', getPlanDates('2026-11-30', 1), 5), '/athlete/calendar?view=week&date=2026-11-30&placed=5');
  assert.equal(parsePlacedCount('3'), 3);
  assert.equal(parsePlacedCount('0'), null);
  assert.equal(parsePlacedCount('x'), null);
  assert.equal(parsePlacedCount(undefined), null);
});
