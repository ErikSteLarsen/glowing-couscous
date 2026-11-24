/** The parts of YouTube's IFrame Player API that the ride screen uses. */
export type YouTubePlayer = {
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  destroy(): void;
};

export type YouTubePlayerEvents = {
  onReady?: (event: { target: YouTubePlayer }) => void;
  onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
  onError?: (event: { data: number; target: YouTubePlayer }) => void;
  onAutoplayBlocked?: (event: { target: YouTubePlayer }) => void;
};

type YouTubeNamespace = {
  Player: new (element: HTMLIFrameElement, options: { events: YouTubePlayerEvents }) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace & { loaded?: number };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const PLAYER_STATE = { unstarted: -1, ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 } as const;

const API_URL = 'https://www.youtube.com/iframe_api';
let apiPromise: Promise<YouTubeNamespace> | null = null;

/** Loads the IFrame Player API once per page; later calls share the same promise. */
export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player && window.YT.loaded) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YouTubeNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube player API missing'));
    };
    const script = document.createElement('script');
    script.src = API_URL;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      script.remove();
      reject(new Error('YouTube player API failed to load'));
    };
    document.head.append(script);
  });
  return apiPromise;
}

/** The privacy-enhanced embed URL with the player parameters the research settled on. */
export function youTubeEmbedUrl(videoId: string, { startSec, origin }: { startSec?: number; origin: string }): string {
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  const params: Record<string, string> = {
    enablejsapi: '1',
    origin,
    // The rider chose this video with a click, so ask to start right away; the native Play button is the fallback.
    autoplay: '1',
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
