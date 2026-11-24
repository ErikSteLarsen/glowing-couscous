/** A YouTube video the ride screen can play, read from a link. */
export type YouTubeLink = {
  videoId: string;
  /** Seconds into the video to start from, when the link carries `t=` or `start=`. */
  startSec?: number;
};

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
/** Path prefixes that carry the video ID as the next segment. */
const ID_PATHS = new Set(['shorts', 'live', 'embed', 'v', 'e']);
const MAX_START_SEC = 24 * 60 * 60;

export function isYouTubeVideoId(value: string): boolean {
  return VIDEO_ID.test(value);
}

/** Reads `90`, `90s`, `1m30s`, `1h2m3s` or `01:30` as seconds. */
export function parseYouTubeTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const text = value.trim().toLowerCase();
  let seconds: number | undefined;
  if (/^\d+$/.test(text)) {
    seconds = Number(text);
  } else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(text)) {
    seconds = text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  } else {
    const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
    if (match && (match[1] || match[2] || match[3])) {
      seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
    }
  }
  if (seconds === undefined || !Number.isSafeInteger(seconds) || seconds <= 0 || seconds > MAX_START_SEC) return undefined;
  return seconds;
}

function toUrl(input: string): URL | null {
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  const url = URL.parse(withProtocol);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return null;
  return url;
}

function videoIdFromPath(url: URL, host: string): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  if (SHORT_HOSTS.has(host)) return segments[0] ?? null;
  if (segments[0] === 'watch') return url.searchParams.get('v');
  if (segments.length >= 2 && ID_PATHS.has(segments[0])) return segments[1];
  return null;
}

/**
 * Parses a pasted YouTube link (watch, youtu.be, shorts, live, embed, mobile and music hosts).
 * Returns null for anything else, including playlist-only links and bare words: an 11-character
 * word such as "documentary" is not a video ID.
 */
export function parseYouTubeLink(raw: string): YouTubeLink | null {
  const input = raw.trim();
  if (input === '' || input.length > 2048) return null;

  const url = toUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host) && !SHORT_HOSTS.has(host)) return null;

  const videoId = videoIdFromPath(url, host);
  if (!videoId || !isYouTubeVideoId(videoId)) return null;

  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const startSec = parseYouTubeTimestamp(url.searchParams.get('t') ?? url.searchParams.get('start') ?? hash.get('t'));
  return { videoId, ...(startSec !== undefined ? { startSec } : {}) };
}

/** The youtube.com watch page for a video, for "Open on YouTube" links. */
export function youTubeWatchUrl(videoId: string, startSec?: number): string {
  const url = new URL('https://www.youtube.com/watch');
  url.searchParams.set('v', videoId);
  if (startSec) url.searchParams.set('t', `${startSec}s`);
  return url.href;
}

const THUMBNAIL = /^https?:\/\/i\d?\.ytimg\.com\/(?:vi|vi_webp)\/([A-Za-z0-9_-]{11})\//i;

/**
 * Finds the first YouTube video link in dropped or pasted text: a `text/uri-list` (one URL per
 * line, `#` lines are comments), a link among other words, or a dragged thumbnail's image URL.
 */
export function findYouTubeLink(text: string | null | undefined): YouTubeLink | null {
  if (!text) return null;
  for (const token of text.slice(0, 8192).split(/\s+/)) {
    if (!token || token.startsWith('#')) continue;
    const link = parseYouTubeLink(token);
    if (link) return link;
    const thumbnail = THUMBNAIL.exec(token);
    if (thumbnail) return { videoId: thumbnail[1] };
  }
  return null;
}
