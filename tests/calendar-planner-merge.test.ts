import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCalendarHref,
  getCalendarPlacementHref,
  getPlannerRedirectHref,
  parseCalendarPlacement,
  parseCalendarReturn,
  parseCalendarTotals,
  withCalendarReturn,
} from '../lib/calendar-navigation.ts';
import {
  getPrimaryNavigation,
  isNavigationItemActive,
  resolveBackTarget,
} from '../lib/app-navigation.ts';

test('the old Planner URL opens placement on the merged Calendar with the same date and source', () => {
  assert.equal(getPlannerRedirectHref({}), '/athlete/calendar?view=month&place=workout');
  assert.equal(getPlannerRedirectHref({ date: '2026-12-03' }), '/athlete/calendar?view=month&date=2026-12-03&place=workout');
  assert.equal(
    getPlannerRedirectHref({ date: '2026-12-03', source: 'template:9' }),
    '/athlete/calendar?view=month&date=2026-12-03&place=template&source=template%3A9',
  );
  assert.equal(getPlannerRedirectHref({ source: 'workout:12' }), '/athlete/calendar?view=month&place=workout&source=workout%3A12');
});

test('the Planner redirect drops invalid or repeated values instead of forwarding them', () => {
  assert.equal(getPlannerRedirectHref({ date: '2026-02-30', source: 'plan:1' }), '/athlete/calendar?view=month&place=workout');
  assert.equal(getPlannerRedirectHref({ date: ['2026-12-03', '2026-12-04'] }), '/athlete/calendar?view=month&place=workout');
  assert.equal(getPlannerRedirectHref({ source: 'workout:abc' }), '/athlete/calendar?view=month&place=workout');
});

test('calendar hrefs carry placement state and placement params parse strictly', () => {
  assert.equal(getCalendarHref('week', '2026-11-09'), '/athlete/calendar?view=week&date=2026-11-09');
  assert.equal(
    getCalendarHref('week', '2026-11-09', { place: 'template' }),
    '/athlete/calendar?view=week&date=2026-11-09&place=template',
  );
  assert.equal(getCalendarPlacementHref('workout:4'), '/athlete/calendar?place=workout&source=workout%3A4');
  assert.equal(getCalendarPlacementHref('template:2'), '/athlete/calendar?place=template&source=template%3A2');
  assert.equal(
    getCalendarPlacementHref('catalog:long-ride', { date: '2026-11-27', back: '/athlete/library/long-ride' }),
    '/athlete/calendar?place=workout&source=catalog%3Along-ride&date=2026-11-27&back=%2Fathlete%2Flibrary%2Flong-ride',
  );
  assert.equal(getCalendarHref('week', '2026-11-27', { place: 'workout', back: '/athlete' }), '/athlete/calendar?view=week&date=2026-11-27&place=workout&back=%2Fathlete');
  assert.equal(parseCalendarPlacement('workout'), 'workout');
  assert.equal(parseCalendarPlacement('template'), 'template');
  assert.equal(parseCalendarPlacement('training-plan'), null);
  assert.equal(parseCalendarPlacement(undefined), null);
  assert.equal(parseCalendarTotals('show'), true);
  assert.equal(parseCalendarTotals(undefined), false);
});

test('Planner is no longer a separate destination and old planner links resolve to Calendar', () => {
  const items = getPrimaryNavigation();
  assert.equal(items.some((item) => item.label === 'Planner' || item.href.startsWith('/athlete/planner')), false);
  const calendar = items.find((item) => item.label === 'Calendar');
  assert.ok(calendar);
  assert.equal(isNavigationItemActive('/athlete/calendar', calendar, items), true);
  assert.deepEqual(resolveBackTarget({ route: 'session', from: 'planner' }), {
    href: '/athlete/calendar',
    destination: 'Calendar',
    label: 'Back to Calendar',
  });
});

test('add dialogs return only to app pages outside Calendar on Cancel', () => {
  assert.equal(parseCalendarReturn('/athlete'), '/athlete');
  assert.equal(parseCalendarReturn('/athlete/workouts?tab=library&sport=RUNNING'), '/athlete/workouts?tab=library&sport=RUNNING');
  for (const value of ['/athlete/calendar?view=week', '//evil.example', 'https://evil.example', '/athletes', '/athlete//x', '/coach', undefined, 3]) {
    assert.equal(parseCalendarReturn(value), null, String(value));
  }
  assert.equal(withCalendarReturn('/athlete/library/a/schedule?from=library', '/athlete/workouts?tab=library'), '/athlete/library/a/schedule?from=library&back=%2Fathlete%2Fworkouts%3Ftab%3Dlibrary');
  assert.equal(withCalendarReturn('/athlete/library/a/schedule', 'https://evil.example'), '/athlete/library/a/schedule');
});
