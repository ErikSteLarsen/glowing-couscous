import type { YouTubeSearchPage, YouTubeVideoLookup, YouTubeVideoSummary } from '@/lib/youtube/youtube-search-service';

export type { YouTubeSearchPage, YouTubeVideoLookup, YouTubeVideoSummary };

/** What the browse view needs to play a video; search results carry more. */
export type YouTubeVideoChoice = Pick<YouTubeVideoSummary, 'id' | 'title' | 'channelTitle'> &
  Partial<Pick<YouTubeVideoSummary, 'channelId' | 'thumbnailUrl' | 'durationSec' | 'isLive'>> & { startSec?: number };

export type YouTubeApiErrorCode = 'not_configured' | 'invalid_input' | 'rate_limited' | 'quota_exceeded' | 'unavailable' | 'signed_out' | 'network';

export type YouTubeApiResult<T> = { ok: true; data: T } | { ok: false; code: YouTubeApiErrorCode; message: string };

const NETWORK_ERROR = 'Could not reach Tempo. Check your connection and try again.';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<YouTubeApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, code: 'network', message: NETWORK_ERROR };
  }
  const payload: unknown = await response.json().catch(() => null);
  if (response.ok && payload && typeof payload === 'object') return { ok: true, data: payload as T };
  const body = (payload ?? {}) as { code?: unknown; error?: unknown };
  const code = response.status === 401 || response.status === 403
    ? 'signed_out'
    : typeof body.code === 'string' ? (body.code as YouTubeApiErrorCode) : 'unavailable';
  const message = typeof body.error === 'string' && body.error.trim() ? body.error : 'Could not load videos. Try again.';
  return { ok: false, code, message };
}

export function searchYouTube(
  params: { query?: string; channelId?: string; pageToken?: string | null },
  signal?: AbortSignal,
): Promise<YouTubeApiResult<YouTubeSearchPage>> {
  const search = new URLSearchParams();
  if (params.query) search.set('q', params.query);
  if (params.channelId) search.set('channelId', params.channelId);
  if (params.pageToken) search.set('pageToken', params.pageToken);
  return getJson(`/api/youtube/search?${search}`, signal);
}

export function lookUpYouTubeVideo(videoId: string, signal?: AbortSignal): Promise<YouTubeApiResult<YouTubeVideoLookup>> {
  return getJson(`/api/youtube/video?id=${encodeURIComponent(videoId)}`, signal);
}

export function fetchYouTubeStatus(signal?: AbortSignal): Promise<YouTubeApiResult<{ searchConfigured: boolean }>> {
  return getJson('/api/youtube/status', signal);
}

/** "1:02:03", "4:05" */
export function formatVideoDuration(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** "3 days ago", "2 years ago" */
export function formatVideoAge(publishedAt: string, now = Date.now()): string {
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return '';
  const seconds = Math.max(0, Math.round((now - published) / 1000));
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 86400],
    ['month', 30 * 86400],
    ['week', 7 * 86400],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (seconds >= size) return format.format(-Math.floor(seconds / size), unit);
  }
  return 'just now';
}
