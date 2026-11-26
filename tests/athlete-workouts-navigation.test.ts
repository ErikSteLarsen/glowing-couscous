import test from 'node:test';
import assert from 'node:assert/strict';
import { backToLibrarySport, customizeWorkoutHref, editWorkoutHref, legacyLibraryRedirectHref, myWorkoutHref, myWorkoutsHref, resolveWorkoutTab } from '../lib/athlete-workouts-navigation.ts';
import { resolveBackTarget } from '../lib/app-navigation.ts';
import { ownedWorkoutDetailItems, splitWorkoutNotes, summarizeOwnedWorkout } from '../lib/owned-workout-summary.ts';

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
  assert.equal(customizeWorkoutHref('gentle-spin-30', 'BIKING'), '/athlete/workouts?customize=gentle-spin-30');
  assert.equal(customizeWorkoutHref('easy-run', 'RUNNING'), '/athlete/workouts?customize=easy-run&sport=run');
});

test('library back targets open the workout’s own sport and other origins stay as they are', () => {
  const library = resolveBackTarget({ route: 'library-workout', from: 'library' });
  assert.deepEqual(backToLibrarySport(library, 'BIKING'), library);
  assert.equal(backToLibrarySport(library, 'SWIMMING').href, '/athlete/workouts?tab=library&sport=swim');
  assert.deepEqual(backToLibrarySport(library, 'STRENGTH'), library);
  const ride = resolveBackTarget({ route: 'library-workout', from: 'ride' });
  assert.deepEqual(backToLibrarySport(ride, 'RUNNING'), ride);
});

test('saved workouts have a detail page, and Edit from it returns there', () => {
  assert.equal(myWorkoutHref(7), '/athlete/workouts/7');
  assert.equal(myWorkoutsHref(), '/athlete/workouts?tab=mine');
  assert.equal(myWorkoutsHref('BIKING'), '/athlete/workouts?tab=mine');
  assert.equal(myWorkoutsHref('RUNNING'), '/athlete/workouts?tab=mine&sport=run');
  assert.equal(myWorkoutsHref('STRENGTH'), '/athlete/workouts?tab=mine&sport=other');
  assert.equal(editWorkoutHref(7), '/athlete/workouts?edit=7');
  assert.equal(editWorkoutHref(7, 'detail'), '/athlete/workouts?edit=7&from=detail');
});

const power = (low: number, high = low) => ({ metric: 'power' as const, mode: 'relative' as const, reference: 'ftp' as const, low, high });
const profile = { cycling: { ftpWatts: 250 } } as Parameters<typeof summarizeOwnedWorkout>[1];

test('a saved bike workout summarizes like a public one: %FTP profile, IF and folded repeats', () => {
  const summary = summarizeOwnedWorkout({
    id: 1, sport: 'BIKING', title: 'Threshold 3x8', summary: 'Three threshold efforts.\n\nKeep cadence high.',
    blocks: [
      { kind: 'warmup', zone: 2, durationSec: 600, target: power(55, 75) },
      ...[1, 2, 3].flatMap(() => [
        { kind: 'work', zone: 4, durationSec: 480, target: power(95, 100) },
        { kind: 'recovery', zone: 1, durationSec: 180, target: power(50) },
      ]),
      { kind: 'cooldown', zone: 1, durationSec: 300, target: power(40, 60) },
    ],
  }, profile);

  assert.equal(summary.axis, 'power');
  assert.equal(summary.durationSec, 600 + 3 * 660 + 300);
  assert.equal(summary.peakZone, 4);
  assert.equal(summary.effortCount, 3);
  assert.equal(summary.workSec, 3 * 480);
  assert.ok(summary.intensityFactor !== null && summary.intensityFactor > 0.7 && summary.intensityFactor < 0.95);
  assert.deepEqual(splitWorkoutNotes('Three threshold efforts.\n\nKeep cadence high.'), { lead: 'Three threshold efforts.', details: ['Keep cadence high.'] });
  assert.equal(summary.lead, 'Three threshold efforts.');

  const items = ownedWorkoutDetailItems(summary.profile);
  assert.deepEqual(items.map((item) => [item.repeat, item.blocks.map((block) => block.label)]), [
    [null, ['Warm-up']],
    [3, ['Effort', 'Recovery']],
    [null, ['Cool-down']],
  ]);
});

test('a repeat without its last recovery keeps the list honest', () => {
  const summary = summarizeOwnedWorkout({
    id: 2, sport: 'BIKING', title: 'Short', summary: null,
    blocks: [
      { kind: 'work', zone: 5, durationSec: 120, target: power(115) },
      { kind: 'recovery', zone: 1, durationSec: 120, target: power(50) },
      { kind: 'work', zone: 5, durationSec: 120, target: power(115) },
      { kind: 'recovery', zone: 1, durationSec: 120, target: power(50) },
      { kind: 'work', zone: 5, durationSec: 120, target: power(115) },
    ],
  }, profile);
  const items = ownedWorkoutDetailItems(summary.profile);
  const listed = items.reduce((sum, item) => sum + (item.repeat ?? 1) * item.blocks.reduce((total, block) => total + block.durationSec, 0), 0);
  assert.equal(listed, summary.durationSec);
});

test('a run without power targets falls back to the zone scale and has no IF', () => {
  const summary = summarizeOwnedWorkout({
    id: 3, sport: 'RUNNING', title: 'Easy run', summary: null,
    blocks: [{ kind: 'work', zone: 2, durationSec: 2400, target: null }],
  }, profile);
  assert.equal(summary.axis, 'zone');
  assert.equal(summary.intensityFactor, null);
  assert.equal(summary.peakZone, 2);
  assert.equal(summary.profile.steps.length, 1);
});

test('saved power blocks list watts like public ones, ramps as start → end', () => {
  const summary = summarizeOwnedWorkout({
    id: 4, sport: 'BIKING', title: 'Ramp', summary: null,
    blocks: [
      { kind: 'warmup', zone: 2, durationSec: 600, target: power(50, 70) },
      { kind: 'work', zone: 4, durationSec: 600, target: power(95, 100) },
    ],
  }, profile);
  const [warmup, work] = ownedWorkoutDetailItems(summary.profile, 250).flatMap((item) => item.blocks);
  assert.deepEqual([warmup.target, warmup.unit], ['125 → 175', 'W']);
  assert.deepEqual([work.target, work.unit], ['238–250', 'W']);
});
