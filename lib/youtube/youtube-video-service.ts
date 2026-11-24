/**
 * Checks one YouTube video before the ride screen embeds it, backed by the YouTube Data API v3.
 *
 * YouTube's Developer Policies require checking every embedded video's made-for-kids status, so a
 * video a rider brings from YouTube (bookmark, drop, paste, the desktop app's YouTube window or
 * Recently played) is looked up first. One videos.list call costs 1 unit of the general bucket of
 * 10,000 units a day, which resets at midnight Pacific time. Lookups are cached for an hour,
 * identical lookups in flight share one call, and upstream calls are limited per user. Tempo makes
 * no search calls. Cached data stays far inside the 30-day refresh rule of the Developer Policies.
 */

export const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

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

/** Whether a single video can play inside Tempo, and why not. */
export type YouTubeVideoPlayability = 'playable' | 'made_for_kids' | 'not_embeddable' | 'upcoming' | 'not_found';

export type YouTubeVideoLookup = {
  video: YouTubeVideoSummary | null;
  playability: YouTubeVideoPlayability;
};

export type YouTubeVideoErrorCode = 'not_configured' | 'invalid_input' | 'rate_limited' | 'quota_exceeded' | 'unavailable';

type Failure = { ok: false; code: YouTubeVideoErrorCode; status: number; error: string };

export type YouTubeVideoOutcome = { ok: true; lookup: YouTubeVideoLookup } | Failure;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const DAILY_QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded']);
const THROTTLE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded']);
const UPSTREAM_TIMEOUT_MS = 8000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const errors = {
  not_configured: { status: 503, error: 'Playing videos in Tempo is not set up on this Tempo server.' },
  invalid_input: { status: 400, error: 'Something went wrong. Reload the page and try again.' },
  rate_limited: { status: 429, error: 'You are switching videos quickly. Wait a moment and try again.' },
  quota_exceeded: { status: 429, error: 'Tempo has checked as many videos as YouTube allows today. Try again tomorrow, or open the video on YouTube.' },
  unavailable: { status: 502, error: 'Could not reach YouTube. Check your connection and try again.' },
} satisfies Record<YouTubeVideoErrorCode, { status: number; error: string }>;

function failure(code: YouTubeVideoErrorCode): Failure {
  return { ok: false, code, ...errors[code] };
}

