import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { buildActivityTcx } from '../lib/tcx-writer.ts';
import { parseTcxActivity } from '../lib/tcx-activity.ts';
import { parseActivityFile } from '../lib/activity-file-parser.ts';
import { buildPostChartSvg } from '../lib/strava-post-chart.ts';
import {
  buildStravaPostDraft,
  effortsFromRide,
  formatEffortLine,
  powerShape,
  createStravaUploadClient,
  duplicateActivityId,
  hasStravaWriteScope,
  safeStravaReturnPath,
  statsFromPoints,
  STRAVA_REQUESTED_SCOPES,
  summarizeBlocksForPost,
  validateStravaPostText,
} from '../lib/strava-post.ts';
import type { ActivitySeriesPoint } from '../lib/activity-series.ts';

const startedAt = new Date('2026-11-20T17:30:00.000Z');

function ridePoints(durationSec: number): ActivitySeriesPoint[] {
  return Array.from({ length: durationSec + 1 }, (_, second) => ({
    elapsedSec: second,
    powerWatts: second < 600 ? 160 : 260,
    heartRateBpm: 120 + Math.round(second / 30),
    cadenceRpm: 90,
    speedMetersPerSecond: 9.5,
    distanceMeters: second * 9.5,
  }));
}

test('TCX writer round-trips through both TCX parsers', () => {
  const points = ridePoints(1200);
  const xml = buildActivityTcx({
    sport: 'BIKING',
    title: 'VO2 max <4 × 4>',
    startedAt,
    durationSec: 1200,
    distanceMeters: 11400,
    points,
    laps: [
      { startSec: 0, endSec: 600, timerSec: 600, origin: 'device' },
      { startSec: 600, endSec: 1200, timerSec: 600, origin: 'device' },
    ],
  });
  assert.match(xml, /VO2 max &lt;4 × 4&gt;/);

  const summary = parseTcxActivity(xml);
  assert.equal(summary.ok, true);
  if (!summary.ok) return;
  assert.equal(summary.activity.sport, 'BIKING');
  assert.equal(summary.activity.durationSec, 1200);
  assert.equal(summary.activity.startedAt.toISOString(), startedAt.toISOString());
  assert.equal(summary.activity.distanceMeters, 11400);

  const samples = parseActivityFile('ride.tcx', xml);
  assert.equal(samples.sport, 'BIKING');
  assert.equal(samples.durationSec, 1200);
  assert.equal(samples.points.length, 1201);
  assert.deepEqual(
    { power: samples.points[700].powerWatts, hr: samples.points[700].heartRateBpm, cadence: samples.points[700].cadenceRpm },
    { power: 260, hr: 143, cadence: 90 },
  );
  assert.equal(samples.laps?.length, 2);
  assert.deepEqual(samples.laps?.map((lap) => [lap.startSec, lap.endSec]), [[0, 600], [600, 1200]]);
});

test('TCX writer keeps activities without power or distance readable', () => {
  const xml = buildActivityTcx({
    sport: 'BIKING', title: 'Recovery spin', startedAt, durationSec: 60, distanceMeters: null,
    points: [{ elapsedSec: 0, heartRateBpm: 110 }, { elapsedSec: 60, heartRateBpm: 115 }],
  });
  const summary = parseTcxActivity(xml);
  assert.equal(summary.ok, true);
  assert.equal(parseActivityFile('spin.tcx', xml).points[1].heartRateBpm, 115);
});

test('block line names the main repeat and leaves out warm-up and cool-down', () => {
  const blocks = [
    { kind: 'warmup', zone: 2, durationSec: 600, reps: null },
    ...Array.from({ length: 4 }, () => [
      { kind: 'work', zone: 5, durationSec: 240, reps: null },
      { kind: 'recovery', zone: 1, durationSec: 210, reps: null },
    ]).flat(),
    { kind: 'cooldown', zone: 1, durationSec: 480, reps: null },
  ];
  assert.equal(summarizeBlocksForPost(blocks), '4 × 4 min Z5 – 3:30 easy');
});

