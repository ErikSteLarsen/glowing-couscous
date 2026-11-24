import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createYouTubeVideoService,
  decodeHtmlEntities,
  YOUTUBE_API_BASE_URL,
  youTubeServiceOptionsFromEnv,
  parseIsoDuration,
} from '../lib/youtube/youtube-video-service.ts';

const CHANNEL = 'UCuTaETsuCOkJ0H_GAztWt0Q';
const OK_STATUS = { embeddable: true, privacyStatus: 'public', madeForKids: false };
const PLAYABLE = 'aaaaaaaaaaa';
const LIVE = 'bbbbbbbbbbb';
const UPCOMING = 'ccccccccccc';
const NOT_EMBEDDABLE = 'ddddddddddd';
const KIDS = 'eeeeeeeeeee';
const PRIVATE = 'fffffffffff';

type Call = { endpoint: string; params: URLSearchParams; apiKey: string | null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function snippet(id: string, extra: Record<string, unknown> = {}) {
  return {
    title: `Ride ${id}`,
    channelId: CHANNEL,
    channelTitle: 'GCN',
    publishedAt: '2026-10-01T10:00:00Z',
    liveBroadcastContent: 'none',
    thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } },
    ...extra,
  };
}

const VIDEOS = [
  { id: PLAYABLE, snippet: snippet(PLAYABLE, { title: 'Rock &amp; Roll &#39;84' }), contentDetails: { duration: 'PT1H2M3S' }, status: OK_STATUS },
  { id: LIVE, snippet: snippet(LIVE, { liveBroadcastContent: 'live' }), contentDetails: { duration: 'P0D' }, status: OK_STATUS },
  { id: UPCOMING, snippet: snippet(UPCOMING, { liveBroadcastContent: 'upcoming' }), contentDetails: { duration: 'P0D' }, status: OK_STATUS },
  { id: NOT_EMBEDDABLE, snippet: snippet(NOT_EMBEDDABLE), contentDetails: { duration: 'PT4M' }, status: { ...OK_STATUS, embeddable: false } },
  { id: KIDS, snippet: snippet(KIDS), contentDetails: { duration: 'PT4M' }, status: { ...OK_STATUS, madeForKids: true } },
  { id: PRIVATE, snippet: snippet(PRIVATE), contentDetails: { duration: 'PT4M' }, status: { ...OK_STATUS, privacyStatus: 'private' } },
];

function fakeYouTube(override?: (id: string) => Response) {
  const calls: Call[] = [];
  const fetch = async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const endpoint = url.pathname.split('/').pop() ?? '';
    calls.push({ endpoint, params: url.searchParams, apiKey: new Headers(init?.headers).get('x-goog-api-key') });
    if (endpoint !== 'videos') return json({ error: { code: 404 } }, 404);
    if (url.searchParams.has('maxResults')) return json({ error: { code: 400, errors: [{ reason: 'incompatibleParameters' }] } }, 400);
    const id = url.searchParams.get('id') ?? '';
    if (override) return override(id);
    return json({ items: VIDEOS.filter((video) => video.id === id) });
  };
  return { calls, fetch };
}

function service(fake: ReturnType<typeof fakeYouTube>, options: Partial<Parameters<typeof createYouTubeVideoService>[0]> = {}) {
  let clock = Date.UTC(2026, 10, 24, 12);
  const logs: string[] = [];
  const instance = createYouTubeVideoService({
    apiKey: 'test-key',
    fetch: fake.fetch,
    now: () => clock,
    baseUrl: 'http://stub.local/youtube/v3/',
    log: (message) => logs.push(message),
    ...options,
  });
  return { instance, logs, advance: (ms: number) => { clock += ms; } };
}

test('a lookup makes one videos.list call with the key in a header and normalizes the video', async () => {
  const fake = fakeYouTube();
  const { instance } = service(fake);
  const outcome = await instance.video({ userId: 1, videoId: PLAYABLE });

  assert.deepEqual(fake.calls.map((call) => call.endpoint), ['videos']);
  const [call] = fake.calls;
  assert.equal(call.apiKey, 'test-key');
  assert.equal(call.params.get('key'), null, 'the key travels in a header, not the URL');
  assert.equal(call.params.get('part'), 'id,snippet,contentDetails,status');
  assert.equal(call.params.get('id'), PLAYABLE);
  assert.deepEqual(outcome.ok ? outcome.lookup : null, {
    playability: 'playable',
    video: {
      id: PLAYABLE,
      title: 'Rock & Roll \'84',
      channelId: CHANNEL,
      channelTitle: 'GCN',
      thumbnailUrl: `https://i.ytimg.com/vi/${PLAYABLE}/mqdefault.jpg`,
      publishedAt: '2026-10-01T10:00:00Z',
      durationSec: 3723,
      isLive: false,
      madeForKids: false,
    },
  });
});

