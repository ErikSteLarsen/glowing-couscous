import test from 'node:test';
import assert from 'node:assert/strict';

import { workoutCatalog } from '../lib/workout-catalog/index.ts';
import type { CatalogWorkout } from '../lib/workout-catalog/types.ts';
import { computeCatalogMetrics, expandCatalogItems, zoneForPct } from '../lib/workout-catalog/metrics.ts';
import {
  createCatalogEntries, durationBucketFor, EMPTY_CATALOG_QUERY, filterCatalog, isCatalogQueryFiltered, matchesCatalogSearch, parseCatalogQuery, serializeCatalogQuery,
} from '../lib/workout-catalog/query.ts';
import { catalogStepNote, catalogWorkoutToEditorBlocks, catalogWorkoutToSessionInput } from '../lib/workout-catalog/session.ts';
import { validateCatalog, validateCatalogWorkout } from '../lib/workout-catalog/validate.ts';
import { createEmptySessionEditorDraft, validateSessionEditorDraft } from '../lib/session-editor.ts';
import { createRidePlan } from '../lib/ride/ride-plan.ts';
import { createEmptyPerformanceProfile } from '../lib/performance-profile.ts';

function workout(overrides: Partial<CatalogWorkout> = {}): CatalogWorkout {
  return {
    slug: 'fixture-threshold',
    name: 'Fixture threshold',
    sport: 'BIKING',
    category: 'threshold',
    level: 'intermediate',
    summary: 'Two long threshold efforts.',
    description: 'Ride steady.\n\nStay seated.',
    tags: ['indoor', 'race-prep'],
    items: [
      { kind: 'warmup', durationSec: 600, lowPct: 50, highPct: 75, cue: 'Build gradually', cadence: [85, 95] },
      { repeat: 2, steps: [{ kind: 'work', durationSec: 1200, lowPct: 95, highPct: 100 }, { kind: 'recovery', durationSec: 300, lowPct: 55, highPct: 55 }] },
      { kind: 'cooldown', durationSec: 600, lowPct: 40, highPct: 65 },
    ],
    ...overrides,
  };
}

test('expanding items unrolls repeated sets in order with ramps by kind', () => {
  const steps = expandCatalogItems(workout().items);
  assert.deepEqual(steps.map((step) => step.kind), ['warmup', 'work', 'recovery', 'work', 'recovery', 'cooldown']);
  assert.deepEqual(steps.map((step) => step.startSec), [0, 600, 1800, 2100, 3300, 3600]);
  assert.deepEqual([steps[0].startPct, steps[0].endPct, steps[0].ramp], [50, 75, true]);
  assert.deepEqual([steps[5].startPct, steps[5].endPct, steps[5].ramp], [65, 40, true]);
  assert.deepEqual([steps[1].startPct, steps[1].endPct, steps[1].ramp], [97.5, 97.5, false]);
  assert.deepEqual(steps[3].set, { repetition: 2, of: 2 });
  assert.deepEqual(steps[0].cadence, [85, 95]);
});

test('metrics derive duration, NP, IF, TSS, zones and peak from %FTP', () => {
  const steady = computeCatalogMetrics([{ kind: 'work', durationSec: 3600, lowPct: 100, highPct: 100 }]);
  assert.equal(steady.durationSec, 3600);
  assert.equal(steady.intensityFactor, 1);
  assert.equal(steady.tss, 100);
  assert.deepEqual(steady.zoneSec, [0, 0, 0, 3600, 0]);

  const metrics = computeCatalogMetrics(workout().items);
  assert.equal(metrics.durationSec, 4200);
  assert.equal(metrics.maxPct, 97.5);
  assert.equal(metrics.intervalCount, 2);
  assert.equal(metrics.workSec, 2400);
  assert.equal(metrics.zoneSec.reduce((sum, seconds) => sum + seconds, 0), 4200);
  assert.ok(metrics.npPct > metrics.averagePct, 'NP weights hard efforts above the mean');
  assert.ok(metrics.intensityFactor > 0.8 && metrics.intensityFactor < 0.95);
  assert.equal(metrics.tss, Math.round((4200 / 3600) * metrics.npPct / 100 * metrics.npPct / 100 * 100));

  // A 50→75% ramp spends 15/25 of its time below 65% and the rest in Z2.
  const ramp = computeCatalogMetrics([{ kind: 'warmup', durationSec: 1000, lowPct: 50, highPct: 75 }]);
  assert.deepEqual(ramp.zoneSec, [600, 400, 0, 0, 0]);
  assert.equal(zoneForPct(64), 1);
  assert.equal(zoneForPct(105), 5);
});

test('duration buckets split at 45, 75 and 120 minutes', () => {
  assert.equal(durationBucketFor(44 * 60), 'under-45');
  assert.equal(durationBucketFor(45 * 60), '45-75');
  assert.equal(durationBucketFor(75 * 60), '75-120');
  assert.equal(durationBucketFor(120 * 60), '75-120');
  assert.equal(durationBucketFor(121 * 60), 'over-120');
});

