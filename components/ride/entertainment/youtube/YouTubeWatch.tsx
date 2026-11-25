'use client';

import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { buttonFocusClassName, compactSecondaryButtonClassName, ghostButtonClassName } from '@/components/ui';
import { youTubeWatchUrl } from '@/lib/youtube/youtube-url';
import { connectYouTubePlayer, PLAYER_STATE, youTubeEmbedUrl, type YouTubePlayer } from './iframe-api';
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

/** Tempo's own code for a player it couldn't load. */
const PLAYER_UNAVAILABLE = -1;

/** What the rider sees for each IFrame API error code. */
export function playerErrorMessage(code: number): string {
  if (code === 101 || code === 150) return 'This video can’t be played inside other apps.';
  if (code === 100) return 'This video is private or was removed.';
  if (code === 2) return 'This video link doesn’t work. Check the link and try again.';
  if (code === PLAYER_UNAVAILABLE) return 'YouTube’s player didn’t load. Your connection or an ad blocker may be stopping it.';
  if (code === 153) return 'YouTube could not confirm where this video is playing. Reload the page and try again.';
  return 'This video stopped playing. Try again, or open it on YouTube.';
}

function isPlaying(player: YouTubePlayer): boolean {
  const state = player.getPlayerState();
  return state === PLAYER_STATE.playing || state === PLAYER_STATE.buffering;
}

/** The player box is never smaller than this (YouTube's minimum embed size), in CSS px. */
const MIN_PLAYER_PX = 200;
const SAMPLE_MS = 3000;

/**
 * The watch view: a slim bar and the privacy-enhanced YouTube player, contained at 16:9 and never
 * smaller than 200 × 200. Nothing is drawn over the player. Tempo starts playback only while the
 * ride runs (or Pause with ride is off), the tab is visible, the player is at least half on screen
 * and no dialog covers it; it pauses with the ride, under a dialog, when hidden and when scrolled away.
 * In the Tempo Ride app the player is not controlled: the rider uses YouTube's own buttons.
 */
