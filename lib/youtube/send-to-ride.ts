/**
 * Bringing a YouTube video from the rider's own browser into an open ride tab.
 *
 * The "Send to Tempo" bookmark runs on a YouTube video page: it reads the page URL and the
 * player's position, pauses the video and opens a small Tempo window at `SEND_PATH`. That window
 * posts a `play` message on a BroadcastChannel; an open ride tab in the same browser acks it and
 * plays the video. No server round trip, no extension, no access to the YouTube page beyond the click.
 */

import { isYouTubeVideoId } from './youtube-url.ts';

export const SEND_PATH = '/athlete/ride/send';
export const RIDE_YOUTUBE_CHANNEL = 'tempo-ride-youtube';
/** How long the send window waits for a ride tab to answer. */
export const ACK_TIMEOUT_MS = 1500;
const MAX_START_SEC = 24 * 60 * 60;

export type RidePlayMessage = { type: 'play'; id: string; videoId: string; startSec: number };
export type RideAckMessage = { type: 'ack'; id: string };

/**
 * The bookmark's `javascript:` URL for this Tempo origin. Kept to plain ES5 so it runs from any
 * bookmarks bar. Outside a YouTube video page it only says so.
 */
export function sendToTempoBookmarklet(origin: string): string {
  const target = JSON.stringify(`${origin.replace(/\/+$/, '')}${SEND_PATH}`);
  const body = [
    '(function(){',
    'var l=window.location,u=l.href;',
    "if(!/(^|\\.)(youtube\\.com|youtu\\.be)$/.test(l.hostname)||!/[?&]v=[\\w-]{11}|\\/(shorts|live|embed)\\/[\\w-]{11}|youtu\\.be\\/[\\w-]{11}/.test(u)){window.alert('Open a YouTube video first');return}",
    "var v=document.querySelector('#movie_player video')||document.querySelector('video'),t=0;",
    'if(v){t=Math.floor(v.currentTime)||0;try{v.pause()}catch(e){}}',
    `window.open(${target}+'?u='+encodeURIComponent(u)+'&t='+t,'tempo-send','popup,width=420,height=260')`,
    '})()',
  ].join('');
  return `javascript:${encodeURIComponent(body)}`;
}

/** Reads the `t` the bookmark sends: whole seconds, or undefined. */
export function parseSentStart(value: string | null | undefined): number | undefined {
  if (!value || !/^\d{1,6}$/.test(value)) return undefined;
  const seconds = Number(value);
  return seconds > 0 && seconds <= MAX_START_SEC ? seconds : undefined;
}

export function readPlayMessage(data: unknown): RidePlayMessage | null {
  if (!data || typeof data !== 'object') return null;
  const message = data as Record<string, unknown>;
  if (message.type !== 'play' || typeof message.id !== 'string' || message.id.length === 0 || message.id.length > 100) return null;
  if (typeof message.videoId !== 'string' || !isYouTubeVideoId(message.videoId)) return null;
  const startSec = typeof message.startSec === 'number' && Number.isFinite(message.startSec)
    ? Math.min(Math.max(0, Math.floor(message.startSec)), MAX_START_SEC)
    : 0;
  return { type: 'play', id: message.id, videoId: message.videoId, startSec };
}

/** Posts a video to any open ride tab and resolves true once one answers within the timeout. */
export function sendVideoToRide(
  video: { id: string; videoId: string; startSec: number },
  timeoutMs = ACK_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(RIDE_YOUTUBE_CHANNEL);
    const finish = (acked: boolean) => {
      clearTimeout(timer);
      channel.close();
      resolve(acked);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as Partial<RideAckMessage> | null;
      if (data?.type === 'ack' && data.id === video.id) finish(true);
    };
    const message: RidePlayMessage = { type: 'play', ...video };
    channel.postMessage(message);
  });
}

/**
 * Listens for sent videos in a ride tab: acks each message once and hands it on. A message
 * repeated with the same id (a send window remounting) is acked again but played only once.
 */
export function listenForSentVideos(onPlay: (video: { videoId: string; startSec: number }) => void): () => void {
  const channel = new BroadcastChannel(RIDE_YOUTUBE_CHANNEL);
  const seen = new Set<string>();
  channel.onmessage = (event: MessageEvent) => {
    const message = readPlayMessage(event.data);
    if (!message) return;
    const ack: RideAckMessage = { type: 'ack', id: message.id };
    channel.postMessage(ack);
    if (seen.has(message.id)) return;
    seen.add(message.id);
    onPlay({ videoId: message.videoId, startSec: message.startSec });
  };
  return () => channel.close();
}