test('block line folds repeats whatever kind the blocks were stored as', () => {
  const blocks = [
    { kind: 'steady', zone: 2, durationSec: 300, reps: null },
    { kind: 'steady', zone: 4, durationSec: 240, reps: null },
    { kind: 'steady', zone: 1, durationSec: 120, reps: null },
    { kind: 'steady', zone: 4, durationSec: 240, reps: null },
    { kind: 'steady', zone: 1, durationSec: 120, reps: null },
    { kind: 'steady', zone: 4, durationSec: 240, reps: null },
    { kind: 'steady', zone: 1, durationSec: 300, reps: null },
  ];
  assert.equal(summarizeBlocksForPost(blocks), '3 × 4 min Z4 – 2 min easy');
  assert.equal(summarizeBlocksForPost([{ kind: 'work', zone: 2, durationSec: 3600, reps: null }]), '60 min Z2');
  assert.equal(summarizeBlocksForPost([]), null);
});

test('post draft is a clean card: grouped numbers, then the work, with no app footer', () => {
  const stats = statsFromPoints(ridePoints(1200), 1200, 41.4);
  assert.equal(stats.averagePowerWatts, 210);
  assert.ok(stats.normalizedPowerWatts !== null && stats.normalizedPowerWatts > 210);
  const draft = buildStravaPostDraft({
    title: '  VO2 max 4 × 4  ',
    stats,
    blocks: [{ kind: 'work', zone: 5, durationSec: 240, reps: 4 }],
  });
  assert.equal(draft.name, 'VO2 max 4 × 4');
  assert.equal(
    draft.description,
    `⚡ 210 W avg – ${stats.normalizedPowerWatts} W NP\n❤️ ${stats.averageHeartRateBpm} bpm avg – ${stats.maxHeartRateBpm} max\n⏱ 20 min – TSS 41\n\n🔥 4 × 4 min Z5`,
  );
  assert.doesNotMatch(draft.description, /TempoBuilder/);
  const bare = buildStravaPostDraft({ title: 'Spin', stats: statsFromPoints([{ elapsedSec: 0 }], 5400, null), blocks: [] });
  assert.equal(bare.description, '⏱ 1h 30m');
});

test('clean card shows the power shape and each hard effort as ridden', () => {
  // 2 min easy, then 2 × (1 min hard + 1 min easy), at 1 Hz.
  const watts = (sec: number) => sec < 120 ? 150 : [300, 150, 310, 150][Math.floor((sec - 120) / 60)];
  const points = Array.from({ length: 360 }, (_, sec) => ({ elapsedSec: sec, powerWatts: watts(sec) }));
  const blocks = [
    { kind: 'warmup', zone: 2, durationSec: 120, reps: null },
    { kind: 'work', zone: 5, durationSec: 60, reps: null },
    { kind: 'recovery', zone: 1, durationSec: 60, reps: null },
    { kind: 'work', zone: 5, durationSec: 60, reps: null },
    { kind: 'recovery', zone: 1, durationSec: 60, reps: null },
  ];
  const efforts = effortsFromRide({ points, durationSec: 360, blocks });
  assert.deepEqual(efforts, [{ durationSec: 60, averagePowerWatts: 300 }, { durationSec: 60, averagePowerWatts: 310 }]);
  assert.equal(formatEffortLine(efforts ?? []), '🔥 2 × 1 min: 300 – 310 W');
  // Laps that don't match the plan (a skipped block) are not trusted.
  assert.equal(effortsFromRide({ points, durationSec: 360, blocks, laps: [{ startSec: 0, endSec: 360 }] }), null);
  // A ride much longer than the plan without laps is not trusted either.
  assert.equal(effortsFromRide({ points, durationSec: 900, blocks }), null);
  const shape = powerShape(points, 360, 12);
  assert.equal(shape?.length, 12);
  assert.match(shape ?? '', /^[▁▂▃▄▅▆▇█]+$/);
  assert.equal(powerShape([{ elapsedSec: 0 }], 360), null);
});