test('made-for-kids, not embeddable, upcoming, private and missing videos are not playable', async () => {
  const { instance } = service(fakeYouTube());
  const playability = async (videoId: string) => {
    const outcome = await instance.video({ userId: 1, videoId });
    return outcome.ok ? outcome.lookup.playability : outcome.code;
  };
  assert.equal(await playability(KIDS), 'made_for_kids');
  assert.equal(await playability(NOT_EMBEDDABLE), 'not_embeddable');
  assert.equal(await playability(UPCOMING), 'upcoming');
  assert.equal(await playability(PRIVATE), 'not_found');
  assert.equal(await playability(LIVE), 'playable');
  const missing = await instance.video({ userId: 1, videoId: 'zzzzzzzzzzz' });
  assert.deepEqual(missing.ok ? missing.lookup : null, { video: null, playability: 'not_found' });
});

test('a video without a readable kids status is treated as made for kids', async () => {
  const fake = fakeYouTube((id) => json({ items: [{ id, snippet: snippet(id), contentDetails: { duration: 'PT4M' } }] }));
  const { instance } = service(fake);
  const outcome = await instance.video({ userId: 1, videoId: PLAYABLE });
  assert.equal(outcome.ok ? outcome.lookup.playability : null, 'made_for_kids');
});

test('lookups are cached until they expire, and identical lookups in flight share one call', async () => {
  const fake = fakeYouTube();
  const { instance, advance } = service(fake, { ttlMs: 60_000 });
  const [first, second] = await Promise.all([
    instance.video({ userId: 1, videoId: PLAYABLE }),
    instance.video({ userId: 2, videoId: PLAYABLE }),
  ]);
  assert.equal(first.ok && second.ok, true);
  await instance.video({ userId: 3, videoId: PLAYABLE });
  assert.equal(fake.calls.length, 1);
  advance(60_001);
  await instance.video({ userId: 1, videoId: PLAYABLE });
  assert.equal(fake.calls.length, 2);
});

test('the cache keeps at most the configured number of videos', async () => {
  const fake = fakeYouTube();
  const { instance } = service(fake, { cacheSize: 2 });
  await instance.video({ userId: 1, videoId: PLAYABLE });
  await instance.video({ userId: 1, videoId: LIVE });
  await instance.video({ userId: 1, videoId: KIDS });
  await instance.video({ userId: 1, videoId: PLAYABLE });
  assert.equal(fake.calls.length, 4, 'the oldest lookup was evicted');
});

test('each user has their own limit on upstream calls; cached lookups do not count', async () => {
  const fake = fakeYouTube();
  const { instance, advance } = service(fake, { rateLimit: { limit: 2, windowMs: 60_000 } });
  assert.equal((await instance.video({ userId: 1, videoId: PLAYABLE })).ok, true);
  assert.equal((await instance.video({ userId: 1, videoId: LIVE })).ok, true);
  assert.equal((await instance.video({ userId: 1, videoId: PLAYABLE })).ok, true, 'cache hit');
  const limited = await instance.video({ userId: 1, videoId: KIDS });
  assert.deepEqual(limited.ok ? null : [limited.code, limited.status], ['rate_limited', 429]);
  assert.equal((await instance.video({ userId: 2, videoId: KIDS })).ok, true, 'another user is not limited');
  advance(60_001);
  assert.equal((await instance.video({ userId: 1, videoId: UPCOMING })).ok, true);
});

test('a used-up quota becomes a friendly 429 and stops calls until midnight Pacific time', async () => {
  let exhausted = true;
  const fake = fakeYouTube((id) => (exhausted
    ? json({ error: { code: 403, errors: [{ reason: 'quotaExceeded', domain: 'youtube.quota' }] } }, 403)
    : json({ items: VIDEOS.filter((video) => video.id === id) })));
  const { instance, advance } = service(fake);
  const outcome = await instance.video({ userId: 1, videoId: PLAYABLE });
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.deepEqual([outcome.code, outcome.status], ['quota_exceeded', 429]);
  assert.doesNotMatch(outcome.error, /quota|403|API/i);

  exhausted = false;
  const again = await instance.video({ userId: 2, videoId: LIVE });
  assert.equal(again.ok ? null : again.code, 'quota_exceeded');
  assert.equal(fake.calls.length, 1, 'no further calls while the quota is used up');

  advance(24 * 3_600_000);
  assert.equal((await instance.video({ userId: 2, videoId: LIVE })).ok, true);
});

