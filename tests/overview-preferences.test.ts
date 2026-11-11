import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeOverviewCards, parsePrefsJson, readOverviewCardsFromPrefsJson } from '../lib/overview-preferences.ts';

test('normalizeOverviewCards keeps valid cards in order and drops unknown entries', () => {
  assert.deepEqual(
    normalizeOverviewCards(['coachNote', 'noise', 'weekLoad', 'trend']),
    ['coachNote', 'weekLoad', 'trend'],
  );
});

test('parsePrefsJson falls back to an empty object for malformed persisted data', () => {
  assert.deepEqual(parsePrefsJson('{invalid json'), {});
});

test('readOverviewCardsFromPrefsJson normalizes persisted overview cards', () => {
  assert.deepEqual(
    readOverviewCardsFromPrefsJson('{"overviewCards":["coachNote","noise","trend"]}'),
    ['coachNote', 'trend'],
  );
});

test('a fresh account shows every overview card until it chooses otherwise', () => {
  assert.deepEqual(readOverviewCardsFromPrefsJson(null), ['coachNote', 'lastActivity', 'weekLoad', 'trend']);
  assert.deepEqual(readOverviewCardsFromPrefsJson('{"theme":"dark"}'), ['coachNote', 'lastActivity', 'weekLoad', 'trend']);
  assert.deepEqual(readOverviewCardsFromPrefsJson('{"overviewCards":[]}'), []);
});
