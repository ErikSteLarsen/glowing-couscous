/**
 * Bringing a YouTube video from the rider's own browser into an open ride tab.
 *
 * The "Send to Tempo" bookmark runs on a YouTube video page: it opens a small Tempo window at
 * `SEND_PATH` with the page URL, the player's position and this browser's send key, then pauses
 * the video. That window hands the video to one ride tab over a BroadcastChannel in two steps:
 * it offers the send, every open ride tab answers that it is available, and the window addresses
 * the video to the first tab that answered, which plays it and acks. No server round trip, no
 * extension, no access to the YouTube page beyond the click.
 *
 * The send key is a random value kept in this browser's localStorage and baked into the bookmark.
 * The send window plays a video by itself only when its `k` matches the key, so another site that
 * opens the send window can at most show the rider a "Send to ride" button.
 */

import { isYouTubeVideoId } from './youtube-url.ts';

export const SEND_PATH = '/athlete/ride/send';
export const RIDE_YOUTUBE_CHANNEL = 'tempo-ride-youtube';
export const SEND_KEY_STORAGE = 'tempo.ride.sendKey';
/** How long the send window waits for a ride tab to take the video. */
export const ACK_TIMEOUT_MS = 1500;
const MAX_START_SEC = 24 * 60 * 60;
const SEND_KEY = /^[A-Za-z0-9-]{8,64}$/;
const MESSAGE_ID = /^[\w-]{1,100}$/;

/** The send window asks which ride tabs could take a video. */
export type RideOfferMessage = { type: 'offer'; id: string };
/** A ride tab answers an offer. */
export type RideAvailableMessage = { type: 'available'; id: string; tabId: string };
/** The send window hands the video to one ride tab. */
export type RidePlayMessage = { type: 'play'; id: string; tabId: string; videoId: string; startSec: number };
/** That tab took it. */
export type RideAckMessage = { type: 'ack'; id: string; tabId: string };

export function isSendKey(value: unknown): value is string {
  return typeof value === 'string' && SEND_KEY.test(value);
}

/** This browser's send key, created on first use. Null without storage (sends then always ask). */
export function readSendKey(): string | null {
  try {
    const value = window.localStorage.getItem(SEND_KEY_STORAGE);
    return isSendKey(value) ? value : null;
  } catch {
    return null;
  }
}

/** A random id; `crypto.randomUUID` is missing outside secure contexts (plain-HTTP installs). */
function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The send key from a send window's URL fragment (`#k=…`), if it has a valid one. */
export function sendKeyFromHash(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('k');
  return value && isSendKey(value) ? value : null;
}

export function getOrCreateSendKey(): string {
  const existing = readSendKey();
  if (existing) return existing;
  const key = randomId();
  try {
    window.localStorage.setItem(SEND_KEY_STORAGE, key);
  } catch {
    // Without storage the bookmark still works; every send asks for a click.
  }
  return key;
}

/**
 * The bookmark's `javascript:` URL for this Tempo origin and send key. Kept to plain ES5 so it runs
 * from any bookmarks bar. Outside a YouTube video page it only says so. It opens the send window
 * first and pauses YouTube only if that window opened. The position comes from the playing (else
 * the largest visible) video, as whole seconds, 0 included; a live stream sends none.
 */
export function sendToTempoBookmarklet(origin: string, key: string): string {
  const target = JSON.stringify(`${origin.replace(/\/+$/, '')}${SEND_PATH}?u=`);
  // The key rides in the fragment, so it never reaches a server log or a sign-in callback URL.
  const fragment = JSON.stringify(`#k=${encodeURIComponent(key)}`);
  const body = [
    '(function(){',
    'var l=window.location,u=l.href;',
    "if(!/(^|\\.)(youtube\\.com|youtu\\.be)$/.test(l.hostname)||!/[?&]v=[\\w-]{11}|\\/(shorts|live|embed)\\/[\\w-]{11}|youtu\\.be\\/[\\w-]{11}/.test(u)){window.alert('Open a YouTube video first');return}",
    "var s=document.querySelectorAll('#movie_player video, ytd-shorts video[src], video'),v=null,b=-1,i,r,a;",
    'for(i=0;i<s.length;i++){r=s[i].getBoundingClientRect();a=Math.max(0,Math.min(r.right,window.innerWidth)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,window.innerHeight)-Math.max(r.top,0))+(s[i].paused?0:1e9);if(a>b){b=a;v=s[i]}}',
    "var t=!v||document.querySelector('.ytp-live')||v.duration===Infinity?'':'&t='+(Math.floor(v.currentTime)||0);",
    `var w=window.open(${target}+encodeURIComponent(u)+t+${fragment},'tempo-send','popup,width=420,height=260');`,
    "if(!w){window.alert('Allow pop-ups for YouTube to send videos to Tempo.');return}",
    'if(v)try{v.pause()}catch(e){}',
    '})()',
  ].join('');
  return `javascript:${encodeURIComponent(body)}`;
}

