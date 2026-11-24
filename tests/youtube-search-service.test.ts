import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createYouTubeSearchService,
  decodeHtmlEntities,
  parseIsoDuration,
  parseYouTubeSearchQuery,
} from '../lib/youtube/youtube-search-service.ts';

const CHANNEL = 'UCuTaETsuCOkJ0H_GAztWt0Q';
const UPLOADS = 'UUuTaETsuCOkJ0H_GAztWt0Q';
const OK_STATUS = { embeddable: true, privacyStatus: 'public', madeForKids: false };
const IDS = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd'];

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

const IDS_EXTRA = 'eeeeeeeeeee';

function fakeYouTube(overrides: { search?: () => Response; videos?: (ids: string[]) => Response; playlistItems?: () => Response } = {}) {
  const calls: Call[] = [];
  const fetch = async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const endpoint = url.pathname.split('/').pop() ?? '';
    calls.push({ endpoint, params: url.searchParams, apiKey: new Headers(init?.headers).get('x-goog-api-key') });
    if (endpoint === 'search') {
      return overrides.search?.() ?? json({
        nextPageToken: 'CBgQAA',
        items: [
          { id: { kind: 'youtube#video', videoId: IDS[0] }, snippet: snippet(IDS[0], { title: 'Rock &amp; Roll &#39;84' }) },
          { id: { kind: 'youtube#video', videoId: IDS[1] }, snippet: snippet(IDS[1]) },
          { id: { kind: 'youtube#video', videoId: IDS[2] }, snippet: snippet(IDS[2]) },
          { id: { kind: 'youtube#video', videoId: IDS[3] }, snippet: snippet(IDS[3]) },
        ],
      });
    }
    if (endpoint === 'videos') {
      const ids = (url.searchParams.get('id') ?? '').split(',');
      if (overrides.videos) return overrides.videos(ids);
      return json({
        items: [
          { id: IDS[0], snippet: snippet(IDS[0], { title: 'Rock & Roll \'84' }), contentDetails: { duration: 'PT1H2M3S' }, status: OK_STATUS },
          { id: IDS[1], snippet: snippet(IDS[1], { liveBroadcastContent: 'live' }), contentDetails: { duration: 'P0D' }, status: OK_STATUS },
          { id: IDS[2], snippet: snippet(IDS[2], { liveBroadcastContent: 'upcoming' }), contentDetails: { duration: 'P0D' }, status: OK_STATUS },
          { id: IDS[3], snippet: snippet(IDS[3]), contentDetails: { duration: 'PT4M' }, status: { ...OK_STATUS, embeddable: false } },
          { id: IDS_EXTRA, snippet: snippet(IDS_EXTRA), contentDetails: { duration: 'PT4M' }, status: { ...OK_STATUS, madeForKids: true } },
        ].filter((video) => ids.includes(video.id)),
      });
    }
    if (endpoint === 'channels') {
      return json({ items: [{ id: CHANNEL, contentDetails: { relatedPlaylists: { uploads: UPLOADS } } }] });
    }
    if (endpoint === 'playlistItems') {
      return overrides.playlistItems?.() ?? json({ items: [{ contentDetails: { videoId: IDS[0] } }, { contentDetails: { videoId: IDS[1] } }] });
    }
    return json({ error: { code: 404 } }, 404);
  };
  return { calls, fetch };
}

function service(fake: ReturnType<typeof fakeYouTube>, options: Partial<Parameters<typeof createYouTubeSearchService>[0]> = {}) {
  let clock = 1_000_000;
  const logs: string[] = [];
  const instance = createYouTubeSearchService({
    apiKey: 'test-key',
    fetch: fake.fetch,
    now: () => clock,
    baseUrl: 'http://stub.local/youtube/v3/',
    log: (message) => logs.push(message),
    ...options,
  });
  return { instance, logs, advance: (ms: number) => { clock += ms; } };
}

