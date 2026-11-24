/** The embedded player, driven by messages to its frame. */
export type YouTubePlayer = {
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  destroy(): void;
};

export type YouTubePlayerEvents = {
  onReady: (player: YouTubePlayer) => void;
  onError: (code: number) => void;
  /** The player never answered (blocked or offline), so Tempo can't control it. */
  onUnavailable: () => void;
};

export const PLAYER_STATE = { unstarted: -1, ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 } as const;

export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
const HELLO_MS = 250;
const READY_TIMEOUT_MS = 15_000;

export type PlayerMessage = { ready?: true; error?: number; state?: number; time?: number };

/** Reads what Tempo uses from a message the player frame posted, or null. */
export function readPlayerMessage(data: unknown): PlayerMessage | null {
  if (typeof data !== 'string') return null;
  let message: unknown;
  try { message = JSON.parse(data); } catch { return null; }
  if (!message || typeof message !== 'object') return null;
  const { event, info } = message as { event?: unknown; info?: unknown };
  if (event === 'onReady') return { ready: true };
  if (event === 'onError') return typeof info === 'number' ? { error: info } : null;
  if (event === 'onStateChange') return typeof info === 'number' ? { state: info } : null;
  if ((event !== 'initialDelivery' && event !== 'infoDelivery') || !info || typeof info !== 'object') return null;
  const { playerState, currentTime } = info as { playerState?: unknown; currentTime?: unknown };
  return {
    ...(typeof playerState === 'number' ? { state: playerState } : {}),
    ...(typeof currentTime === 'number' && Number.isFinite(currentTime) ? { time: currentTime } : {}),
  };
}

/**
 * Controls the player in `iframe` with the messages YouTube's IFrame API script would send. That
 * script is not loaded: it would run as Tempo, next to the desktop app's recording bridge.
 */
export function connectYouTubePlayer(iframe: HTMLIFrameElement, events: YouTubePlayerEvents): YouTubePlayer {
  let state: number = PLAYER_STATE.unstarted;
  let time = 0;
  let ready = false;

  const post = (message: Record<string, unknown>) => {
    iframe.contentWindow?.postMessage(JSON.stringify({ ...message, id: 1, channel: 'widget' }), YOUTUBE_EMBED_ORIGIN);
  };
  const command = (func: string, args: unknown[] = []) => post({ event: 'command', func, args });
  const stopWaiting = () => {
    window.clearInterval(hello);
    window.clearTimeout(deadline);
  };
  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow || event.origin !== YOUTUBE_EMBED_ORIGIN) return;
    const message = readPlayerMessage(event.data);
    if (!message) return;
    if (message.state !== undefined) state = message.state;
    if (message.time !== undefined) time = message.time;
    if (message.error !== undefined) {
      stopWaiting();
      events.onError(message.error);
    } else if (message.ready && !ready) {
      ready = true;
      stopWaiting();
      events.onReady(player);
    }
  };
  // The frame answers only once its own code runs, so say hello until it does. Until the document
  // is YouTube's, the browser drops the message (and logs it), so wait for the frame to load.
  let hello: number | undefined;
  const onLoad = () => {
    window.clearInterval(hello);
    if (ready) return;
    const greet = () => {
      post({ event: 'listening' });
      command('addEventListener', ['onReady']);
      command('addEventListener', ['onError']);
      command('addEventListener', ['onStateChange']);
    };
    greet();
    hello = window.setInterval(greet, HELLO_MS);
  };
  const deadline = window.setTimeout(() => {
    stopWaiting();
    events.onUnavailable();
  }, READY_TIMEOUT_MS);

  const player: YouTubePlayer = {
    playVideo: () => command('playVideo'),
    pauseVideo: () => command('pauseVideo'),
    getPlayerState: () => state,
    getCurrentTime: () => time,
    destroy: () => {
      stopWaiting();
      window.removeEventListener('message', onMessage);
      iframe.removeEventListener('load', onLoad);
    },
  };
  window.addEventListener('message', onMessage);
  iframe.addEventListener('load', onLoad);
  return player;
}

/** The privacy-enhanced embed URL with the player parameters the research settled on. */
export function youTubeEmbedUrl(videoId: string, { startSec, origin }: { startSec?: number; origin: string }): string {
  const url = new URL(`${YOUTUBE_EMBED_ORIGIN}/embed/${videoId}`);
  const params: Record<string, string> = {
    enablejsapi: '1',
    origin,
    // Never start by itself: Tempo calls playVideo() only when the ride and the page allow it.
    autoplay: '0',
    controls: '1',
    playsinline: '1',
    rel: '0',
    // YouTube's own full screen would hide the ride stats; Tempo's F full screen keeps them.
    fs: '0',
  };
  if (startSec) params.start = String(startSec);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.href;
}
