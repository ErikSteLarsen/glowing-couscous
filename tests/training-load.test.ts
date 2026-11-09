import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDayKeys,
  buildLoadSeries,
  classifyCompliance,
  classifyForm,
  daysBetween,
  rampRate,
  summarizeWeeks,
  toDayKey,
  weekStartOf,
  type WeekSession,
} from '../lib/training-load.ts';

test('day keys step across month and DST boundaries without drifting', () => {
  assert.equal(addDayKeys('2026-10-24', 7), '2026-10-31');
  assert.equal(addDayKeys('2026-03-28', 2), '2026-03-30');
  assert.equal(addDayKeys('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2026-03-01', '2026-04-01'), 31);
  assert.equal(toDayKey(new Date(2026, 10, 9, 23, 59)), '2026-11-09');
});

test('weeks start on Monday', () => {
  assert.equal(weekStartOf('2026-11-09'), '2026-11-09');
  assert.equal(weekStartOf('2026-11-15'), '2026-11-09');
  assert.equal(weekStartOf('2026-11-16'), '2026-11-16');
});

test('steady daily stress converges fitness and fatigue to that stress and form to zero', () => {
  const from = '2026-01-01';
  const to = addDayKeys(from, 299);
  const actual = Array.from({ length: 300 }, (_, index) => ({ day: addDayKeys(from, index), tss: 60 }));
  const series = buildLoadSeries({ actual, planned: [], from, to, today: to });
  const last = series[series.length - 1];

  assert.equal(series.length, 300);
  assert.ok(Math.abs(last.fitness - 60) < 0.5, `fitness ${last.fitness}`);
  assert.ok(Math.abs(last.fatigue - 60) < 0.1, `fatigue ${last.fatigue}`);
  assert.ok(Math.abs(last.form) < 0.5, `form ${last.form}`);
});

test('a hard day raises fatigue faster than fitness and lowers form the next day', () => {
  const series = buildLoadSeries({
    actual: [{ day: '2026-11-02', tss: 140 }],
    planned: [],
    from: '2026-11-01',
    to: '2026-11-04',
    today: '2026-11-04',
  });
  const hardDay = series.find((point) => point.day === '2026-11-02')!;
  const nextDay = series.find((point) => point.day === '2026-11-03')!;

  assert.equal(hardDay.actualTss, 140);
  assert.equal(hardDay.fatigue, 20);
  assert.equal(hardDay.fitness, 3.3);
  assert.equal(hardDay.form, 0, 'form reflects yesterday, so today is unchanged');
  assert.ok(nextDay.form < -15);
});

test('warmup history settles averages before the visible range', () => {
  const actual = Array.from({ length: 60 }, (_, index) => ({ day: addDayKeys('2026-09-01', index), tss: 50 }));
  const withWarmup = buildLoadSeries({ actual, planned: [], from: '2026-10-25', to: '2026-10-30', today: '2026-10-30', warmupStart: '2026-09-01' });
  const withoutWarmup = buildLoadSeries({ actual, planned: [], from: '2026-10-25', to: '2026-10-30', today: '2026-10-30' });

  assert.equal(withWarmup[0].day, '2026-10-25');
  assert.ok(withWarmup[0].fitness > 30);
  assert.ok(withoutWarmup[0].fitness < 2);
});

test('future days project from planned stress and are flagged', () => {
  const series = buildLoadSeries({
    actual: [{ day: '2026-11-08', tss: 80 }, { day: '2026-11-10', tss: 999 }],
    planned: [{ day: '2026-11-09', tss: 50 }, { day: '2026-11-10', tss: 70 }, { day: '2026-11-07', tss: 40 }],
    from: '2026-11-07',
    to: '2026-11-10',
    today: '2026-11-09',
  });

  assert.deepEqual(
    series.map((point) => [point.day, point.actualTss, point.plannedTss, point.projected]),
    [
      ['2026-11-07', 0, 0, false],
      ['2026-11-08', 80, 0, false],
      ['2026-11-09', 0, 50, false],
      ['2026-11-10', 0, 70, true],
    ],
  );
  assert.ok(series[3].fatigue > series[2].fatigue, 'projection applies planned stress');
});