test('search makes one search.list and one videos.list call and normalizes the videos', async () => {
  const fake = fakeYouTube();
  const { instance } = service(fake);
  const outcome = await instance.search({ userId: 1, query: 'scenic cycling 4k' });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.deepEqual(fake.calls.map((call) => call.endpoint), ['search', 'videos']);
  const [search, videos] = fake.calls;
  assert.equal(search.apiKey, 'test-key');
  assert.equal(search.params.get('key'), null, 'the key travels in a header, not the URL');
  assert.equal(search.params.get('part'), 'snippet');
  assert.equal(search.params.get('type'), 'video');
  assert.equal(search.params.get('videoEmbeddable'), 'true');
  assert.equal(search.params.get('safeSearch'), 'moderate');
  assert.equal(search.params.get('maxResults'), '24');
  assert.equal(search.params.get('q'), 'scenic cycling 4k');
  assert.equal(search.params.get('order'), 'relevance');
  assert.equal(videos.params.get('id'), IDS.join(','));
  assert.equal(videos.params.get('part'), 'snippet,contentDetails,status');

  assert.equal(outcome.page.nextPageToken, 'CBgQAA');
  assert.deepEqual(outcome.page.items, [
    {
      id: IDS[0],
      title: 'Rock & Roll \'84',
      channelId: CHANNEL,
      channelTitle: 'GCN',
      thumbnailUrl: `https://i.ytimg.com/vi/${IDS[0]}/mqdefault.jpg`,
      publishedAt: '2026-10-01T10:00:00Z',
      durationSec: 3723,
      isLive: false,
      madeForKids: false,
    },
    {
      id: IDS[1],
      title: `Ride ${IDS[1]}`,
      channelId: CHANNEL,
      channelTitle: 'GCN',
      thumbnailUrl: `https://i.ytimg.com/vi/${IDS[1]}/mqdefault.jpg`,
      publishedAt: '2026-10-01T10:00:00Z',
      durationSec: null,
      isLive: true,
      madeForKids: false,
    },
  ], 'upcoming and non-embeddable videos are dropped');
});

test('a channel without a query lists its uploads playlist instead of spending a search', async () => {
  const fake = fakeYouTube();
  const { instance } = service(fake);
  const outcome = await instance.search({ userId: 1, channelId: CHANNEL });

  assert.equal(outcome.ok, true);
  assert.deepEqual(fake.calls.map((call) => call.endpoint), ['channels', 'playlistItems', 'videos']);
  assert.equal(fake.calls[0].params.get('id'), CHANNEL);
  assert.equal(fake.calls[1].params.get('playlistId'), UPLOADS);

  await instance.search({ userId: 1, channelId: CHANNEL, pageToken: 'EAAaBlBUOkNESQ' });
  assert.deepEqual(fake.calls.slice(3).map((call) => call.endpoint), ['playlistItems', 'videos'], 'the uploads playlist is remembered');
  assert.equal(fake.calls[3].params.get('pageToken'), 'EAAaBlBUOkNESQ');

  await instance.search({ userId: 1, channelId: CHANNEL, query: 'tour' });
  assert.equal(fake.calls[5].endpoint, 'search');
  assert.equal(fake.calls[5].params.get('channelId'), CHANNEL);
});

test('made-for-kids videos stay in results as links but are never playable', async () => {
  const fake = fakeYouTube({
    search: () => json({ items: [{ id: { videoId: IDS[0] } }, { id: { videoId: IDS_EXTRA } }] }),
  });
  const { instance } = service(fake);
  const outcome = await instance.search({ userId: 1, query: 'cartoon bikes' });
  assert.deepEqual(outcome.ok ? outcome.page.items.map((video) => [video.id, video.madeForKids]) : null, [[IDS[0], false], [IDS_EXTRA, true]]);

  const kids = await instance.video({ userId: 1, videoId: IDS_EXTRA });
  assert.equal(kids.ok ? kids.lookup.playability : null, 'made_for_kids');
  const blocked = await instance.video({ userId: 1, videoId: IDS[3] });
  assert.equal(blocked.ok ? blocked.lookup.playability : null, 'not_embeddable');
  const playable = await instance.video({ userId: 1, videoId: IDS[0] });
  assert.deepEqual(playable.ok ? [playable.lookup.playability, playable.lookup.video?.title] : null, ['playable', 'Rock & Roll \'84']);
  const missing = await instance.video({ userId: 1, videoId: 'zzzzzzzzzzz' });
  assert.deepEqual(missing.ok ? missing.lookup : null, { video: null, playability: 'not_found' });

  const searchCalls = fake.calls.filter((call) => call.endpoint === 'search').length;
  await instance.video({ userId: 1, videoId: IDS[0] });
  assert.equal(fake.calls.filter((call) => call.endpoint === 'search').length, searchCalls, 'lookups never spend searches');
  assert.equal(fake.calls.filter((call) => call.endpoint === 'videos').length, 5, 'the repeated lookup came from the cache');
});

