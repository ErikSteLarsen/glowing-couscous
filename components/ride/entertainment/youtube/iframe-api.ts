/** The parts of YouTube's IFrame Player API that the ride screen uses. */
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
  /** The API or the player didn't load (blocked or offline), so Wattonaut can't control it. */
  onUnavailable: () => void;
};

type YouTubeNamespace = {
  Player: new (element: HTMLIFrameElement, options: {
    events: {
      onReady: (event: { target: YouTubePlayer }) => void;
      onError: (event: { data: number }) => void;
    };
  }) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace & { loaded?: number };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const PLAYER_STATE = { unstarted: -1, ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 } as const;

const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
const API_URL = 'https://www.youtube.com/iframe_api';
const READY_TIMEOUT_MS = 15_000;
let apiPromise: Promise<YouTubeNamespace> | null = null;

/** Loads the IFrame Player API once per page; a failed load can be tried again. */
function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player && window.YT.loaded) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YouTubeNamespace>((resolve, reject) => {
    const script = document.createElement('script');
    window.onYouTubeIframeAPIReady = () => {
      if (window.YT?.Player) resolve(window.YT);
    };
    script.onerror = () => {
      apiPromise = null;
      script.remove();
      reject(new Error('YouTube player API failed to load'));
    };
    script.src = API_URL;
    script.async = true;
    document.head.append(script);
  });
  return apiPromise;
}

/**
 * Controls the player in `iframe` (already in the page) with YouTube's IFrame Player API. Browsers
 * only: in the Wattonaut Ride app its script would run next to the recording bridge.
 */
export function connectYouTubePlayer(iframe: HTMLIFrameElement, events: YouTubePlayerEvents): { destroy(): void } {
  let cancelled = false;
  let player: YouTubePlayer | null = null;
  const unavailable = () => {
    if (cancelled) return;
    window.clearTimeout(deadline);
    events.onUnavailable();
  };
  const deadline = window.setTimeout(unavailable, READY_TIMEOUT_MS);

  loadYouTubeIframeApi().then((YT) => {
    if (cancelled) return;
    player = new YT.Player(iframe, {
      events: {
        onReady: ({ target }) => {
          if (cancelled) return;
          window.clearTimeout(deadline);
          events.onReady(target);
        },
        onError: ({ data }) => {
          if (cancelled) return;
          window.clearTimeout(deadline);
          events.onError(data);
        },
      },
    });
  }).catch(unavailable);

  return {
    destroy: () => {
      cancelled = true;
      window.clearTimeout(deadline);
      player?.destroy();
    },
  };
}

/** The privacy-enhanced embed URL. `origin` is the page that controls the player; without it, only YouTube's own controls do. */
export function youTubeEmbedUrl(videoId: string, { startSec, origin }: { startSec?: number; origin?: string }): string {
  const url = new URL(`${YOUTUBE_EMBED_ORIGIN}/embed/${videoId}`);
  const params: Record<string, string> = {
    // Never start by itself: Wattonaut calls playVideo() only when the ride and the page allow it.
    autoplay: '0',
    controls: '1',
    playsinline: '1',
    rel: '0',
    // YouTube's own full screen would hide the ride stats; Wattonaut's F full screen keeps them.
    fs: '0',
  };
  if (origin) Object.assign(params, { enablejsapi: '1', origin });
  if (startSec) params.start = String(startSec);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.href;
}