test('ignores non-positive and non-finite stress', () => {
  const series = buildLoadSeries({
    actual: [{ day: '2026-11-01', tss: -20 }, { day: '2026-11-01', tss: Number.NaN }],
    planned: [],
    from: '2026-11-01',
    to: '2026-11-01',
    today: '2026-11-01',
  });
  assert.equal(series[0].actualTss, 0);
  assert.equal(series[0].fatigue, 0);
});

test('form zones and ramp rate', () => {
  assert.equal(classifyForm(12), 'fresh');
  assert.equal(classifyForm(0), 'neutral');
  assert.equal(classifyForm(-20), 'productive');
  assert.equal(classifyForm(-35), 'overreaching');

  const from = '2026-11-01';
  const actual = Array.from({ length: 10 }, (_, index) => ({ day: addDayKeys(from, index), tss: 100 }));
  const series = buildLoadSeries({ actual, planned: [], from, to: '2026-11-10', today: '2026-11-10' });
  assert.ok((rampRate(series, '2026-11-10') ?? 0) > 0);
  assert.equal(rampRate(series, '2026-11-03'), null);
});

test('compliance compares done with planned inside the 80-120% band', () => {
  const base = { day: '2026-11-05', today: '2026-11-09', plannedDurationSec: 3600, plannedTss: 60 } as const;

  assert.equal(classifyCompliance({ ...base, status: 'completed', actualDurationSec: 3500 }), 'complete');
  assert.equal(classifyCompliance({ ...base, status: 'completed', actualDurationSec: 2400 }), 'partial');
  assert.equal(classifyCompliance({ ...base, status: 'completed', actualDurationSec: 1200 }), 'off');
  assert.equal(classifyCompliance({ ...base, status: 'completed', compliancePct: 96, actualDurationSec: 100 }), 'complete');
  assert.equal(classifyCompliance({ ...base, status: 'completed', plannedDurationSec: 0, actualTss: 90 }), 'partial');
  assert.equal(classifyCompliance({ ...base, status: 'completed', plannedDurationSec: 0, plannedTss: 0 }), 'unplanned');
  assert.equal(classifyCompliance({ ...base, status: 'planned' }), 'missed');
  assert.equal(classifyCompliance({ ...base, status: 'adjusted', day: '2026-11-09' }), 'planned');
  assert.equal(classifyCompliance({ ...base, status: 'missed', day: '2026-11-12' }), 'missed');
});

test('weekly summaries total planned and completed work by sport', () => {
  const sessions: WeekSession[] = [
    { day: '2026-11-02', sport: 'Running', plannedDurationSec: 3600, plannedTss: 60, actualDurationSec: 3300, actualTss: 55, compliance: 'complete' },
    { day: '2026-11-04', sport: 'Biking', plannedDurationSec: 5400, plannedTss: 80, actualDurationSec: 6000, actualTss: 90, compliance: 'complete' },
    { day: '2026-11-06', sport: 'Running', plannedDurationSec: 1800, plannedTss: 30, actualDurationSec: null, actualTss: null, compliance: 'missed' },
    { day: '2026-11-10', sport: 'Running', plannedDurationSec: 1800, plannedTss: 30, actualDurationSec: null, actualTss: null, compliance: 'planned' },
  ];
  const [week, nextWeek, emptyWeek] = summarizeWeeks(sessions, ['2026-11-02', '2026-11-09', '2026-11-16']);

  assert.deepEqual(week.planned, { durationSec: 10800, tss: 170, sessions: 3 });
  assert.deepEqual(week.completed, { durationSec: 9300, tss: 145, sessions: 2 });
  assert.equal(week.missed, 1);
  assert.equal(week.completionPct, 86);
  assert.deepEqual(week.bySport.map((sport) => sport.sport), ['Biking', 'Running']);
  assert.equal(nextWeek.planned.sessions, 1);
  assert.equal(nextWeek.completed.sessions, 0);
  assert.equal(emptyWeek.completionPct, null);
});