test('post text is validated before upload', () => {
  assert.deepEqual(validateStravaPostText({ name: ' Ride ', description: 'a\r\nb ' }), { ok: true, name: 'Ride', description: 'a\nb' });
  assert.equal(validateStravaPostText({ name: '' }).ok, false);
  assert.equal(validateStravaPostText({ name: 'x'.repeat(121) }).ok, false);
});

test('Strava write scope checks accept space or comma lists', () => {
  assert.equal(hasStravaWriteScope('read,activity:read_all,activity:write'), true);
  assert.equal(hasStravaWriteScope('read activity:write'), true);
  assert.equal(hasStravaWriteScope('activity:read activity:read_all'), false);
  assert.equal(hasStravaWriteScope(null), false);
  assert.ok(STRAVA_REQUESTED_SCOPES.split(',').includes('activity:write'));
  assert.ok(STRAVA_REQUESTED_SCOPES.split(',').includes('activity:read_all'));
});

test('connect return paths stay inside the athlete app', () => {
  assert.equal(safeStravaReturnPath('/athlete/session/3?post=strava'), '/athlete/session/3?post=strava');
  assert.equal(safeStravaReturnPath('https://evil.example/athlete'), null);
  assert.equal(safeStravaReturnPath('//evil.example/athlete'), null);
  assert.equal(safeStravaReturnPath('/athlete/../api/x'), null);
  assert.equal(safeStravaReturnPath('/coach/1'), null);
});

type Call = { url: string; method: string; body: unknown };

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body });
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'content-type': 'application/json' } });
  };
  return { calls, fetch };
}

const uploadInput = { file: '<xml/>', filename: 'ride.tcx', name: 'VO2 max', description: 'line', externalId: 'tempo-activity-7' };

test('upload client posts multipart TCX and polls until Strava returns the activity', async () => {
  const { calls, fetch } = mockFetch([
    { status: 201, body: { id: 16486788, id_str: '16486788', external_id: 'tempo-activity-7', error: null, status: 'Your activity is still being processed.', activity_id: null } },
    { status: 200, body: { id_str: '16486788', error: null, status: 'Your activity is still being processed.', activity_id: null } },
    { status: 200, body: { id_str: '16486788', error: null, status: 'Your activity is ready.', activity_id: 9876543210123 } },
  ]);
  const sleeps: number[] = [];
  const client = createStravaUploadClient({ baseUrl: 'http://127.0.0.1:9/api/v3/', fetch, sleep: async (ms) => { sleeps.push(ms); } });
  const submitted = await client.submit('token', uploadInput);
  assert.deepEqual(submitted, { status: 'processing', uploadId: '16486788' });
  assert.equal(calls[0].url, 'http://127.0.0.1:9/api/v3/uploads');
  assert.equal(calls[0].method, 'POST');
  const form = calls[0].body as FormData;
  assert.equal(form.get('data_type'), 'tcx');
  assert.equal(form.get('name'), 'VO2 max');
  assert.equal(form.get('description'), 'line');
  assert.equal(form.get('external_id'), 'tempo-activity-7');
  assert.equal((form.get('file') as File).name, 'ride.tcx');

  const done = await client.waitForActivity('token', '16486788');
  assert.deepEqual(done, { status: 'posted', activityId: '9876543210123' });
  assert.equal(calls[2].url, 'http://127.0.0.1:9/api/v3/uploads/16486788');
  assert.deepEqual(sleeps, [1500, 1500]);
});

