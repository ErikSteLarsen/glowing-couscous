import type { YouTubeVideoLookup, YouTubeVideoSummary } from '@/lib/youtube/youtube-video-service';

export type { YouTubeVideoLookup, YouTubeVideoSummary };

/** What the panel needs to play a video; a checked video carries more. */
export type YouTubeVideoChoice = Pick<YouTubeVideoSummary, 'id' | 'title' | 'channelTitle'> &
  Partial<Pick<YouTubeVideoSummary, 'channelId' | 'thumbnailUrl' | 'durationSec' | 'isLive'>> & { startSec?: number };

export type YouTubeApiErrorCode = 'not_configured' | 'invalid_input' | 'rate_limited' | 'quota_exceeded' | 'unavailable' | 'signed_out' | 'network';

export type YouTubeApiResult<T> = { ok: true; data: T } | { ok: false; code: YouTubeApiErrorCode; message: string };

const NETWORK_ERROR = 'Could not reach Wattonaut. Check your connection and try again.';

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

export function lookUpYouTubeVideo(videoId: string, signal?: AbortSignal): Promise<YouTubeApiResult<YouTubeVideoLookup>> {
  return getJson(`/api/youtube/video?id=${encodeURIComponent(videoId)}`, signal);
}

export function fetchYouTubeStatus(signal?: AbortSignal): Promise<YouTubeApiResult<{ configured: boolean }>> {
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
