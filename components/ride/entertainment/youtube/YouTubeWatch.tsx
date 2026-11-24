'use client';

import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { buttonFocusClassName, compactSecondaryButtonClassName, ghostButtonClassName } from '@/components/ui';
import { youTubeWatchUrl } from '@/lib/youtube/youtube-url';
import { loadYouTubeIframeApi, PLAYER_STATE, youTubeEmbedUrl, type YouTubePlayer } from './iframe-api';
import type { YouTubeVideoChoice } from './youtube-client';

const PAUSE_WITH_RIDE_KEY = 'tempo-ride-youtube-pause-with-ride';
/** A Tab press this recent means the rider moved into the player with the keyboard on purpose. */
const TAB_INTENT_MS = 800;

function readPauseWithRide(): boolean {
  try {
    return window.localStorage.getItem(PAUSE_WITH_RIDE_KEY) !== '0';
  } catch {
    return true;
  }
}

/** What the rider sees for each IFrame API error code. */
export function playerErrorMessage(code: number): string {
  if (code === 101 || code === 150) return 'This video can’t be played inside other apps.';
  if (code === 100) return 'This video is private or was removed.';
  if (code === 2) return 'This video link doesn’t work. Check the link and try again.';
  if (code === 153) return 'YouTube could not confirm where this video is playing. Reload the page and try again.';
  return 'This video stopped playing. Try again, or open it on YouTube.';
}

function isPlaying(player: YouTubePlayer): boolean {
  try {
    const state = player.getPlayerState();
    return state === PLAYER_STATE.playing || state === PLAYER_STATE.buffering;
  } catch {
    return false;
  }
}

/**
 * The watch view: a slim bar and the privacy-enhanced YouTube player, contained at 16:9.
 * Nothing is drawn over the player. Pauses with the ride, when hidden and when scrolled away.
 */
