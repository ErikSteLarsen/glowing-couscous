import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrimaryNavigation, isNavigationItemActive } from '../lib/app-navigation.ts';

function activeLabels(pathname: string) {
  const items = getPrimaryNavigation('ATHLETE', { hasActiveCoach: true });
  return items.filter((item) => isNavigationItemActive(pathname, item, items)).map((item) => item.label);
}

test('Home is highlighted only on its own route, not on session detail or Live', () => {
  assert.deepEqual(activeLabels('/athlete'), ['Home']);
  assert.deepEqual(activeLabels('/athlete/session/42'), []);
  assert.deepEqual(activeLabels('/athlete/live/42'), []);
});

test('section pages keep their own highlight', () => {
  assert.deepEqual(activeLabels('/athlete/calendar'), ['Calendar']);
  assert.deepEqual(activeLabels('/athlete/activity'), ['Activity']);
});
