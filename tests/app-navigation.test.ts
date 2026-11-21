import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPrimaryNavigation,
  parseBackOrigin,
  resolveBackTarget,
  withBackOrigin,
} from '../lib/app-navigation.ts';

test('desktop activity navigation uses the same label as the mobile destination', () => {
  const history = getPrimaryNavigation().find((item) => item.href === '/athlete/activity');
  assert.deepEqual(history, {
    label: 'Activity',
    description: 'Review completed work',
    href: '/athlete/activity',
    matchPrefix: '/athlete/activity',
  });
});

const back = (href: string, destination: string) => ({ href, destination, label: `Back to ${destination}` });

test('session detail returns to every allowed origin', () => {
  const expected = {
    home: back('/athlete', 'Home'),
    calendar: back('/athlete/calendar', 'Calendar'),
    planner: back('/athlete/calendar', 'Calendar'),
    activity: back('/athlete/activity', 'Activity'),
    imports: back('/athlete/import', 'Import'),
    library: back('/athlete/library', 'Library'),
    ride: back('/athlete/ride', 'Ride'),
  };
  for (const [from, target] of Object.entries(expected)) {
    assert.deepEqual(resolveBackTarget({ route: 'session', from }), target, from);
  }
});

test('session detail falls back to Calendar without a valid origin', () => {
  assert.deepEqual(resolveBackTarget({ route: 'session' }), back('/athlete/calendar', 'Calendar'));
  for (const from of ['unknown', 'profile', 'roster', '__proto__', 'constructor', 'https://evil.example', '//evil.example', '']) {
    assert.deepEqual(resolveBackTarget({ route: 'session', from }), back('/athlete/calendar', 'Calendar'), from);
  }
});

test('live and ride pages return to their session and keep only a valid origin', () => {
  assert.deepEqual(resolveBackTarget({ route: 'session-live', sessionId: 7, from: 'home' }), back('/athlete/session/7?from=home', 'Session'));
  assert.deepEqual(resolveBackTarget({ route: 'session-ride', sessionId: 7, from: 'ride' }), back('/athlete/session/7?from=ride', 'Session'));
  assert.deepEqual(resolveBackTarget({ route: 'session-ride', sessionId: 7 }), back('/athlete/session/7', 'Session'));
  assert.deepEqual(resolveBackTarget({ route: 'session-live', sessionId: 7, from: '//evil.example' }), back('/athlete/session/7', 'Session'));
});

test('library workout returns to Ride from Tempo Ride, otherwise to Library', () => {
  assert.deepEqual(resolveBackTarget({ route: 'library-workout', from: 'ride' }), back('/athlete/ride', 'Ride'));
  assert.deepEqual(resolveBackTarget({ route: 'library-workout', from: 'library' }), back('/athlete/library', 'Library'));
  assert.deepEqual(resolveBackTarget({ route: 'library-workout' }), back('/athlete/library', 'Library'));
  assert.deepEqual(resolveBackTarget({ route: 'library-workout', from: 'calendar' }), back('/athlete/library', 'Library'));
});

test('import returns to Settings, Profile or Activity', () => {
  assert.deepEqual(resolveBackTarget({ route: 'import', from: 'profile' }), back('/profile', 'Profile'));
  assert.deepEqual(resolveBackTarget({ route: 'import', from: 'settings' }), back('/settings#connections', 'Settings'));
  assert.deepEqual(resolveBackTarget({ route: 'import', from: 'activity' }), back('/athlete/activity', 'Activity'));
  assert.deepEqual(resolveBackTarget({ route: 'import' }), back('/athlete/activity', 'Activity'));
  assert.deepEqual(resolveBackTarget({ route: 'import', from: 'ride' }), back('/athlete/activity', 'Activity'));
});

test('coach athlete detail restores the planner selection and falls back to the roster', () => {
  assert.deepEqual(resolveBackTarget({ route: 'coach-athlete', athleteId: 23, from: 'planner', date: '2026-09-26' }), back('/coach/planner?athleteId=23&date=2026-09-26', 'Planner'));
  assert.deepEqual(resolveBackTarget({ route: 'coach-athlete', athleteId: 23, from: 'planner', date: '2026-02-30' }), back('/coach/planner?athleteId=23', 'Planner'));
  assert.deepEqual(resolveBackTarget({ route: 'coach-athlete', athleteId: 23, from: 'roster' }), back('/coach', 'Athletes'));
  assert.deepEqual(resolveBackTarget({ route: 'coach-athlete', athleteId: 23 }), back('/coach', 'Athletes'));
  assert.deepEqual(resolveBackTarget({ route: 'coach-athlete', athleteId: 23, from: 'home' }), back('/coach', 'Athletes'));
});

test('origins are parsed against the route allowlist only', () => {
  assert.equal(parseBackOrigin('session', 'planner'), 'planner');
  assert.equal(parseBackOrigin('session', 'profile'), null);
  assert.equal(parseBackOrigin('session', 'toString'), null);
  assert.equal(parseBackOrigin('session', undefined), null);
  assert.equal(parseBackOrigin('import', 'profile'), 'profile');
  assert.equal(parseBackOrigin('library-workout', 'ride'), 'ride');
});

test('withBackOrigin appends from only when an origin is present', () => {
  assert.equal(withBackOrigin('/athlete/session/4', 'home'), '/athlete/session/4?from=home');
  assert.equal(withBackOrigin('/athlete/session/4', null), '/athlete/session/4');
  assert.equal(withBackOrigin('/athlete/import#strava', 'profile'), '/athlete/import?from=profile#strava');
});
