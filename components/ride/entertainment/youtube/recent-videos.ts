import { isYouTubeVideoId } from '@/lib/youtube/youtube-url';
import type { YouTubeVideoChoice } from './youtube-client';

const STORAGE_KEY = 'tempo-ride-youtube-recent';
const MAX_RECENT = 12;

function sanitize(value: unknown): YouTubeVideoChoice | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== 'string' || !isYouTubeVideoId(entry.id)) return null;
  const text = (field: unknown, max: number) => (typeof field === 'string' ? field.slice(0, max) : '');
  return {
    id: entry.id,
    title: text(entry.title, 300) || 'YouTube video',
    channelTitle: text(entry.channelTitle, 200),
    ...(typeof entry.thumbnailUrl === 'string' && /^https:\/\/i\d?\.ytimg\.com\/[^\s"'<>]{1,200}$/.test(entry.thumbnailUrl) ? { thumbnailUrl: entry.thumbnailUrl } : {}),
    ...(typeof entry.channelId === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(entry.channelId) ? { channelId: entry.channelId } : {}),
    ...(typeof entry.durationSec === 'number' && Number.isFinite(entry.durationSec) ? { durationSec: entry.durationSec } : {}),
    ...(entry.isLive === true ? { isLive: true } : {}),
  };
}

/** Videos watched on this device, newest first. */
export function readRecentVideos(): YouTubeVideoChoice[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.flatMap((value) => sanitize(value) ?? []).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function rememberRecentVideo(video: YouTubeVideoChoice): YouTubeVideoChoice[] {
  const entry = sanitize(video);
  if (!entry) return readRecentVideos();
  const next = [entry, ...readRecentVideos().filter((recent) => recent.id !== entry.id)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Recently watched is a convenience on this device only.
  }
  return next;
}

export function thumbnailForVideo(video: Pick<YouTubeVideoChoice, 'id' | 'thumbnailUrl'>): string {
  return video.thumbnailUrl ?? `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
}
