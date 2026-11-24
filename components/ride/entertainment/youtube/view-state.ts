import { isYouTubeVideoId } from '../../../../lib/youtube/youtube-url.ts';
import type { YouTubeVideoChoice } from './youtube-client';

/**
 * What the YouTube view was playing, kept for this tab so the view survives a remount (turning
 * entertainment off and on, switching to the course and back, window resizes).
 */
export type SavedYouTubeView = {
  /** The video being watched, or null while picking one. */
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
    window.sessionStorage.setItem(youTubeViewKey(sessionId), JSON.stringify({ ...view, timeSec: Math.floor(view.timeSec) }));
  } catch {
    // Best effort: without storage the view starts over after a remount.
  }
}