export function YouTubeWatch({
  video,
  rideStatus,
  onBack,
}: {
  video: YouTubeVideoChoice;
  rideStatus: 'running' | 'paused';
  onBack: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameBoxRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const pausedByRideRef = useRef(false);
  const [pauseWithRide, setPauseWithRide] = useState(readPauseWithRide);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Keep keyboard focus on the panel (not a button) so Space still pauses the ride.
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  // Create the iframe and attach the IFrame API; destroy both when leaving or switching videos.
  useEffect(() => {
    const box = frameBoxRef.current;
    if (!box || errorCode !== null) return;
    const iframe = document.createElement('iframe');
    iframe.src = youTubeEmbedUrl(video.id, { startSec: video.startSec, origin: window.location.origin });
    iframe.title = `YouTube video player: ${video.title}`;
    iframe.allow = 'autoplay; encrypted-media';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.className = 'absolute inset-0 h-full w-full border-0';
    iframe.dataset.youtubePlayer = 'true';
    box.append(iframe);

    let cancelled = false;
    let player: YouTubePlayer | null = null;
    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(iframe, {
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              playerRef.current = target;
              // The rider's click chose this video: ask for playback now. If the browser blocks
              // it, YouTube's own Play button stays available and Tempo does not retry.
              try { target.playVideo(); } catch { /* the native Play button remains */ }
            },
            onError: ({ data }) => {
              if (!cancelled) setErrorCode(data);
            },
          },
        });
      })
      .catch(() => {
        // Without the API the player still works with its own controls; only ride sync is lost.
      });

    return () => {
      cancelled = true;
      playerRef.current = null;
      pausedByRideRef.current = false;
      try { player?.destroy(); } catch { /* already gone */ }
      iframe.remove();
    };
  }, [video.id, video.startSec, video.title, errorCode, attempt]);

  // Pause with the ride, and play again on resume only if Tempo paused it.
  const lastStatusRef = useRef(rideStatus);
  useEffect(() => {
    const previous = lastStatusRef.current;
    lastStatusRef.current = rideStatus;
    const player = playerRef.current;
    if (previous === 'running' && rideStatus === 'paused') {
      if (pauseWithRide && player && isPlaying(player)) {
        try { player.pauseVideo(); pausedByRideRef.current = true; } catch { /* player gone */ }
      }
    } else if (previous === 'paused' && rideStatus === 'running') {
      if (pausedByRideRef.current && player) {
        try { player.playVideo(); } catch { /* player gone */ }
      }
      pausedByRideRef.current = false;
    }
  }, [rideStatus, pauseWithRide]);

  // YouTube policy: pause when the player leaves the screen; the rider presses Play again after.
  useEffect(() => {
    const box = frameBoxRef.current;
    const pauseIfPlaying = () => {
      const player = playerRef.current;
      if (player && isPlaying(player)) {
        try { player.pauseVideo(); } catch { /* player gone */ }
        pausedByRideRef.current = false;
      }
    };
    const onVisibility = () => {
      if (document.hidden) pauseIfPlaying();
    };
    document.addEventListener('visibilitychange', onVisibility);
    let observer: IntersectionObserver | null = null;
    if (box && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry && entry.intersectionRatio < 0.5) pauseIfPlaying();
      }, { threshold: [0.5] });
      observer.observe(box);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, []);

  // A click inside the player moves keyboard focus into YouTube, where the ride's Space/N/B/E/F
  // shortcuts can't reach. Return focus to the panel after a click; keep it there after a Tab.
  useEffect(() => {
    let lastTabAt = Number.NEGATIVE_INFINITY;
    let timer: number | undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') lastTabAt = performance.now();
    };
    const onBlur = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLIFrameElement) || !frameBoxRef.current?.contains(active)) return;
        if (performance.now() - lastTabAt < TAB_INTENT_MS || document.visibilityState !== 'visible') return;
        rootRef.current?.focus({ preventScroll: true });
      }, 0);
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  function togglePauseWithRide() {
    const next = !pauseWithRide;
    setPauseWithRide(next);
    if (!next) pausedByRideRef.current = false;
    try { window.localStorage.setItem(PAUSE_WITH_RIDE_KEY, next ? '1' : '0'); } catch { /* preference only */ }
  }

  const watchUrl = youTubeWatchUrl(video.id, video.startSec);

  return (
    <div ref={rootRef} tabIndex={-1} className="flex h-full w-full min-w-0 flex-col outline-none">
      <div className="@container flex min-h-11 shrink-0 items-center gap-2 pb-2">
        <button type="button" className={`${ghostButtonClassName('compact')} shrink-0 text-[var(--text-secondary)]`} onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.6} />
          Browse
        </button>
        <p className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)]" title={video.channelTitle ? `${video.title} – ${video.channelTitle}` : video.title}>
          <span className="font-medium text-[var(--text)]">{video.title}</span>
          {video.channelTitle ? <span className="hidden @md:inline"> – {video.channelTitle}</span> : null}
        </p>
        <button
          type="button"
          aria-pressed={pauseWithRide}
          onClick={togglePauseWithRide}
          title="Pause the video when you pause the ride"
          className={`inline-flex min-h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-[13px] font-medium transition-colors ${buttonFocusClassName} ${pauseWithRide ? 'border-[var(--brand)] text-[var(--text)]' : 'border-[var(--border-strong)] text-[var(--text-secondary)] control-hover:bg-[var(--raised)] control-hover:text-[var(--text)]'}`}
        >
          <span aria-hidden="true" className={`size-2 rounded-full ${pauseWithRide ? 'bg-[var(--brand)]' : 'bg-[var(--border-strong)]'}`} />
          Pause with ride
        </button>
      </div>

      <div className="relative grid min-h-0 flex-1 content-start justify-items-center [container-type:size]">
        {errorCode === null ? (
          <div
            ref={frameBoxRef}
            className="relative aspect-video w-[min(100cqw,calc(100cqh*16/9))] overflow-hidden rounded-lg bg-black"
          />
        ) : (
          <div role="alert" className="flex max-w-sm flex-col items-center gap-3 px-4 text-center">
            <p className="text-sm text-[var(--text)]">{playerErrorMessage(errorCode)}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <a href={watchUrl} target="_blank" rel="noopener noreferrer" className={compactSecondaryButtonClassName}>
                <ExternalLink aria-hidden="true" size={14} strokeWidth={1.6} />
                Open on YouTube
              </a>
              {errorCode === 5 || errorCode === 153 ? (
                <button type="button" className={compactSecondaryButtonClassName} onClick={() => { setErrorCode(null); setAttempt((value) => value + 1); }}>
                  Try again
                </button>
              ) : null}
              <button type="button" className={compactSecondaryButtonClassName} onClick={onBack}>
                Back to browse
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