test('failures are not cached and other upstream errors read as unavailable', async () => {
  let fail = true;
  const fake = fakeYouTube((id) => (fail ? json({ error: { code: 400, errors: [{ reason: 'keyInvalid' }] } }, 400) : json({ items: VIDEOS.filter((video) => video.id === id) })));
  const { instance, logs } = service(fake);
  const outcome = await instance.video({ userId: 1, videoId: PLAYABLE });
  assert.deepEqual(outcome.ok ? null : [outcome.code, outcome.status], ['unavailable', 502]);
  assert.match(logs[0], /keyInvalid/);
  fail = false;
  assert.equal((await instance.video({ userId: 1, videoId: PLAYABLE })).ok, true);
  assert.equal(fake.calls.length, 2);
});

test('network failures read as unavailable', async () => {
  const instance = createYouTubeVideoService({
    apiKey: 'test-key',
    fetch: async () => { throw new TypeError('fetch failed'); },
    log: () => {},
  });
  const outcome = await instance.video({ userId: 1, videoId: PLAYABLE });
  assert.equal(outcome.ok ? null : outcome.code, 'unavailable');
});

test('without an API key the service reports not configured and never calls YouTube', async () => {
  const fake = fakeYouTube();
  const instance = createYouTubeVideoService({ apiKey: undefined, fetch: fake.fetch });
  assert.equal(instance.isConfigured(), false);
  const outcome = await instance.video({ userId: 1, videoId: PLAYABLE });
  assert.deepEqual(outcome.ok ? null : [outcome.code, outcome.status], ['not_configured', 503]);
  assert.equal(fake.calls.length, 0);
});

test('an invalid video ID is rejected before any call', async () => {
  const fake = fakeYouTube();
  const { instance } = service(fake);
  const outcome = await instance.video({ userId: 1, videoId: 'short' });
  assert.equal(outcome.ok ? null : outcome.code, 'invalid_input');
  assert.equal(fake.calls.length, 0);
});

test('entity decoding and ISO durations', () => {
  assert.equal(decodeHtmlEntities('Tom &amp; Jerry &quot;live&quot; &#39;84 &#x1F6B4; &lt;b&gt; &unknown;'), 'Tom & Jerry "live" \'84 🚴 <b> &unknown;');
  assert.equal(parseIsoDuration('PT45S'), 45);
  assert.equal(parseIsoDuration('PT10M'), 600);
  assert.equal(parseIsoDuration('PT1H'), 3600);
  assert.equal(parseIsoDuration('P1DT1S'), 86401);
  assert.equal(parseIsoDuration('P0D'), null);
  assert.equal(parseIsoDuration('bogus'), null);
  assert.equal(parseIsoDuration(undefined), null);
});

test('a stub base URL is honoured only outside production', () => {
  const stub = 'http://127.0.0.1:4599/youtube/v3';
  assert.equal(youTubeServiceOptionsFromEnv({ NODE_ENV: 'development', YOUTUBE_API_BASE_URL: stub }).baseUrl, stub);
  assert.equal(youTubeServiceOptionsFromEnv({ NODE_ENV: 'test', YOUTUBE_API_BASE_URL: ` ${stub} ` }).baseUrl, stub);
  assert.equal(youTubeServiceOptionsFromEnv({ NODE_ENV: 'production', YOUTUBE_API_BASE_URL: stub }).baseUrl, YOUTUBE_API_BASE_URL);
  assert.equal(YOUTUBE_API_BASE_URL, 'https://www.googleapis.com/youtube/v3');
  assert.deepEqual(youTubeServiceOptionsFromEnv({ NODE_ENV: 'production', YOUTUBE_API_KEY: ' k ' }), { apiKey: 'k', baseUrl: YOUTUBE_API_BASE_URL });
  assert.deepEqual(youTubeServiceOptionsFromEnv({ YOUTUBE_API_KEY: '' }), { apiKey: undefined, baseUrl: YOUTUBE_API_BASE_URL });
});
