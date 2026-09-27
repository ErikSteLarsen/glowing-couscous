import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCoachAthleteReturnTarget,
  getPrimaryNavigation,
  getSessionOrigin,
  getSessionReturnTarget,
} from '../lib/app-navigation.ts';

test('desktop history navigation uses the same label as the mobile destination', () => {
  const history = getPrimaryNavigation().find((item) => item.href === '/athlete/activity');
  assert.deepEqual(history, {
    label: 'History',
    description: 'Review completed work',
    href: '/athlete/activity',
    matchPrefix: '/athlete/activity',
  });
});

test('athlete session return targets preserve supported origins including Planner', () => {
  assert.equal(getSessionOrigin('planner'), 'planner');
  assert.deepEqual(getSessionReturnTarget('home'), { href: '/athlete', label: 'Back to Home' });
  assert.deepEqual(getSessionReturnTarget('calendar'), { href: '/athlete/calendar', label: 'Back to Calendar' });
  assert.deepEqual(getSessionReturnTarget('activity'), { href: '/athlete/activity', label: 'Back to History' });
  assert.deepEqual(getSessionReturnTarget('planner'), { href: '/athlete/planner', label: 'Back to Planner' });
  assert.equal(getSessionOrigin('unknown'), 'calendar');
});

test('coach athlete return target restores the planner selection and falls back safely', () => {
  assert.deepEqual(getCoachAthleteReturnTarget('planner', 23, '2026-09-26'), {
    href: '/coach/planner?athleteId=23&date=2026-09-26',
    label: 'Back to Planner',
  });
  assert.deepEqual(getCoachAthleteReturnTarget('planner', 23, '2026-02-30'), {
    href: '/coach/planner?athleteId=23',
    label: 'Back to Planner',
  });
  assert.deepEqual(getCoachAthleteReturnTarget('roster', 23), {
    href: '/coach',
    label: 'Back to your athletes',
  });
});