export function isYouTubeVideoIdValue(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID.test(value);
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes HTML entities the Data API may put in titles ("Rock &amp; Roll", "&#39;"). */
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

class UpstreamError extends Error {
  readonly code: YouTubeVideoErrorCode;

  constructor(code: YouTubeVideoErrorCode, reason: string) {
    super(`YouTube Data API: ${reason}`);
    this.code = code;
  }
}

function errorReason(payload: unknown): string {
  const error = (payload as { error?: { errors?: { reason?: unknown }[]; status?: unknown } } | null)?.error;
  const reason = error?.errors?.[0]?.reason;
  if (typeof reason === 'string') return reason;
  return typeof error?.status === 'string' ? error.status : 'unknown';
}

type CacheEntry = { expiresAt: number; value: Promise<YouTubeVideoLookup> };

export function createYouTubeVideoService({
  apiKey,
  fetch: fetchImpl = fetch,
  now = Date.now,
  baseUrl = YOUTUBE_API_BASE_URL,
  ttlMs = HOUR,
  cacheSize = 300,
  rateLimit = { limit: 20, windowMs: MINUTE },
  log = (message: string) => console.warn(message),
}: {
  apiKey: string | undefined;
  fetch?: FetchLike;
  now?: () => number;
  baseUrl?: string;
  /** How long a lookup is reused. */
  ttlMs?: number;
  cacheSize?: number;
  /** Upstream round trips (cache misses) allowed per user within the window. */
  rateLimit?: { limit: number; windowMs: number };
  log?: (message: string) => void;
}) {
  const cache = new Map<string, CacheEntry>();
  const callsByUser = new Map<number, number[]>();
  let exhaustedDay = '';
  const root = baseUrl.replace(/\/+$/, '');

  function cached(key: string, at: number): CacheEntry | null {
    const entry = cache.get(key);
    if (!entry) return null;
    cache.delete(key);
    if (entry.expiresAt <= at) return null;
    cache.set(key, entry);
    return entry;
  }

  function remember(key: string, entry: CacheEntry) {
    cache.delete(key);
    cache.set(key, entry);
    while (cache.size > cacheSize) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  /** One videos.list call (1 unit) for the title, live state, embeddable and made-for-kids status. */
  async function lookUp(videoId: string): Promise<YouTubeVideoLookup> {
    const url = new URL(`${root}/videos`);
    url.searchParams.set('part', 'id,snippet,contentDetails,status');
    url.searchParams.set('id', videoId);
    let response: Response;
    try {
      response = await fetchImpl(url.href, {
        // The key travels in a header so it stays out of URLs and logs.
        headers: { 'X-Goog-Api-Key': apiKey ?? '', Accept: 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch {
      throw new UpstreamError('unavailable', 'videos network');
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = errorReason(payload);
      if (DAILY_QUOTA_REASONS.has(reason)) throw new UpstreamError('quota_exceeded', reason);
      if (THROTTLE_REASONS.has(reason)) throw new UpstreamError('rate_limited', reason);
      throw new UpstreamError('unavailable', `videos ${response.status} ${reason}`);
    }
    if (!payload || typeof payload !== 'object') throw new UpstreamError('unavailable', 'videos malformed response');
    const items = Array.isArray((payload as { items?: unknown }).items) ? (payload as { items: unknown[] }).items : [];
    for (const resource of items) {
      const lookup = normalizeVideo(resource as VideoResource);
      if (lookup?.video?.id === videoId) return lookup;
    }
    return { video: null, playability: 'not_found' };
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

  function handleError(error: unknown): Failure {
    if (error instanceof UpstreamError) {
      // YouTube said the day's quota is used up: stop calling until it resets.
      if (error.code === 'quota_exceeded') exhaustedDay = pacificDay(now());
      if (error.code === 'unavailable') log(error.message);
      return failure(error.code);
    }
    log(`YouTube Data API: ${error instanceof Error ? error.message : 'unexpected error'}`);
    return failure('unavailable');
  }

  return {
    isConfigured: () => Boolean(apiKey),

    /** Looks up one video before it is embedded. */
    async video({ userId, videoId }: { userId: number; videoId: string }): Promise<YouTubeVideoOutcome> {
      if (!isYouTubeVideoIdValue(videoId)) return failure('invalid_input');
      if (!apiKey) return failure('not_configured');
      const at = now();
      let entry = cached(videoId, at);
      if (!entry) {
        if (exhaustedDay === pacificDay(at)) return failure('quota_exceeded');
        if (!allowUpstreamCall(userId, at)) return failure('rate_limited');
        entry = { expiresAt: at + ttlMs, value: lookUp(videoId) };
        remember(videoId, entry);
      }
      try {
        return { ok: true, lookup: await entry.value };
      } catch (error) {
        if (cache.get(videoId) === entry) cache.delete(videoId);
        return handleError(error);
      }
    },
  };
}

export type YouTubeVideoService = ReturnType<typeof createYouTubeVideoService>;

let defaultService: YouTubeVideoService | null = null;

type YouTubeEnv = Partial<Record<'NODE_ENV' | 'YOUTUBE_API_KEY' | 'YOUTUBE_API_BASE_URL', string>>;

/**
 * Service options from the environment: `YOUTUBE_API_KEY` and, outside production only,
 * `YOUTUBE_API_BASE_URL` for a local stub. Production always calls Google.
 */
export function youTubeServiceOptionsFromEnv(env: YouTubeEnv) {
  const stubUrl = env.NODE_ENV !== 'production' ? env.YOUTUBE_API_BASE_URL?.trim() : undefined;
  return {
    apiKey: env.YOUTUBE_API_KEY?.trim() || undefined,
    baseUrl: stubUrl || YOUTUBE_API_BASE_URL,
  };
}

/** The app-wide service. Its cache and counters live in this server process only. */
export function getYouTubeVideoService(): YouTubeVideoService {
  defaultService ??= createYouTubeVideoService(youTubeServiceOptionsFromEnv(process.env));
  return defaultService;
}
