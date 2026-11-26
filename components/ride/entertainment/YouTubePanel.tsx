'use client';

import { memo, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';

import type { YouTubeLink } from '@/lib/youtube/youtube-url';
import type { EntertainmentRide, TrackActivity } from './types';
import { clearRecentVideos, readRecentVideos, rememberRecentVideo } from './youtube/recent-videos';
import type { IncomingYouTubeVideo } from './youtube/use-youtube-inbox';
import { readYouTubeView, saveYouTubeView } from './youtube/view-state';
import { YouTubePick, type PickNotice } from './youtube/YouTubePick';
import { fetchYouTubeStatus, lookUpYouTubeVideo, type YouTubeVideoChoice, type YouTubeVideoLookup } from './youtube/youtube-client';
import { hasYouTubeConsent, saveYouTubeConsent } from './youtube/youtube-consent';
import { YouTubeWatch } from './youtube/YouTubeWatch';

const PLAYABILITY_MESSAGES: Record<Exclude<YouTubeVideoLookup['playability'], 'playable'>, string> = {
  made_for_kids: 'This video is made for kids, so TempoBuilder can’t play it here. Open it on YouTube instead.',
  not_embeddable: 'This video can’t be played inside other apps.',
  upcoming: 'This video hasn’t started yet. Try again when it’s live.',
  not_found: 'TempoBuilder couldn’t find this video. Check the link and try again.',
};
const NOT_CHECKED_MESSAGE = 'TempoBuilder can’t check this video without a YouTube API key, so it opens on YouTube.';
const PLAYER_BLOCKED_MESSAGE = 'This version of TempoBuilder Ride can’t play videos, so it opens on YouTube.';
const NOT_A_VIDEO_MESSAGE = 'That isn’t a YouTube video link. Drag a video’s thumbnail or title, or copy its link.';
const YOUTUBE_HOME = 'https://www.youtube.com/';

/**
 * A named window of its own, so the ride tab stays visible beside it (a hidden tab would pause the
 * player and slow the ride screen) and pressing the button again returns to the same window. The
 * TempoBuilder Ride app opens it in the system browser instead.
 */
function openYouTubeWindow() {
  window.open(YOUTUBE_HOME, 'tempobuilder-youtube', 'popup,width=1100,height=800');
}

function openBookmarkPage() {
  window.tempoDesktop?.youtube?.openBookmarkPage().catch(() => {});
}

type YouTubePanelProps = Pick<EntertainmentRide, 'sessionId' | 'userId' | 'status' | 'obscured'> & {
  /** The latest video brought in from outside TempoBuilder, until the panel takes it. */
  incoming: IncomingYouTubeVideo | null;
  onIncomingTaken: (seq: number) => void;
  /** A link is being dragged over the ride screen. */
  dragActive: boolean;
  trackActivity: TrackActivity;
};

/**
 * The ride screen's YouTube view. Riders browse YouTube itself (their own account, in another
 * window) and bring a video here; TempoBuilder checks it and plays it in
 * YouTube's embedded player, with nothing drawn over the player. Fills its parent, which must give
 * it a definite size. Takes only the ride fields it uses, so the ride screen's four updates a
 * second don't re-render it. The video and time are kept for this tab, so a remount picks up
 * where it was.
 */
export const YouTubePanel = memo(function YouTubePanel({ sessionId, userId, status, obscured, incoming, onIncomingTaken, dragActive, trackActivity }: YouTubePanelProps) {
  // The live ride view never renders on the server, so browser storage is readable here.
  const [saved] = useState(() => readYouTubeView(sessionId));
  // A saved video is checked again before its player comes back (its status may have changed).
  const [watching, setWatching] = useState<YouTubeVideoChoice | null>(null);
  const restoreRef = useRef<YouTubeVideoChoice | null>(
    saved?.video ? { ...saved.video, ...(saved.timeSec >= 1 ? { startSec: Math.floor(saved.timeSec) } : {}) } : null,
  );
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [recents, setRecents] = useState<YouTubeVideoChoice[]>(() => readRecentVideos(userId));
  const [notice, setNotice] = useState<PickNotice | null>(null);
  const [checking, setChecking] = useState(Boolean(saved?.video));
  const [desktopApp] = useState(() => Boolean(window.tempoDesktop));
  const [playerBlocked] = useState(() => Boolean(window.tempoDesktop && !window.tempoDesktop.youtube));
  const playbackRef = useRef<{ videoId: string; timeSec: number; playing: boolean } | null>(
    saved?.video ? { videoId: saved.video.id, timeSec: saved.timeSec, playing: saved.playing } : null,
  );
  /** The watched video came back from a remount rather than a pick. */
  const [restored, setRestored] = useState(saved?.video ? { videoId: saved.video.id, playing: saved.playing } : null);
  /** Agreed in this view, even where the browser keeps no storage. */
  const consentedRef = useRef(false);
  /** A video waiting for the rider to agree to YouTube's terms. */
  const [awaitingConsent, setAwaitingConsent] = useState<{ video: YouTubeVideoChoice; restoring: boolean } | null>(null);
  const pickRootRef = useRef<HTMLDivElement>(null);
  const lookupController = useRef<AbortController | null>(null);
  const configuredRef = useRef<boolean | null>(null);

  // Keep the latest video and time for this tab: on every change, every few seconds while watching and on unmount.
  const watchingRef = useRef(watching);
  const persist = useCallback(() => {
    // While the saved video is being checked again, keep it saved as it was.
    const video = watchingRef.current ?? restoreRef.current;
    const playback = video && playbackRef.current?.videoId === video.id ? playbackRef.current : null;
    saveYouTubeView(sessionId, {
      video,
      timeSec: playback ? playback.timeSec : video?.startSec ?? 0,
      playing: playback ? playback.playing : Boolean(video),
    });
  }, [sessionId]);
  useEffect(() => {
    watchingRef.current = watching;
    persist();
  }, [watching, persist]);
  useEffect(() => {
    window.addEventListener('pagehide', persist);
    return () => {
      window.removeEventListener('pagehide', persist);
      persist();
    };
  }, [persist]);
  const reportTime = useCallback((videoId: string, timeSec: number, playing: boolean) => {
    playbackRef.current = { videoId, timeSec, playing };
    persist();
  }, [persist]);

  useEffect(() => {
    const controller = new AbortController();
    fetchYouTubeStatus(controller.signal)
      .then((result) => {
        if (!result.ok) return;
        configuredRef.current = result.data.configured;
        setConfigured(result.data.configured);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      lookupController.current?.abort();
    };
  }, []);

  // A video kept from before a remount plays again only once the check passes.
  const restoreSaved = useEffectEvent(() => {
    if (restoreRef.current) play(restoreRef.current, { restoring: true });
  });
  useEffect(() => {
    restoreSaved();
  }, []);

  function startWatching(video: YouTubeVideoChoice, restoring: boolean) {
    setNotice(null);
    if (!restoring) setRestored(null);
    setWatching(video);
    setRecents(rememberRecentVideo(userId, video));
  }

  function showNotice(next: PickNotice) {
    setWatching(null);
    setNotice(next);
  }

  /**
   * Plays a video after checking it (made for kids, embeddable, live state). A video TempoBuilder can't
   * check (no key, lookup failed) is offered on YouTube instead of embedded. A new video replaces
   * the one playing only once it passes the check.
   */
  function play(video: YouTubeVideoChoice, { restoring = false } = {}) {
    lookupController.current?.abort();
    if (!restoring) restoreRef.current = null;
    setAwaitingConsent(null);
    if (playerBlocked || configuredRef.current === false) {
      restoreRef.current = null;
      setChecking(false);
      showNotice({ tone: 'info', message: playerBlocked ? PLAYER_BLOCKED_MESSAGE : NOT_CHECKED_MESSAGE, video });
      return;
    }
    if (!consentedRef.current && !hasYouTubeConsent(userId)) {
      setChecking(false);
      setNotice(null);
      setAwaitingConsent({ video, restoring });
      return;
    }
    const controller = new AbortController();
    lookupController.current = controller;
    setChecking(true);
    setNotice(null);
    lookUpYouTubeVideo(video.id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        restoreRef.current = null;
        setChecking(false);
        const startSec = video.startSec ? { startSec: video.startSec } : {};
        if (!result.ok) {
          if (result.code === 'not_configured') {
            configuredRef.current = false;
            setConfigured(false);
            showNotice({ tone: 'info', message: NOT_CHECKED_MESSAGE, video });
          } else {
            showNotice({ tone: 'danger', message: `TempoBuilder couldn’t check this video, so it can’t play here. ${result.message}`, video });
          }
          return;
        }
        const { playability, video: details } = result.data;
        if (playability !== 'playable' || !details) {
          showNotice({ tone: 'info', message: PLAYABILITY_MESSAGES[playability === 'playable' ? 'not_found' : playability], video: details ? { ...details, ...startSec } : video });
          return;
        }
        startWatching({ ...details, ...startSec }, restoring);
      })
      .catch(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
  }

  function acceptConsent() {
    if (!awaitingConsent) return;
    consentedRef.current = true;
    saveYouTubeConsent(userId);
    setAwaitingConsent(null);
    play(awaitingConsent.video, { restoring: awaitingConsent.restoring });
  }

  function cancelConsent() {
    restoreRef.current = null;
    setAwaitingConsent(null);
    persist();
  }

  function playLink(link: Pick<YouTubeLink, 'videoId' | 'startSec'>) {
    play({ id: link.videoId, title: 'YouTube video', channelTitle: '', ...(link.startSec ? { startSec: link.startSec } : {}) });
  }

  // A video sent, dropped or pasted from outside: take it once (the ride screen then forgets it).
  const takeIncoming = useEffectEvent((video: IncomingYouTubeVideo) => {
    onIncomingTaken(video.seq);
    if (video.videoId === null) {
      // While watching, a stray drop leaves the video alone.
      if (!watching) setNotice({ tone: 'info', message: NOT_A_VIDEO_MESSAGE });
      return;
    }
    playLink({ videoId: video.videoId, startSec: video.startSec });
  });
  useEffect(() => {
    if (incoming) takeIncoming(incoming);
  }, [incoming]);

  function leaveWatch() {
    lookupController.current?.abort();
    setChecking(false);
    setWatching(null);
    // Hand focus back to the panel so ride shortcuts keep working.
    requestAnimationFrame(() => pickRootRef.current?.focus({ preventScroll: true }));
  }

  return (
    <div className="h-full w-full min-w-0" data-youtube-panel="">
      {watching ? (
        <YouTubeWatch
          key={`${watching.id}-${watching.startSec ?? 0}`}
          video={watching}
          rideStatus={status}
          obscured={obscured}
          startPlaying={restored?.videoId === watching.id ? restored.playing : true}
          restored={restored?.videoId === watching.id}
          dragActive={dragActive}
          checking={checking}
          trackActivity={trackActivity}
          onBack={leaveWatch}
          onTime={reportTime}
        />
      ) : (
        <div ref={pickRootRef} tabIndex={-1} className="h-full outline-none">
          <YouTubePick
            configured={configured}
            desktopApp={desktopApp}
            playerBlocked={playerBlocked}
            recents={recents}
            notice={notice}
            checking={checking}
            awaitingConsent={awaitingConsent !== null}
            dragActive={dragActive}
            onAcceptConsent={acceptConsent}
            onCancelConsent={cancelConsent}
            onOpenYouTube={openYouTubeWindow}
            onGetBookmark={openBookmarkPage}
            onLink={playLink}
            onPlay={play}
            onNotice={setNotice}
            onDismissNotice={() => setNotice(null)}
            onClearRecents={() => {
              clearRecentVideos(userId);
              setRecents([]);
            }}
          />
        </div>
      )}
    </div>
  );
});