test('filter, search and sort combine', () => {
  const entries = createCatalogEntries([
    workout(),
    workout({ slug: 'easy-spin', name: 'Easy spin', category: 'recovery', level: 'beginner', tags: ['short'], summary: 'Legs only.', items: [{ kind: 'work', durationSec: 1800, lowPct: 50, highPct: 50 }] }),
    workout({ slug: 'big-day', name: 'Big day', category: 'endurance', level: 'advanced', tags: ['long'], summary: 'Zone two for hours.', items: [{ kind: 'work', durationSec: 3 * 3600, lowPct: 68, highPct: 72 }] }),
  ]);
  const slugs = (query: Partial<typeof EMPTY_CATALOG_QUERY>) => filterCatalog(entries, { ...EMPTY_CATALOG_QUERY, ...query }).map((entry) => entry.workout.slug);
  assert.deepEqual(slugs({}), ['big-day', 'easy-spin', 'fixture-threshold']);
  assert.deepEqual(slugs({ categories: ['recovery', 'endurance'] }), ['big-day', 'easy-spin']);
  assert.deepEqual(slugs({ levels: ['beginner'] }), ['easy-spin']);
  assert.deepEqual(slugs({ durations: ['over-120'] }), ['big-day']);
  assert.deepEqual(slugs({ durations: ['under-45', '45-75'] }), ['easy-spin', 'fixture-threshold']);
  assert.deepEqual(slugs({ tags: ['race-prep'] }), ['fixture-threshold']);
  assert.deepEqual(slugs({ tssMin: 60 }), ['big-day', 'fixture-threshold']);
  assert.deepEqual(slugs({ ifMax: 0.6 }), ['easy-spin']);
  assert.deepEqual(slugs({ q: 'zone hours' }), ['big-day']);
  assert.deepEqual(slugs({ q: 'THRESHOLD race' }), ['fixture-threshold']);
  assert.deepEqual(slugs({ sort: 'duration-desc' }), ['big-day', 'fixture-threshold', 'easy-spin']);
  assert.deepEqual(slugs({ sort: 'tss-asc' }), ['easy-spin', 'fixture-threshold', 'big-day']);
  assert.equal(matchesCatalogSearch(workout(), 'sweet'), false);
});

test('query state round-trips through URL params and drops unknown values', () => {
  const query = parseCatalogQuery(new URLSearchParams('q=over&category=threshold,nope,vo2max&level=advanced&duration=45-75&sort=tss-desc&tssMin=40&ifMax=abc'));
  assert.deepEqual(query.categories, ['threshold', 'vo2max']);
  assert.deepEqual(query.levels, ['advanced']);
  assert.deepEqual(query.durations, ['45-75']);
  assert.equal(query.sort, 'tss-desc');
  assert.equal(query.tssMin, 40);
  assert.equal(query.ifMax, null);
  assert.deepEqual(parseCatalogQuery(new URLSearchParams(serializeCatalogQuery(query))), query);
  assert.equal(serializeCatalogQuery(EMPTY_CATALOG_QUERY), '');
  assert.equal(isCatalogQueryFiltered({ ...EMPTY_CATALOG_QUERY, sort: 'tss-asc' }), false);
  assert.deepEqual(parseCatalogQuery({ category: ['sprint'], sort: 'bogus' }).categories, ['sprint']);
});

test('conversion produces valid canonical relative-FTP blocks with notes', () => {
  const blocks = catalogWorkoutToEditorBlocks(workout());
  assert.equal(blocks.length, 6);
  assert.deepEqual(blocks[0].target, { metric: 'power', mode: 'relative', reference: 'ftp', low: 50, high: 75 });
  assert.equal(blocks[0].kind, 'warmup');
  assert.equal(blocks[0].zone, 1);
  assert.equal(blocks[1].zone, 4);
  assert.equal(blocks[0].note, 'Build gradually · Cadence 85–95 rpm');
  assert.equal(catalogStepNote({ cue: null, cadence: [100, 100] }), 'Cadence 100 rpm');
  assert.equal(blocks[2].note, '');

  const input = catalogWorkoutToSessionInput(workout());
  assert.equal(input.summary, 'Two long threshold efforts.\n\nRide steady.\n\nStay seated.');
  assert.equal(validateSessionEditorDraft(createEmptySessionEditorDraft({ ...input, sport: 'BIKING' })), null);
});

test('ridden catalog workouts ramp warm-ups up and cool-downs down', () => {
  const profile = createEmptyPerformanceProfile();
  profile.cycling.ftpWatts = 200;
  const plan = createRidePlan(catalogWorkoutToEditorBlocks(workout()), profile);
  assert.deepEqual([plan.steps[0].startWatts, plan.steps[0].endWatts], [100, 150]);
  assert.deepEqual([plan.steps[5].startWatts, plan.steps[5].endWatts], [130, 80]);
  assert.deepEqual([plan.steps[1].startWatts, plan.steps[1].endWatts], [195, 195]);
  assert.equal(plan.totalSec, 4200);
});

test('validation reports schema contract violations', () => {
  assert.deepEqual(validateCatalogWorkout(workout()), []);
  const broken = workout({ slug: 'Bad Slug', description: ' ', category: 'nope' as CatalogWorkout['category'], items: [{ kind: 'work', durationSec: 0, lowPct: 20, highPct: 10 }, { repeat: 0, steps: [] }] });
  const errors = validateCatalogWorkout(broken);
  for (const fragment of ['kebab-case', 'description', 'unknown category', 'positive whole number of seconds', 'lowPct must be', 'must not exceed', 'repeat must be', 'needs steps']) {
    assert.ok(errors.some((error) => error.includes(fragment)), `expected an error about ${fragment}: ${errors.join('\n')}`);
  }
  assert.ok(validateCatalog([workout(), workout()]).some((error) => error.includes('more than once')));
});

test('the shipped catalog satisfies the schema contract', () => {
  assert.deepEqual(validateCatalog(workoutCatalog), []);
  for (const entry of workoutCatalog) {
    const input = catalogWorkoutToSessionInput(entry);
    assert.equal(validateSessionEditorDraft(createEmptySessionEditorDraft({ ...input, sport: 'BIKING' })), null, entry.slug);
    assert.ok(computeCatalogMetrics(entry.items).durationSec > 0, entry.slug);
  }
});