test('a video without a readable kids status is treated as made for kids', async () => {
  const fake = fakeYouTube({
    videos: () => json({ items: [{ id: IDS[0], snippet: snippet(IDS[0]), contentDetails: { duration: 'PT4M' } }] }),
  });
  const { instance } = service(fake);
  const outcome = await instance.video({ userId: 1, videoId: IDS[0] });
  assert.equal(outcome.ok ? outcome.lookup.playability : null, 'made_for_kids');
});

test('repeated searches are served from the cache until it expires', async () => {
  const fake = fakeYouTube({ search: () => json({ items: [{ id: { videoId: IDS[0] } }] }) });
  const { instance, advance } = service(fake, { searchTtlMs: 60_000 });
  await instance.search({ userId: 1, query: 'Nature 4K' });
  await instance.search({ userId: 2, query: 'nature 4k' });
  assert.equal(fake.calls.length, 2, 'same query, different case and user: one upstream round');

  await instance.search({ userId: 1, query: 'Nature 4K', pageToken: 'CBgQAA' });
  assert.equal(fake.calls.length, 4, 'another page is another lookup');

  advance(60_001);
  await instance.search({ userId: 1, query: 'Nature 4K' });
  assert.equal(fake.calls.length, 6);
});

test('pages with a live broadcast expire sooner', async () => {
  const fake = fakeYouTube();
  const { instance, advance } = service(fake, { searchTtlMs: 6 * 3_600_000, liveTtlMs: 600_000 });
  await instance.search({ userId: 1, query: 'live cycling' });
  advance(599_000);
  await instance.search({ userId: 1, query: 'live cycling' });
  assert.equal(fake.calls.length, 2);
  advance(2_000);
  await instance.search({ userId: 1, query: 'live cycling' });
  assert.equal(fake.calls.length, 4);
});

test('identical requests in flight share one upstream round', async () => {
  const fake = fakeYouTube();
  const { instance } = service(fake);
  const [first, second] = await Promise.all([
    instance.search({ userId: 1, query: 'podcasts' }),
    instance.search({ userId: 2, query: 'Podcasts' }),
  ]);
  assert.equal(first.ok && second.ok, true);
  assert.equal(fake.calls.length, 2);
});

test('the project-wide daily search allowance resets at midnight Pacific time', async () => {
  const fake = fakeYouTube();
  // 2026-11-24 07:00 UTC is 23:00 on 23 November in Los Angeles.
  let clock = Date.UTC(2026, 10, 24, 7, 0, 0);
  const limited = createYouTubeSearchService({ apiKey: 'k', fetch: fake.fetch, now: () => clock, dailySearchLimit: 2, log: () => {} });
  assert.equal((await limited.search({ userId: 1, query: 'a' })).ok, true);
  assert.equal((await limited.search({ userId: 2, query: 'b' })).ok, true);
  const over = await limited.search({ userId: 3, query: 'c' });
  assert.deepEqual(over.ok ? null : [over.code, over.status], ['quota_exceeded', 429]);
  assert.equal((await limited.search({ userId: 3, query: 'a' })).ok, true, 'cached searches still work');
  assert.equal((await limited.search({ userId: 3, channelId: CHANNEL })).ok, true, 'channel videos use the general bucket');
  assert.equal((await limited.video({ userId: 3, videoId: IDS[0] })).ok, true, 'pasted links still work');

  clock = Date.UTC(2026, 10, 24, 8, 0, 1);
  assert.equal((await limited.search({ userId: 3, query: 'c' })).ok, true, 'a new Pacific day');
});

test('the cache keeps at most the configured number of results', async () => {
  const fake = fakeYouTube();
  const { instance } = service(fake, { cacheSize: 2 });
  await instance.search({ userId: 1, query: 'one' });
  await instance.search({ userId: 1, query: 'two' });
  await instance.search({ userId: 1, query: 'three' });
  await instance.search({ userId: 1, query: 'one' });
  assert.equal(fake.calls.filter((call) => call.endpoint === 'search').length, 4, '"one" was evicted');
});

