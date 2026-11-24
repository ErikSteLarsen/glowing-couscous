import { isYouTubeVideoId } from '../../../../lib/youtube/youtube-url.ts';
import type { BrowseRoute } from './YouTubeBrowse';
import type { YouTubeVideoChoice } from './youtube-client';

/**
 * Where the rider was in the YouTube view, kept for this tab so the view survives a remount
 * (the ride screen swaps its phone and desktop layouts when the window crosses 640 px).
 */
export type SavedYouTubeView = {
  route: BrowseRoute;
  query: string;
  scrollTop: number;
  /** The video being watched, or null while browsing. */
  video: YouTubeVideoChoice | null;
  /** Seconds into `video`. */
  timeSec: number;
  /** The video was playing, or Tempo had paused it (ride paused, dialog open). */
  playing: boolean;
};

export const youTubeViewKey = (sessionId: number) => `tempo.ride.youtube.view.${sessionId}`;

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
const seconds = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(value, 1e6) : 0);

function readRoute(value: unknown): BrowseRoute {
  const route = (value ?? {}) as Record<string, unknown>;
  if (route.kind === 'search' && typeof route.query === 'string' && route.query.trim()) return { kind: 'search', query: route.query.slice(0, 100) };
  if (route.kind === 'channel' && typeof route.channelId === 'string' && CHANNEL_ID.test(route.channelId)) {
    return { kind: 'channel', channelId: route.channelId, channelTitle: text(route.channelTitle, 200) };
  }
  return { kind: 'home' };
}

function readVideo(value: unknown): YouTubeVideoChoice | null {
  const video = value as Record<string, unknown> | null;
  if (!video || typeof video !== 'object' || typeof video.id !== 'string' || !isYouTubeVideoId(video.id)) return null;
  return {
    id: video.id,
    title: text(video.title, 300) || 'YouTube video',
    channelTitle: text(video.channelTitle, 200),
    ...(typeof video.channelId === 'string' && CHANNEL_ID.test(video.channelId) ? { channelId: video.channelId } : {}),
    ...(video.isLive === true ? { isLive: true } : {}),
  };
}

export function readYouTubeView(sessionId: number): SavedYouTubeView | null {
  try {
    const raw = window.sessionStorage.getItem(youTubeViewKey(sessionId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    return {
      route: readRoute(saved.route),
      query: text(saved.query, 2048),
      scrollTop: seconds(saved.scrollTop),
      video: readVideo(saved.video),
      timeSec: seconds(saved.timeSec),
      playing: saved.playing === true,
    };
  } catch {
    return null;
  }
}

export function saveYouTubeView(sessionId: number, view: SavedYouTubeView): void {
  try {
    window.sessionStorage.setItem(youTubeViewKey(sessionId), JSON.stringify({ ...view, scrollTop: Math.round(view.scrollTop), timeSec: Math.floor(view.timeSec) }));
  } catch {
    // Best effort: without storage the view starts over after a layout change.
  }
}