test('upload client links duplicates to the existing Strava activity', async () => {
  assert.equal(duplicateActivityId('ride.tcx duplicate of activity 21234316'), '21234316');
  assert.equal(duplicateActivityId("ride.tcx duplicate of <a href='/activities/555'>Morning Ride</a>"), '555');
  const { fetch } = mockFetch([
    { status: 201, body: { id_str: '1', error: null, status: 'Your activity is still being processed.', activity_id: null } },
    { status: 200, body: { id_str: '1', error: 'ride.tcx duplicate of activity 21234316', status: 'There was an error processing your activity.', activity_id: null } },
  ]);
  const client = createStravaUploadClient({ baseUrl: 'http://127.0.0.1:9', fetch, sleep: async () => {} });
  assert.deepEqual(await client.submit('token', uploadInput), { status: 'processing', uploadId: '1' });
  assert.deepEqual(await client.waitForActivity('token', '1'), { status: 'duplicate', activityId: '21234316' });
});

test('upload client reports processing errors, auth failures and slow uploads', async () => {
  const failing = mockFetch([
    { status: 200, body: { id_str: '2', error: 'Improperly formatted <b>data</b>.', status: 'There was an error processing your activity.', activity_id: null } },
  ]);
  const failed = await createStravaUploadClient({ baseUrl: 'http://127.0.0.1:9', fetch: failing.fetch, sleep: async () => {} }).waitForActivity('t', '2');
  assert.deepEqual(failed, { status: 'failed', error: 'Strava couldn’t use this activity: Improperly formatted data.' });

  const unauthorized = mockFetch([{ status: 401, body: { message: 'Authorization Error', errors: [{ field: 'activity:write_permission', code: 'missing' }] } }]);
  await assert.rejects(
    createStravaUploadClient({ baseUrl: 'http://127.0.0.1:9', fetch: unauthorized.fetch }).submit('t', uploadInput),
    (error: Error & { reconnect?: boolean }) => error.reconnect === true && /Reconnect Strava/.test(error.message),
  );

  const busy = mockFetch([{ status: 500, body: null }]);
  await assert.rejects(createStravaUploadClient({ baseUrl: 'http://127.0.0.1:9', fetch: busy.fetch }).submit('t', uploadInput), /isn’t responding/);

  const slow = mockFetch(Array.from({ length: 3 }, () => ({ status: 200, body: { id_str: '3', error: null, status: 'Your activity is still being processed.', activity_id: null } })));
  const pending = await createStravaUploadClient({ baseUrl: 'http://127.0.0.1:9', fetch: slow.fetch, sleep: async () => {}, maxPolls: 3 }).waitForActivity('t', '3');
  assert.deepEqual(pending, { status: 'processing', uploadId: '3' });
});

test('a stalled Strava poll keeps the upload pending so it can be resumed', async () => {
  const client = createStravaUploadClient({
    baseUrl: 'http://127.0.0.1:9',
    pollIntervalMs: 1000,
    pollBudgetMs: 1100,
    sleep: async () => {},
    fetch: async (_url, init) => {
      await delay(5000, undefined, { signal: init?.signal ?? undefined });
      throw new Error('Polling should time out before the response arrives');
    },
  });
  assert.deepEqual(await client.waitForActivity('t', '42'), { status: 'processing', uploadId: '42' });
});

test('post chart draws power, heart rate and the plan without text', () => {
  const { svg, summary } = buildPostChartSvg({
    points: ridePoints(1200),
    durationSec: 1200,
    steps: [{ startSec: 0, durationSec: 600, startPct: 60, endPct: 60, zone: 2, kind: 'work' }, { startSec: 600, durationSec: 600, startPct: 105, endPct: 105, zone: 5, kind: 'work' }],
    ftpWatts: 250,
    width: 600,
    height: 200,
  });
  assert.deepEqual(summary, { hasPower: true, hasHeartRate: true, hasPlan: true });
  assert.match(svg, /^<svg /);
  assert.doesNotMatch(svg, /<text/);
  assert.equal((svg.match(/fill-opacity/g) ?? []).length, 2);
});

test('normalized power is left out when power covers less than half the ride', () => {
  const stats = statsFromPoints([{ elapsedSec: 0, powerWatts: 150 }, { elapsedSec: 3600, powerWatts: 150 }], 3600, null);
  assert.equal(stats.averagePowerWatts, 150);
  assert.equal(stats.normalizedPowerWatts, null);
});