test('each user has their own limit on upstream calls; cached results do not count', async () => {
  const fake = fakeYouTube();
  const { instance, advance } = service(fake, { rateLimit: { limit: 2, windowMs: 60_000 } });
  assert.equal((await instance.search({ userId: 1, query: 'a' })).ok, true);
  assert.equal((await instance.search({ userId: 1, query: 'b' })).ok, true);
  assert.equal((await instance.search({ userId: 1, query: 'a' })).ok, true, 'cache hit');
  const limited = await instance.search({ userId: 1, query: 'c' });
  assert.deepEqual(limited.ok ? null : [limited.code, limited.status], ['rate_limited', 429]);
  assert.equal((await instance.search({ userId: 2, query: 'c' })).ok, true, 'another user is not limited');

  advance(60_001);
  assert.equal((await instance.search({ userId: 1, query: 'd' })).ok, true);
});

test('a used-up quota becomes a friendly 429 and pauses that bucket for the day', async () => {
  const fake = fakeYouTube({
    search: () => json({ error: { code: 403, errors: [{ reason: 'quotaExceeded', domain: 'youtube.quota' }] } }, 403),
  });
  const { instance, advance } = service(fake);
  const outcome = await instance.search({ userId: 1, query: 'podcasts' });
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.code, 'quota_exceeded');
  assert.equal(outcome.status, 429);
  assert.doesNotMatch(outcome.error, /quota|403|API/i);
  assert.match(outcome.error, /Search limit reached for today/);

  const again = await instance.search({ userId: 2, query: 'documentaries' });
  assert.equal(again.ok ? null : again.code, 'quota_exceeded');
  assert.equal(fake.calls.length, 1, 'no further searches while the quota is used up');
  assert.equal((await instance.video({ userId: 2, videoId: IDS[0] })).ok, true, 'the general bucket still works');

  advance(24 * 3_600_000);
  await instance.search({ userId: 2, query: 'documentaries' });
  assert.equal(fake.calls.filter((call) => call.endpoint === 'search').length, 2);
});

test('failures are not cached and other upstream errors read as unavailable', async () => {
  let fail = true;
  const fake = fakeYouTube({
    search: () => (fail ? json({ error: { code: 400, errors: [{ reason: 'keyInvalid' }] } }, 400) : json({ items: [] })),
  });
  const { instance, logs } = service(fake);
  const outcome = await instance.search({ userId: 1, query: 'music' });
  assert.deepEqual(outcome.ok ? null : [outcome.code, outcome.status], ['unavailable', 502]);
  assert.match(logs[0], /keyInvalid/);

  fail = false;
  const retry = await instance.search({ userId: 1, query: 'music' });
  assert.deepEqual(retry.ok ? retry.page : null, { items: [], nextPageToken: null });
  assert.deepEqual(fake.calls.map((call) => call.endpoint), ['search', 'search'], 'no videos.list for an empty page');
});

test('network failures read as unavailable', async () => {
  const instance = createYouTubeSearchService({
    apiKey: 'test-key',
    fetch: async () => { throw new TypeError('fetch failed'); },
    log: () => {},
  });
  const outcome = await instance.search({ userId: 1, query: 'music' });
  assert.equal(outcome.ok ? null : outcome.code, 'unavailable');
});

test('without an API key the service reports not configured and never calls YouTube', async () => {
  const fake = fakeYouTube();
  const instance = createYouTubeSearchService({ apiKey: undefined, fetch: fake.fetch });
  const outcome = await instance.search({ userId: 1, query: 'music' });
  assert.deepEqual(outcome.ok ? null : [outcome.code, outcome.status], ['not_configured', 503]);
  assert.equal(fake.calls.length, 0);
});

test('query validation bounds every value', () => {
  assert.deepEqual(parseYouTubeSearchQuery({ q: '  scenic   cycling  ' }), { query: 'scenic cycling' });
  assert.deepEqual(parseYouTubeSearchQuery({ q: '', channelId: CHANNEL, pageToken: 'CBgQAA' }), { channelId: CHANNEL, pageToken: 'CBgQAA' });
  assert.deepEqual(parseYouTubeSearchQuery({ q: 'tour', order: 'date' }), { query: 'tour', order: 'date' });
  assert.equal(parseYouTubeSearchQuery({}), null, 'needs a query or a channel');
  assert.equal(parseYouTubeSearchQuery({ q: 'x'.repeat(101) }), null);
  assert.equal(parseYouTubeSearchQuery({ q: 'a', pageToken: 'bad token' }), null);
  assert.equal(parseYouTubeSearchQuery({ q: 'a', pageToken: 'A'.repeat(201) }), null);
  assert.equal(parseYouTubeSearchQuery({ channelId: 'UC123' }), null);
  assert.equal(parseYouTubeSearchQuery({ q: 'a', order: 'rating' }), null);
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
