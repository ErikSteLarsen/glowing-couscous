/**
 * YouTube search for the ride screen's entertainment view, backed by the YouTube Data API v3.
 *
 * Quota (June 2026): search.list draws 1 call from its own bucket of 100 calls a day per project,
 * and every further page is another call. videos.list, channels.list and playlistItems.list cost
 * 1 unit each from the general bucket of 10,000 units a day. Both reset at midnight Pacific time.
 * So search results are cached for hours, a channel's videos come from its uploads playlist,
 * identical requests in flight share one upstream call, and upstream calls are limited per user
 * and per project. Cached data stays far inside the 30-day refresh rule of the Developer Policies.
 */

export const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_PAGE_SIZE = 24;
export const YOUTUBE_QUERY_MAX_LENGTH = 100;
export const YOUTUBE_PAGE_TOKEN_MAX_LENGTH = 200;
export const YOUTUBE_SEARCH_ORDERS = ['relevance', 'date', 'viewCount'] as const;
/** The default search.list allowance per project and Pacific day. */
export const YOUTUBE_DEFAULT_DAILY_SEARCH_LIMIT = 100;

export type YouTubeSearchOrder = (typeof YOUTUBE_SEARCH_ORDERS)[number];

export type YouTubeVideoSummary = {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSec: number | null;
  isLive: boolean;
  /** Designated "made for kids": Tempo must not embed it and links out to YouTube instead. */
  madeForKids: boolean;
};

export type YouTubeSearchPage = {
  items: YouTubeVideoSummary[];
  nextPageToken: string | null;
};

/** Whether a single video can play inside Tempo, and why not. */
export type YouTubeVideoPlayability = 'playable' | 'made_for_kids' | 'not_embeddable' | 'upcoming' | 'not_found';

export type YouTubeVideoLookup = {
  video: YouTubeVideoSummary | null;
  playability: YouTubeVideoPlayability;
};

export type YouTubeSearchErrorCode = 'not_configured' | 'invalid_input' | 'rate_limited' | 'quota_exceeded' | 'unavailable';

type Failure = { ok: false; code: YouTubeSearchErrorCode; status: number; error: string };

export type YouTubeSearchOutcome = { ok: true; page: YouTubeSearchPage } | Failure;
export type YouTubeVideoOutcome = { ok: true; lookup: YouTubeVideoLookup } | Failure;

export type YouTubeSearchQuery = {
  query?: string;
  pageToken?: string;
  channelId?: string;
  order?: YouTubeSearchOrder;
};

export type YouTubeSearchInput = YouTubeSearchQuery & { userId: number };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{2,64}$/;
const PAGE_TOKEN = /^[A-Za-z0-9_-]+$/;
const DAILY_QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded']);
const THROTTLE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded']);
const UPSTREAM_TIMEOUT_MS = 8000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const errors = {
  not_configured: { status: 503, error: 'YouTube search is not set up on this Tempo server. Paste a YouTube link instead.' },
  invalid_input: { status: 400, error: 'Something went wrong. Reload the page and try again.' },
  rate_limited: { status: 429, error: 'You are searching quickly. Wait a moment and try again.' },
  quota_exceeded: { status: 429, error: 'Search limit reached for today. Paste a YouTube link instead, or search again tomorrow.' },
  unavailable: { status: 502, error: 'Could not reach YouTube. Check your connection and try again.' },
} satisfies Record<YouTubeSearchErrorCode, { status: number; error: string }>;

function failure(code: YouTubeSearchErrorCode): Failure {
  return { ok: false, code, ...errors[code] };
}

/** Validates raw query-string values. Returns null when the input is malformed. */
export function parseYouTubeSearchQuery(params: {
  q?: string | null;
  pageToken?: string | null;
  channelId?: string | null;
  order?: string | null;
}): YouTubeSearchQuery | null {
  const query = (params.q ?? '').trim().replace(/\s+/g, ' ');
  const pageToken = params.pageToken ?? '';
  const channelId = params.channelId ?? '';
  const order = params.order ?? '';

  if (query.length > YOUTUBE_QUERY_MAX_LENGTH) return null;
  if (pageToken && (pageToken.length > YOUTUBE_PAGE_TOKEN_MAX_LENGTH || !PAGE_TOKEN.test(pageToken))) return null;
  if (channelId && !CHANNEL_ID.test(channelId)) return null;
  if (order && !(YOUTUBE_SEARCH_ORDERS as readonly string[]).includes(order)) return null;
  if (!query && !channelId) return null;

  return {
    ...(query ? { query } : {}),
    ...(pageToken ? { pageToken } : {}),
    ...(channelId ? { channelId } : {}),
    ...(order ? { order: order as YouTubeSearchOrder } : {}),
  };
}

