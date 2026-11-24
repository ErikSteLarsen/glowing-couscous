import { isYouTubeVideoId } from '../../../../lib/youtube/youtube-url.ts';
import type { YouTubeVideoChoice } from './youtube-client';

/** Before recents were kept per account; removed on first read. */
const LEGACY_KEY = 'tempo-ride-youtube-recent';
const MAX_RECENT = 12;
/** YouTube data may be kept for at most 30 days; entries older than that are dropped. */
export const RECENT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const recentVideosKey = (userId: number) => `tempo.ride.youtube.recent.${userId}`;

type StoredVideo = YouTubeVideoChoice & { watchedAt: number };

function sanitize(value: unknown, now: number): StoredVideo | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== 'string' || !isYouTubeVideoId(entry.id)) return null;
  if (typeof entry.watchedAt !== 'number' || !Number.isFinite(entry.watchedAt)) return null;
  if (now - entry.watchedAt > RECENT_MAX_AGE_MS || entry.watchedAt > now + 60_000) return null;
  const text = (field: unknown, max: number) => (typeof field === 'string' ? field.slice(0, max) : '');
  return {
    id: entry.id,
    title: text(entry.title, 300) || 'YouTube video',
    channelTitle: text(entry.channelTitle, 200),
    ...(typeof entry.thumbnailUrl === 'string' && /^https:\/\/i\d?\.ytimg\.com\/[^\s"'<>]{1,200}$/.test(entry.thumbnailUrl) ? { thumbnailUrl: entry.thumbnailUrl } : {}),
    ...(typeof entry.channelId === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(entry.channelId) ? { channelId: entry.channelId } : {}),
    ...(typeof entry.durationSec === 'number' && Number.isFinite(entry.durationSec) ? { durationSec: entry.durationSec } : {}),
    ...(entry.isLive === true ? { isLive: true } : {}),
    watchedAt: entry.watchedAt,
  };
}

function readStored(userId: number, now: number): StoredVideo[] {
  try {
    window.localStorage.removeItem(LEGACY_KEY);
    const parsed: unknown = JSON.parse(window.localStorage.getItem(recentVideosKey(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.flatMap((value) => sanitize(value, now) ?? []).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function toChoice({ watchedAt: _watchedAt, ...video }: StoredVideo): YouTubeVideoChoice {
  return video;
}

/** Videos this account watched on this device in the last 30 days, newest first. */
export function readRecentVideos(userId: number, now = Date.now()): YouTubeVideoChoice[] {
  return readStored(userId, now).map(toChoice);
}

export function rememberRecentVideo(userId: number, video: YouTubeVideoChoice, now = Date.now()): YouTubeVideoChoice[] {
  const { startSec: _startSec, ...rest } = video;
  const entry = sanitize({ ...rest, watchedAt: now }, now);
  if (!entry) return readRecentVideos(userId, now);
  const next = [entry, ...readStored(userId, now).filter((recent) => recent.id !== entry.id)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(recentVideosKey(userId), JSON.stringify(next));
  } catch {
    // Recently watched is a convenience on this device only.
  }
  return next.map(toChoice);
}

export function clearRecentVideos(userId: number): void {
  try {
    window.localStorage.removeItem(recentVideosKey(userId));
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Nothing stored.
  }
}

export function thumbnailForVideo(video: Pick<YouTubeVideoChoice, 'id' | 'thumbnailUrl'>): string {
  return video.thumbnailUrl ?? `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
}
