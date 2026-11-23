import test from 'node:test';
import assert from 'node:assert/strict';
import { homeActivityLoadAvailable, homeActivityReadout, homeLoadBarPercent, homeLoadLabel, summarizeHomeActivities, type HomeActivity } from '../lib/home-summary.ts';
import { createAthleteService } from '../lib/athlete-service.ts';

function outcome(overrides: Partial<HomeActivity> = {}): HomeActivity {
  return { id: 1, sessionId: 11, completedAt: new Date('2026-09-30T12:00:00Z'), durationSec: 2700, tss: 35, metricsSource: 'manual-actual', session: { title: 'Run' }, ...overrides };
}

test('completed totals use saved durations, count a matched outcome once and include standalone imports', () => {
  const matched = outcome();
  const standalone = outcome({ id: 2, sessionId: 12, durationSec: 1800, tss: 0, metricsSource: 'strava-import' });
  assert.deepEqual(summarizeHomeActivities([matched, matched, standalone]), { count: 2, durationSec: 4500, tss: 35, loadUnavailableCount: 1 });
  assert.equal(homeLoadLabel(summarizeHomeActivities([matched, standalone])), '35 estimated TSS · some TSS missing');
});

test('unknown import load is not a measured zero; rounded calibrated and manual zero remain valid', () => {
  for (const metricsSource of ['file-import', 'strava-import']) {
    assert.equal(homeActivityLoadAvailable(outcome({ tss: 0, metricsSource })), false);
    assert.equal(homeActivityLoadAvailable(outcome({ tss: 0, metricsSource, zoneDistributionJson: '[1,0,0,0,0]' })), true);
    for (const zoneDistributionJson of ['[]', '[0,0,0,0,0]', 'bad JSON', '["1",0,0,0,0]', '[-1,0,0,0,0]']) {
      assert.equal(homeActivityLoadAvailable(outcome({ tss: 0, metricsSource, zoneDistributionJson })), false);
    }
  }
  assert.equal(homeActivityLoadAvailable(outcome({ tss: 0 })), true);
  assert.equal(summarizeHomeActivities([outcome({ tss: 0 })]).tss, 0);
  const missing = summarizeHomeActivities([outcome({ tss: 0, metricsSource: 'file-import' })]);
  assert.equal(missing.tss, null);
  assert.equal(homeLoadLabel(missing), 'No TSS');
  assert.deepEqual(summarizeHomeActivities([]), { count: 0, durationSec: 0, tss: 0, loadUnavailableCount: 0 });
});

test('recent loads scale proportionally without clipping and preserve activity identity on the same date', () => {
  const points = [homeActivityReadout(outcome({ tss: 100 })), homeActivityReadout(outcome({ id: 2, tss: 200 })), homeActivityReadout(outcome({ id: 3, tss: 0, metricsSource: 'strava-import' }))];
  assert.deepEqual(points.map((point) => homeLoadBarPercent(point, points)), [50, 100, 0]);
  assert.equal(homeLoadBarPercent(homeActivityReadout(outcome({ tss: 0 })), []), 0);
  const imported = homeActivityReadout(outcome({ importTitle: 'Recorded morning run', metricsSource: 'strava-import' }));
  assert.equal(imported.title, 'Recorded morning run');
  assert.equal(imported.sourceLabel, 'Strava');
  assert.equal(imported.sessionId, 11);
});

test('Home independently queries week outcomes and keeps scheduled structure separate from corrected and cross-week outcomes', async () => {
  const clock = new Date('2026-09-30T12:00:00Z');
  const block = { id: 100, kind: 'work', zone: 2, durationSec: 3600, reps: null, targetType: null, targetLow: null, targetHigh: null, note: null, sortOrder: 0 };
  const matched = outcome();
  const standalone = outcome({ id: 2, sessionId: 12, metricsSource: 'strava-import', durationSec: 1800, tss: 0 });
  // Activity 3 belongs to a session scheduled in an earlier week.
  const crossWeek = outcome({ id: 3, sessionId: 13, durationSec: 1200, tss: 20 });
  const sessions = [
    { id: 11, title: 'Planned run', summary: null, sport: 'RUNNING', date: clock, timeLabel: null, status: 'completed', source: 'athlete-planner', adjusted: false, blocks: [block], activity: matched },
    { id: 12, title: 'Imported run', summary: null, sport: 'RUNNING', date: clock, timeLabel: null, status: 'completed', source: 'activity-import', adjusted: false, blocks: [], activity: standalone },
    { id: 14, title: 'Missed run', summary: null, sport: 'RUNNING', date: clock, timeLabel: null, status: 'missed', source: 'athlete-planner', adjusted: false, blocks: [block], activity: null },
  ];
  let weekQueries = 0;
  const service = createAthleteService({ now: () => clock, db: {
    session: { async findMany() { return []; } },
    user: { async findUnique(args: { where: { id: number }; include: { sessions: { where: { date: { gte: Date; lte: Date } } }; activities: { take: number } } }) {
      assert.equal(args.where.id, 7);
      assert.equal(args.include.activities.take, 4);
      return { id: 7, name: 'Runner', coach: null, prefsJson: null, sessions, activities: [crossWeek, standalone, matched] };
    } },
    activity: { async findMany(args: { where: { athleteId: number; completedAt: { gte: Date; lte: Date } } }) {
      weekQueries += 1;
      assert.equal(args.where.athleteId, 7);
      assert.ok(args.where.completedAt.gte <= clock && args.where.completedAt.lte >= clock);
      return [matched, standalone, crossWeek];
    } },
  } as never });
  const home = await service.loadHomeDashboard(7);
  assert.ok(home);
  assert.equal(weekQueries, 1);
  assert.equal(home.scheduledTotals.count, 2);
  assert.equal(home.scheduledTotals.durationSec, 7200);
  assert.deepEqual(home.completedTotals, { count: 3, durationSec: 5700, tss: 55, loadUnavailableCount: 1 });
  assert.equal(home.todaySessions.find((session) => session.id === 11)?.durationSec, 2700);
  assert.equal(home.todaySessions.find((session) => session.id === 12)?.loadAvailable, false);
  assert.equal(home.lastActivity?.sessionId, 13);
  assert.deepEqual(home.trend.map((point) => point.id), [1, 2, 3]);
  assert.equal(home.dateLabels.shortToday, '30\u00A0Sep');
});

test('Home does not query outcomes for an absent account', async () => {
  const service = createAthleteService({ db: { user: { async findUnique() { return null; } }, activity: { async findMany() { assert.fail('unexpected outcome read'); } } } as never });
  assert.equal(await service.loadHomeDashboard(123), null);
});