export function YouTubeWatch({
  video,
  rideStatus,
  obscured,
  startPlaying,
  restored = false,
  dragActive = false,
  checking = false,
  onBack,
  onTime,
}: {
  video: YouTubeVideoChoice;
  rideStatus: 'running' | 'paused';
  obscured: boolean;
  /** The rider just chose this video, or it was playing before the view remounted. */
  startPlaying: boolean;
  /** Picked up after a remount: a video Tempo had paused (ride paused, dialog) plays again on resume. */
  restored?: boolean;
  /** A link is being dragged over the ride screen: the player lets it through and the stage is outlined. */
  dragActive?: boolean;
  /** A new video is being checked before it replaces this one. */
  checking?: boolean;
  onBack: () => void;
  /** Reports the playback position (and whether it plays or Tempo paused it) every few seconds and when the player goes away. */
  onTime: (videoId: string, timeSec: number, playing: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameBoxRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  /** Tempo paused the video (ride paused, dialog opened), so Tempo may play it again. */
  const pausedByTempoRef = useRef(false);
  const resumeAtRef = useRef(video.startSec ?? 0);
  const wantsPlayRef = useRef(startPlaying);
  const restoredRef = useRef(restored);
  const [pauseWithRide, setPauseWithRide] = useState(readPauseWithRide);
  // Read here, not from the server: the live ride view never renders there.
  const [controlled] = useState(() => !window.tempoDesktop);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fits, setFits] = useState(true);
  /** Where "Open on YouTube" starts: the position when the player last went away. */
  const [linkStartSec, setLinkStartSec] = useState(video.startSec ?? 0);
  const gateRef = useRef({ rideStatus, pauseWithRide, obscured, inView: false });
  const onTimeRef = useRef(onTime);

  useLayoutEffect(() => {
    Object.assign(gateRef.current, { rideStatus, pauseWithRide, obscured });
    onTimeRef.current = onTime;
  });

  /** Whether Tempo may start the video now. Anything else leaves it to YouTube's own Play button. */
  const mayPlay = useCallback(() => {
    const gate = gateRef.current;
    return (gate.rideStatus === 'running' || !gate.pauseWithRide) && !gate.obscured && gate.inView && document.visibilityState === 'visible';
  }, []);

  const resumeIfPausedByTempo = useCallback(() => {
    const player = playerRef.current;
    if (!pausedByTempoRef.current || !player || !mayPlay()) return;
    pausedByTempoRef.current = false;
    player.playVideo();
  }, [mayPlay]);

  // Keep keyboard focus on the panel (not a button) so Space still pauses the ride.
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  // Too little room for a 200 × 200 player: offer YouTube instead of a player below the minimum.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const { width, height } = stage.getBoundingClientRect();
      setFits(width >= MIN_PLAYER_PX && height >= MIN_PLAYER_PX);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Create the iframe, connect to its player and watch its visibility; undo all of it
  // when leaving, switching videos, retrying or when the player no longer fits.
  useEffect(() => {
    const box = frameBoxRef.current;
    if (!box || errorCode !== null || !fits) return;
    const iframe = document.createElement('iframe');
    iframe.src = youTubeEmbedUrl(video.id, { startSec: Math.floor(resumeAtRef.current) || undefined, origin: controlled ? window.location.origin : undefined });
    iframe.title = `YouTube video player: ${video.title}`;
    iframe.allow = 'autoplay; encrypted-media';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.className = 'absolute inset-0 h-full w-full border-0';
    iframe.dataset.youtubePlayer = 'true';
    if (!controlled) {
      box.append(iframe);
      return () => iframe.remove();
    }

    const gate = gateRef.current;
    gate.inView = false;

    const sample = () => {
      const current = playerRef.current;
      if (!current) return;
      const time = current.getCurrentTime();
      if (time > 0) resumeAtRef.current = time;
      wantsPlayRef.current = isPlaying(current) || pausedByTempoRef.current;
      onTimeRef.current(video.id, resumeAtRef.current, wantsPlayRef.current);
    };
    const timer = window.setInterval(sample, SAMPLE_MS);

    // YouTube policy: pause when the player leaves the screen; the rider presses Play again after.
    const pauseIfPlaying = () => {
      const current = playerRef.current;
      if (current && isPlaying(current)) current.pauseVideo();
      pausedByTempoRef.current = false;
    };
    const observer = new IntersectionObserver(([entry]) => {
      gate.inView = Boolean(entry && entry.intersectionRatio >= 0.5);
      if (!gate.inView) pauseIfPlaying();
    }, { threshold: [0, 0.5, 1] });
    observer.observe(box);
    const onVisibility = () => {
      if (document.hidden) pauseIfPlaying();
    };
    document.addEventListener('visibilitychange', onVisibility);

    box.append(iframe);
    const player = connectYouTubePlayer(iframe, {
      onReady: (target) => {
        playerRef.current = target;
        // The rider chose this video (or it was playing before a remount): start it only
        // when the ride and page allow it, and otherwise leave it to YouTube's Play button.
        // If the browser blocks playback, that button stays too and Tempo does not retry.
        if (!wantsPlayRef.current) return;
        if (mayPlay()) {
          target.playVideo();
        } else if (restoredRef.current && gate.inView && (gate.obscured || (gate.rideStatus === 'paused' && gate.pauseWithRide))) {
          // Tempo had paused it before the remount; keep that, so resuming plays it again.
          pausedByTempoRef.current = true;
        }
      },
      onError: setErrorCode,
      onUnavailable: () => setErrorCode(PLAYER_UNAVAILABLE),
    });

    return () => {
      sample();
      // A player built again (retry, room again) picks up the same way a remount does.
      restoredRef.current = true;
      setLinkStartSec(Math.floor(resumeAtRef.current));
      window.clearInterval(timer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      playerRef.current = null;
      pausedByTempoRef.current = false;
      player.destroy();
      iframe.remove();
    };
  }, [video.id, video.title, errorCode, attempt, fits, mayPlay, controlled]);

  // Pause with the ride, and play again on resume only if Tempo paused it.
  const lastStatusRef = useRef(rideStatus);
  useEffect(() => {
    const previous = lastStatusRef.current;
    lastStatusRef.current = rideStatus;
    const player = playerRef.current;
    if (previous === 'running' && rideStatus === 'paused') {
      if (pauseWithRide && player && isPlaying(player)) {
        player.pauseVideo();
        pausedByTempoRef.current = true;
      }
    } else if (previous === 'paused' && rideStatus === 'running') {
      resumeIfPausedByTempo();
    }
  }, [rideStatus, pauseWithRide, resumeIfPausedByTempo]);

  // A dialog over the stage (Connections, the phone's More sheet): pause and hide the player.
  useEffect(() => {
    const player = playerRef.current;
    if (obscured) {
      if (player && isPlaying(player)) {
        player.pauseVideo();
        pausedByTempoRef.current = true;
      }
    } else {
      resumeIfPausedByTempo();
    }
  }, [obscured, resumeIfPausedByTempo]);

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
    if (!next) pausedByTempoRef.current = false;
    try { window.localStorage.setItem(PAUSE_WITH_RIDE_KEY, next ? '1' : '0'); } catch { /* preference only */ }
  }

  const watchUrl = youTubeWatchUrl(video.id, linkStartSec || undefined);
  const openOnYouTube = (
    <a href={watchUrl} target="_blank" rel="noopener noreferrer" className={compactSecondaryButtonClassName}>
      <ExternalLink aria-hidden="true" size={14} strokeWidth={1.6} />
      Open on YouTube
    </a>
  );

  return (
    <div ref={rootRef} tabIndex={-1} className="flex h-full w-full min-w-0 flex-col outline-none">
      <div className="@container flex min-h-11 shrink-0 items-center gap-2 pb-2">
        <button type="button" className={`${ghostButtonClassName('compact')} shrink-0 text-[var(--text-secondary)]`} onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.6} />
          Change video
        </button>
        {dragActive || checking ? (
          <p role="status" className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--brand)]">{dragActive ? 'Drop to play' : 'Checking the video…'}</p>
        ) : (
          <p className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)]" title={video.channelTitle ? `${video.title} – ${video.channelTitle}` : video.title}>
            <span className="font-medium text-[var(--text)]">{video.title}</span>
            {video.channelTitle ? <span className="hidden @md:inline"> – {video.channelTitle}</span> : null}
          </p>
        )}
        {controlled ? (
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
        ) : null}
      </div>

      <div ref={stageRef} className="relative grid min-h-0 flex-1 content-start justify-items-center [container-type:size]">
        {errorCode === null && fits ? (
          // 16:9 within the stage, letterboxed up to 200 px tall when 16:9 would be shorter. While a
          // link is dragged in, the player lets the drop through to the page and gets an outline
          // around it (never over it).
          <div
            ref={frameBoxRef}
            className={`relative h-[max(200px,calc(min(100cqw,calc(100cqh*16/9))*9/16))] w-[max(200px,min(100cqw,calc(100cqh*16/9)))] overflow-hidden rounded-lg bg-black ${obscured && controlled ? 'invisible' : ''} ${dragActive ? 'pointer-events-none outline-2 outline-offset-4 outline-dashed outline-[var(--brand)]' : ''}`}
          />
        ) : errorCode === null ? (
          <div role="status" className="flex max-w-sm flex-col items-center gap-3 self-center px-4 text-center">
            <p className="text-sm text-[var(--text)]">There isn’t room for the player here.</p>
            <div className="flex flex-wrap justify-center gap-2">{openOnYouTube}</div>
          </div>
        ) : (
          <div role="alert" className="flex max-w-sm flex-col items-center gap-3 px-4 text-center">
            <p className="text-sm text-[var(--text)]">{playerErrorMessage(errorCode)}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {openOnYouTube}
              {errorCode === 5 || errorCode === 153 || errorCode === PLAYER_UNAVAILABLE ? (
                <button type="button" className={compactSecondaryButtonClassName} onClick={() => { setErrorCode(null); setAttempt((value) => value + 1); }}>
                  Try again
                </button>
              ) : null}
              <button type="button" className={compactSecondaryButtonClassName} onClick={onBack}>
                Change video
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
