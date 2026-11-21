import test from 'node:test';
import assert from 'node:assert/strict';
import { customizeWorkoutHref, legacyLibraryRedirectHref, resolveWorkoutTab } from '../lib/athlete-workouts-navigation.ts';

test('explicit workout tabs override the default based on the saved workout count', () => {
  assert.equal(resolveWorkoutTab(null, 0), 'library');
  assert.equal(resolveWorkoutTab(null, 1), 'mine');
  assert.equal(resolveWorkoutTab('bogus', 2), 'mine');
  assert.equal(resolveWorkoutTab('library', 2), 'library');
  assert.equal(resolveWorkoutTab('mine', 0), 'mine');
});

test('legacy library redirects preserve catalog filters without entering the editor', () => {
  assert.equal(legacyLibraryRedirectHref({}), '/athlete/workouts?tab=library');
  assert.equal(
    legacyLibraryRedirectHref({ tab: 'mine', customize: 'gentle-spin-30', edit: '7', q: 'easy ride', category: ['recovery', 'endurance'], tag: ['indoor', 'easy'], sort: 'tss-desc', ifMax: '0.7' }),
    '/athlete/workouts?tab=library&q=easy+ride&category=recovery%2Cendurance&tag=indoor%2Ceasy&ifMax=0.7&sort=tss-desc',
  );
});

test('Customize links open a catalog draft by slug', () => {
  assert.equal(customizeWorkoutHref('gentle-spin-30'), '/athlete/workouts?customize=gentle-spin-30');
});