/** Opens the Tempo Ride app, which hands the video to its ride. */
export function rideAppVideoLink(videoId: string, startSec: number): string {
  return `tempo-ride://video?v=${videoId}${startSec > 0 ? `&t=${startSec}` : ''}`;
}

/** Reads the `t` the bookmark sends: whole seconds (0 included), or undefined. */
export function parseSentStart(value: string | null | undefined): number | undefined {
  if (!value || !/^\d{1,6}$/.test(value)) return undefined;
  const seconds = Number(value);
  return seconds <= MAX_START_SEC ? seconds : undefined;
}

function record(data: unknown, type: string): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const message = data as Record<string, unknown>;
  return message.type === type && typeof message.id === 'string' && MESSAGE_ID.test(message.id) ? message : null;
}

const isTabId = (value: unknown): value is string => typeof value === 'string' && MESSAGE_ID.test(value);

export function readOfferMessage(data: unknown): RideOfferMessage | null {
  const message = record(data, 'offer');
  return message ? { type: 'offer', id: message.id as string } : null;
}

export function readAvailableMessage(data: unknown): RideAvailableMessage | null {
  const message = record(data, 'available');
  return message && isTabId(message.tabId) ? { type: 'available', id: message.id as string, tabId: message.tabId } : null;
}

export function readAckMessage(data: unknown): RideAckMessage | null {
  const message = record(data, 'ack');
  return message && isTabId(message.tabId) ? { type: 'ack', id: message.id as string, tabId: message.tabId } : null;
}

export function readPlayMessage(data: unknown): RidePlayMessage | null {
  const message = record(data, 'play');
  if (!message || !isTabId(message.tabId)) return null;
  if (typeof message.videoId !== 'string' || !isYouTubeVideoId(message.videoId)) return null;
  const startSec = typeof message.startSec === 'number' && Number.isFinite(message.startSec)
    ? Math.min(Math.max(0, Math.floor(message.startSec)), MAX_START_SEC)
    : 0;
  return { type: 'play', id: message.id as string, tabId: message.tabId, videoId: message.videoId, startSec };
}

/**
 * Offers a video to the open ride tabs, hands it to the first one that answers and resolves true
 * once that tab acks, or false when none does within the timeout.
 */
export function sendVideoToRide(
  video: { id: string; videoId: string; startSec: number },
  timeoutMs = ACK_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(RIDE_YOUTUBE_CHANNEL);
    let chosen: string | null = null;
    const finish = (acked: boolean) => {
      clearTimeout(timer);
      channel.close();
      resolve(acked);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    channel.onmessage = (event: MessageEvent) => {
      const available = readAvailableMessage(event.data);
      if (available && available.id === video.id && chosen === null) {
        chosen = available.tabId;
        const play: RidePlayMessage = { type: 'play', id: video.id, tabId: chosen, videoId: video.videoId, startSec: video.startSec };
        channel.postMessage(play);
        return;
      }
      const ack = readAckMessage(event.data);
      if (ack && ack.id === video.id && ack.tabId === chosen) finish(true);
    };
    const offer: RideOfferMessage = { type: 'offer', id: video.id };
    channel.postMessage(offer);
  });
}

/**
 * Listens for sent videos in a ride tab: answers every offer, and plays and acks a video only when
 * it is addressed to this tab. A play repeated with the same id (a send window remounting) is
 * acked again but played only once.
 */
export function listenForSentVideos(
  onPlay: (video: { videoId: string; startSec: number }) => void,
  tabId: string = randomId(),
): () => void {
  const channel = new BroadcastChannel(RIDE_YOUTUBE_CHANNEL);
  const seen = new Set<string>();
  channel.onmessage = (event: MessageEvent) => {
    const offer = readOfferMessage(event.data);
    if (offer) {
      const available: RideAvailableMessage = { type: 'available', id: offer.id, tabId };
      channel.postMessage(available);
      return;
    }
    const message = readPlayMessage(event.data);
    if (!message || message.tabId !== tabId) return;
    const ack: RideAckMessage = { type: 'ack', id: message.id, tabId };
    channel.postMessage(ack);
    if (seen.has(message.id)) return;
    seen.add(message.id);
    onPlay({ videoId: message.videoId, startSec: message.startSec });
  };
  return () => channel.close();
}