export function isYouTubeVideoIdValue(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID.test(value);
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the HTML entities the Data API puts in search snippets ("Rock &amp; Roll", "&#39;"). */
export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

/** Reads an ISO 8601 video duration ("PT1H2M3S", "P1DT2H") as seconds; null for live ("P0D") or unknown. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
  return seconds > 0 ? seconds : null;
}

/** YouTube's quota day, which resets at midnight Pacific time. */
export function pacificDay(at: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

type Thumbnails = Record<string, { url?: unknown } | undefined> | undefined;

function thumbnailFor(videoId: string, thumbnails: Thumbnails): string {
  for (const size of ['medium', 'high', 'default']) {
    const url = thumbnails?.[size]?.url;
    if (typeof url === 'string' && /^https:\/\/i\d?\.ytimg\.com\//.test(url)) return url;
  }
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

type VideoResource = {
  id?: unknown;
  snippet?: {
    title?: unknown;
    channelId?: unknown;
    channelTitle?: unknown;
    publishedAt?: unknown;
    liveBroadcastContent?: unknown;
    thumbnails?: Thumbnails;
  };
  contentDetails?: { duration?: unknown };
  status?: { embeddable?: unknown; privacyStatus?: unknown; madeForKids?: unknown };
};

function text(value: unknown): string {
  return typeof value === 'string' ? decodeHtmlEntities(value).trim() : '';
}

function normalizeVideo(video: VideoResource): YouTubeVideoLookup | null {
  const id = typeof video.id === 'string' ? video.id : '';
  const snippet = video.snippet;
  if (!VIDEO_ID.test(id) || !snippet) return null;
  const isLive = snippet.liveBroadcastContent === 'live';
  // Without a readable status Tempo cannot confirm the video is not made for kids, so it links out.
  const madeForKids = video.status?.madeForKids !== false;
  const summary: YouTubeVideoSummary = {
    id,
    title: text(snippet.title) || 'Untitled video',
    channelId: typeof snippet.channelId === 'string' ? snippet.channelId : '',
    channelTitle: text(snippet.channelTitle),
    thumbnailUrl: thumbnailFor(id, snippet.thumbnails),
    publishedAt: typeof snippet.publishedAt === 'string' ? snippet.publishedAt : '',
    durationSec: isLive ? null : parseIsoDuration(video.contentDetails?.duration),
    isLive,
    madeForKids,
  };
  const privacy = video.status?.privacyStatus;
  let playability: YouTubeVideoPlayability = 'playable';
  if (privacy !== undefined && privacy !== 'public' && privacy !== 'unlisted') playability = 'not_found';
  else if (snippet.liveBroadcastContent === 'upcoming') playability = 'upcoming';
  else if (video.status?.embeddable === false) playability = 'not_embeddable';
  else if (madeForKids) playability = 'made_for_kids';
  return { video: summary, playability };
}

/** Results keep made-for-kids videos (shown as links to YouTube) and drop what cannot be watched at all. */
function belongsInResults(lookup: YouTubeVideoLookup): boolean {
  return lookup.playability === 'playable' || lookup.playability === 'made_for_kids';
}

type Bucket = 'search' | 'general';

class UpstreamError extends Error {
  readonly code: YouTubeSearchErrorCode;
  readonly bucket: Bucket;

  constructor(code: YouTubeSearchErrorCode, bucket: Bucket, reason: string) {
    super(`YouTube Data API: ${reason}`);
    this.code = code;
    this.bucket = bucket;
  }
}

type ApiPayload = Record<string, unknown>;

function errorReason(payload: unknown): string {
  const error = (payload as { error?: { errors?: { reason?: unknown }[]; status?: unknown } } | null)?.error;
  const reason = error?.errors?.[0]?.reason;
  if (typeof reason === 'string') return reason;
  return typeof error?.status === 'string' ? error.status : 'unknown';
}

function items(payload: ApiPayload): unknown[] {
  return Array.isArray(payload.items) ? payload.items : [];
}

function nextToken(payload: ApiPayload): string | null {
  const token = payload.nextPageToken;
  return typeof token === 'string' && PAGE_TOKEN.test(token) && token.length <= YOUTUBE_PAGE_TOKEN_MAX_LENGTH ? token : null;
}

type CacheEntry<T> = { expiresAt: number; value: Promise<T> };

/** A bounded, expiring map whose entries are promises, so identical requests in flight share one call. */
function createCache<T>(size: number) {
  const entries = new Map<string, CacheEntry<T>>();
  return {
    get(key: string, at: number) {
      const entry = entries.get(key);
      if (!entry) return null;
      entries.delete(key);
      if (entry.expiresAt <= at) return null;
      entries.set(key, entry);
      return entry;
    },
    set(key: string, entry: CacheEntry<T>) {
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > size) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    /** Shortens or drops an entry once its value is known. */
    settle(key: string, entry: CacheEntry<T>, expiresAt: number | null) {
      if (entries.get(key) !== entry) return;
      if (expiresAt === null) entries.delete(key);
      else entry.expiresAt = Math.min(entry.expiresAt, expiresAt);
    },
  };
}

export function createYouTubeSearchService({
  apiKey,
  fetch: fetchImpl = fetch,
  now = Date.now,
  baseUrl = YOUTUBE_API_BASE_URL,
  searchTtlMs = 6 * HOUR,
  liveTtlMs = 10 * MINUTE,
  channelTtlMs = 30 * MINUTE,
  videoTtlMs = HOUR,
  cacheSize = 300,
  rateLimit = { limit: 20, windowMs: MINUTE },
  dailySearchLimit = YOUTUBE_DEFAULT_DAILY_SEARCH_LIMIT,
  log = (message: string) => console.warn(message),
}: {
  apiKey: string | undefined;
  fetch?: FetchLike;
  now?: () => number;
  baseUrl?: string;
  /** Search pages; the search bucket is small, so these live for hours. */
  searchTtlMs?: number;
  /** Any page that contains a live broadcast. */
  liveTtlMs?: number;
  /** A channel's uploads, which come from the general bucket. */
  channelTtlMs?: number;
  /** Single-video lookups for pasted links. */
  videoTtlMs?: number;
  cacheSize?: number;
  /** Upstream round trips (cache misses) allowed per user within the window. */
  rateLimit?: { limit: number; windowMs: number };
  /** search.list calls this project may make per Pacific day. */
  dailySearchLimit?: number;
  log?: (message: string) => void;
}) {
  const pages = createCache<YouTubeSearchPage>(cacheSize);
  const lookups = createCache<YouTubeVideoLookup>(cacheSize);
  const uploadsPlaylists = new Map<string, string>();
  const callsByUser = new Map<number, number[]>();
  const searchCalls = { day: '', count: 0 };
  const exhausted: Record<Bucket, string> = { search: '', general: '' };
  const root = baseUrl.replace(/\/+$/, '');

  async function call(endpoint: string, params: Record<string, string>): Promise<ApiPayload> {
    const bucket: Bucket = endpoint === 'search' ? 'search' : 'general';
    if (bucket === 'search') {
      const day = pacificDay(now());
      if (searchCalls.day !== day) Object.assign(searchCalls, { day, count: 0 });
      if (searchCalls.count >= dailySearchLimit) throw new UpstreamError('quota_exceeded', bucket, 'daily search limit');
      searchCalls.count += 1;
    }
    const url = new URL(`${root}/${endpoint}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await fetchImpl(url.href, {
        // The key travels in a header so it stays out of URLs and logs.
        headers: { 'X-Goog-Api-Key': apiKey ?? '', Accept: 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch {
      throw new UpstreamError('unavailable', bucket, `${endpoint} network`);
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = errorReason(payload);
      if (DAILY_QUOTA_REASONS.has(reason)) throw new UpstreamError('quota_exceeded', bucket, reason);
      if (THROTTLE_REASONS.has(reason)) throw new UpstreamError('rate_limited', bucket, reason);
      if (reason === 'invalidPageToken') throw new UpstreamError('invalid_input', bucket, reason);
      throw new UpstreamError('unavailable', bucket, `${endpoint} ${response.status} ${reason}`);
    }
    if (!payload || typeof payload !== 'object') throw new UpstreamError('unavailable', bucket, `${endpoint} malformed response`);
    return payload as ApiPayload;
  }

  /** One batched videos.list call (1 unit) for durations, live state, kids status and unescaped titles. */
  async function videoDetails(ids: string[]): Promise<Map<string, YouTubeVideoLookup>> {
    const byId = new Map<string, YouTubeVideoLookup>();
    if (ids.length === 0) return byId;
    const payload = await call('videos', {
      part: 'snippet,contentDetails,status',
      id: ids.join(','),
      maxResults: String(ids.length),
    });
    for (const resource of items(payload)) {
      const lookup = normalizeVideo(resource as VideoResource);
      if (lookup?.video) byId.set(lookup.video.id, lookup);
    }
    return byId;
  }

  async function pageFor(ids: string[], payload: ApiPayload): Promise<YouTubeSearchPage> {
    const unique = [...new Set(ids)];
    const details = await videoDetails(unique);
    const videos = unique.flatMap((id) => {
      const lookup = details.get(id);
      return lookup?.video && belongsInResults(lookup) ? [lookup.video] : [];
    });
    return { items: videos, nextPageToken: nextToken(payload) };
  }

  async function searchVideos(input: YouTubeSearchQuery): Promise<YouTubeSearchPage> {
    const params: Record<string, string> = {
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      safeSearch: 'moderate',
      maxResults: String(YOUTUBE_PAGE_SIZE),
      order: input.order ?? 'relevance',
    };
    if (input.query) params.q = input.query;
    if (input.channelId) params.channelId = input.channelId;
    if (input.pageToken) params.pageToken = input.pageToken;
    const payload = await call('search', params);
    const ids = items(payload).flatMap((item) => {
      const id = (item as { id?: { videoId?: unknown } }).id?.videoId;
      return isYouTubeVideoIdValue(id) ? [id] : [];
    });
    return pageFor(ids, payload);
  }

  async function uploadsPlaylistFor(channelId: string): Promise<string | null> {
    const known = uploadsPlaylists.get(channelId);
    if (known) return known;
    const payload = await call('channels', { part: 'contentDetails', id: channelId });
    const channel = items(payload)[0] as { contentDetails?: { relatedPlaylists?: { uploads?: unknown } } } | undefined;
    const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (typeof uploads !== 'string' || !PLAYLIST_ID.test(uploads)) return null;
    if (uploadsPlaylists.size >= cacheSize) uploadsPlaylists.clear();
    uploadsPlaylists.set(channelId, uploads);
    return uploads;
  }

  /** A channel's newest uploads through channels.list and playlistItems.list: general units, no search call. */
  async function channelUploads(channelId: string, pageToken?: string): Promise<YouTubeSearchPage> {
    const playlistId = await uploadsPlaylistFor(channelId);
    if (!playlistId) return { items: [], nextPageToken: null };
    const params: Record<string, string> = { part: 'contentDetails', playlistId, maxResults: String(YOUTUBE_PAGE_SIZE) };
    if (pageToken) params.pageToken = pageToken;
    const payload = await call('playlistItems', params);
    const ids = items(payload).flatMap((item) => {
      const id = (item as { contentDetails?: { videoId?: unknown } }).contentDetails?.videoId;
      return isYouTubeVideoIdValue(id) ? [id] : [];
    });
    return pageFor(ids, payload);
  }

  function allowUpstreamCall(userId: number, at: number): boolean {
    const since = at - rateLimit.windowMs;
    const recent = (callsByUser.get(userId) ?? []).filter((time) => time > since);
    if (recent.length >= rateLimit.limit) {
      callsByUser.set(userId, recent);
      return false;
    }
    recent.push(at);
    callsByUser.set(userId, recent);
    if (callsByUser.size > 1000) {
      for (const [user, times] of callsByUser) {
        if (times.every((time) => time <= since)) callsByUser.delete(user);
      }
    }
    return true;
  }

  function isExhausted(bucket: Bucket, at: number) {
    return exhausted[bucket] === pacificDay(at);
  }

  function handleError(error: unknown): Failure {
    if (error instanceof UpstreamError) {
      // YouTube said the day's quota is used up: stop calling that bucket until it resets.
      if (error.code === 'quota_exceeded') exhausted[error.bucket] = pacificDay(now());
      if (error.code === 'unavailable') log(error.message);
      return failure(error.code);
    }
    log(`YouTube Data API: ${error instanceof Error ? error.message : 'unexpected error'}`);
    return failure('unavailable');
  }

  async function cached<T>(
    cache: ReturnType<typeof createCache<T>>,
    key: string,
    { userId, ttlMs, buckets, load, ttlFor }: {
      userId: number;
      ttlMs: number;
      buckets: Bucket[];
      load: () => Promise<T>;
      ttlFor?: (value: T) => number;
    },
  ): Promise<{ ok: true; value: T } | Failure> {
    if (!apiKey) return failure('not_configured');
    const at = now();
    let entry = cache.get(key, at);
    if (!entry) {
      if (buckets.some((bucket) => isExhausted(bucket, at))) return failure('quota_exceeded');
      if (!allowUpstreamCall(userId, at)) return failure('rate_limited');
      entry = { expiresAt: at + ttlMs, value: load() };
      cache.set(key, entry);
    }
    try {
      const value = await entry.value;
      if (ttlFor) cache.settle(key, entry, at + ttlFor(value));
      return { ok: true, value };
    } catch (error) {
      cache.settle(key, entry, null);
      return handleError(error);
    }
  }

  return {
    isConfigured: () => Boolean(apiKey),

    /** Searches videos, or lists a channel's newest videos when only a channel is given. */
    async search({ userId, ...query }: YouTubeSearchInput): Promise<YouTubeSearchOutcome> {
      const isChannelList = Boolean(query.channelId) && !query.query && (!query.order || query.order === 'date');
      const key = JSON.stringify([query.query?.toLowerCase() ?? '', query.channelId ?? '', query.order ?? '', query.pageToken ?? '']);
      const outcome = await cached(pages, key, {
        userId,
        ttlMs: isChannelList ? channelTtlMs : searchTtlMs,
        buckets: isChannelList ? ['general'] : ['search', 'general'],
        load: () => (isChannelList ? channelUploads(query.channelId!, query.pageToken) : searchVideos(query)),
        ttlFor: (page) => (page.items.some((video) => video.isLive) ? liveTtlMs : Number.POSITIVE_INFINITY),
      });
      return outcome.ok ? { ok: true, page: outcome.value } : outcome;
    },

    /** Looks up one video (a pasted link or a recent one) before it is embedded. */
    async video({ userId, videoId }: { userId: number; videoId: string }): Promise<YouTubeVideoOutcome> {
      if (!isYouTubeVideoIdValue(videoId)) return failure('invalid_input');
      const outcome = await cached(lookups, videoId, {
        userId,
        ttlMs: videoTtlMs,
        buckets: ['general'],
        load: async (): Promise<YouTubeVideoLookup> => (await videoDetails([videoId])).get(videoId) ?? { video: null, playability: 'not_found' },
      });
      return outcome.ok ? { ok: true, lookup: outcome.value } : outcome;
    },
  };
}

export type YouTubeSearchService = ReturnType<typeof createYouTubeSearchService>;

let defaultService: YouTubeSearchService | null = null;

/**
 * The app-wide service, configured from `YOUTUBE_API_KEY`, optional `YOUTUBE_SEARCH_DAILY_LIMIT`
 * and, for local stubs only, `YOUTUBE_API_BASE_URL`.
 */
export function getYouTubeSearchService(): YouTubeSearchService {
  if (!defaultService) {
    const dailyLimit = Number(process.env.YOUTUBE_SEARCH_DAILY_LIMIT);
    defaultService = createYouTubeSearchService({
      apiKey: process.env.YOUTUBE_API_KEY?.trim() || undefined,
      baseUrl: process.env.YOUTUBE_API_BASE_URL?.trim() || YOUTUBE_API_BASE_URL,
      ...(Number.isSafeInteger(dailyLimit) && dailyLimit > 0 ? { dailySearchLimit: dailyLimit } : {}),
    });
  }
  return defaultService;
}
