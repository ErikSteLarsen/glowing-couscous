'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { parseYouTubeLink } from '@/lib/youtube/youtube-url';
import type { EntertainmentRide } from './types';
import { clearRecentVideos, readRecentVideos, rememberRecentVideo } from './youtube/recent-videos';
import { readYouTubeView, saveYouTubeView } from './youtube/view-state';
import { YouTubeBrowse, type BrowseEntry, type BrowseNotice, type BrowseRoute } from './youtube/YouTubeBrowse';
import { fetchYouTubeStatus, lookUpYouTubeVideo, searchYouTube, type YouTubeVideoChoice, type YouTubeVideoLookup } from './youtube/youtube-client';
import { YouTubeWatch } from './youtube/YouTubeWatch';

const PLAYABILITY_MESSAGES: Record<Exclude<YouTubeVideoLookup['playability'], 'playable'>, string> = {
  made_for_kids: 'This video is made for kids, so Tempo can’t play it here. Open it on YouTube instead.',
  not_embeddable: 'This video can’t be played inside other apps.',
  upcoming: 'This video hasn’t started yet. Try again when it’s live.',
  not_found: 'Tempo couldn’t find this video. Check the link and try again.',
};
const NOT_CHECKED_MESSAGE = 'Tempo can’t check this video without a YouTube API key, so it opens on YouTube.';

let nextKey = 1;

function newEntry(route: BrowseRoute, scrollTop = 0): BrowseEntry {
  return {
    key: nextKey++,
    route,
    items: [],
    nextPageToken: null,
    status: route.kind === 'home' ? 'ready' : 'loading',
    error: null,
    moreError: null,
    scrollTop,
  };
}

type YouTubePanelProps = Pick<EntertainmentRide, 'sessionId' | 'userId' | 'status' | 'obscured'>;

/**
 * The ride screen's YouTube view. Browse is Tempo's own search UI (YouTube itself can't be framed);
 * watching shows only YouTube's embedded player and a slim bar, never anything over the player.
 * Fills its parent, which must give it a definite size. Takes only the ride fields it uses, so the
 * ride screen's four updates a second don't re-render it. Its place (search, scroll, video and
 * time) is kept for this tab, so a remount (phone and desktop layouts swap) picks up where it was.
 */
export const YouTubePanel = memo(function YouTubePanel({ sessionId, userId, status, obscured }: YouTubePanelProps) {
  // The live ride view never renders on the server, so browser storage is readable here.
  const [saved] = useState(() => readYouTubeView(sessionId));
  const [stack, setStack] = useState<BrowseEntry[]>(() => (
    saved && saved.route.kind !== 'home' ? [newEntry({ kind: 'home' }), newEntry(saved.route, saved.scrollTop)] : [newEntry({ kind: 'home' }, saved?.scrollTop)]
  ));
  const [query, setQuery] = useState(saved?.query ?? '');
  const [watching, setWatching] = useState<YouTubeVideoChoice | null>(() => (
    saved?.video ? { ...saved.video, ...(saved.timeSec >= 1 ? { startSec: Math.floor(saved.timeSec) } : {}) } : null
  ));
  const [searchConfigured, setSearchConfigured] = useState<boolean | null>(null);
  const [recents, setRecents] = useState<YouTubeVideoChoice[]>(() => readRecentVideos(userId));
  const [notice, setNotice] = useState<BrowseNotice | null>(null);
  const [checking, setChecking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(saved?.scrollTop ?? 0);
  const playbackRef = useRef<{ videoId: string; timeSec: number; playing: boolean } | null>(
    saved?.video ? { videoId: saved.video.id, timeSec: saved.timeSec, playing: saved.playing } : null,
  );
  /** The watched video came back from a remount rather than a click. */
  const [restored, setRestored] = useState(saved?.video ? { videoId: saved.video.id, playing: saved.playing } : null);
  const browseRootRef = useRef<HTMLDivElement>(null);
  const controllers = useRef(new Map<number, AbortController>());
  const lookupController = useRef<AbortController | null>(null);
  const current = stack[stack.length - 1];

  // Keep the latest place for this tab: on every change, every few seconds while watching and on unmount.
  const latestRef = useRef({ route: current.route, query, watching });
  const persist = useCallback(() => {
    const { route, query: text, watching: video } = latestRef.current;
    const playback = video && playbackRef.current?.videoId === video.id ? playbackRef.current : null;
    saveYouTubeView(sessionId, {
      route,
      query: text,
      scrollTop: scrollTopRef.current,
      video,
      timeSec: playback ? playback.timeSec : video?.startSec ?? 0,
      playing: playback ? playback.playing : Boolean(video),
    });
  }, [sessionId]);
  useEffect(() => {
    latestRef.current = { route: current.route, query, watching };
    persist();
  }, [current.route, query, watching, persist]);
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
      .then((result) => { if (result.ok) setSearchConfigured(result.data.searchConfigured); })
      .catch(() => {});
    const pending = controllers.current;
    return () => {
      controller.abort();
      for (const request of pending.values()) request.abort();
      lookupController.current?.abort();
    };
  }, []);

  const updateEntry = useCallback((key: number, patch: (entry: BrowseEntry) => BrowseEntry) => {
    setStack((entries) => entries.map((entry) => (entry.key === key ? patch(entry) : entry)));
  }, []);

  const load = useCallback((entry: BrowseEntry, pageToken: string | null) => {
    const { route } = entry;
    if (route.kind === 'home') return;
    controllers.current.get(entry.key)?.abort();
    const controller = new AbortController();
    controllers.current.set(entry.key, controller);
    searchYouTube(
      route.kind === 'search' ? { query: route.query, pageToken } : { channelId: route.channelId, pageToken },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        controllers.current.delete(entry.key);
        if (!result.ok && result.code === 'not_configured') setSearchConfigured(false);
        updateEntry(entry.key, (previous) => {
          if (result.ok) {
            const seen = new Set(pageToken ? previous.items.map((video) => video.id) : []);
            const fresh = result.data.items.filter((video) => !seen.has(video.id));
            return {
              ...previous,
              items: pageToken ? [...previous.items, ...fresh] : fresh,
              nextPageToken: result.data.nextPageToken,
              status: 'ready',
              error: null,
              moreError: null,
            };
          }
          return pageToken
            ? { ...previous, status: 'ready', moreError: result.message }
            : { ...previous, status: 'error', error: { code: result.code, message: result.message } };
        });
      })
      .catch(() => {
        // Aborted: the rider moved on.
      });
  }, [updateEntry]);

  const navigate = useCallback((route: BrowseRoute) => {
    const entry = newEntry(route);
    setNotice(null);
    setStack((entries) => {
      const top = entries[entries.length - 1];
      const left = { ...top, scrollTop: scrollRef.current?.scrollTop ?? 0 };
      return [...entries.slice(0, -1), left, entry];
    });
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    scrollTopRef.current = 0;
    load(entry, null);
  }, [load]);

  // A restored search or channel loads again (from Tempo's server cache when it is fresh).
  const restoredEntry = useRef(stack.length > 1 ? stack[stack.length - 1] : null);
  useEffect(() => {
    if (restoredEntry.current) load(restoredEntry.current, null);
  }, [load]);

  // Restore the scroll position when returning to an entry (Back, Browse from the watch view or
  // a restored view), once its results are in.
  const restoreScroll = useRef<number | null>(saved?.scrollTop || null);
  useLayoutEffect(() => {
    if (watching || restoreScroll.current === null || !scrollRef.current) return;
    if (current.route.kind !== 'home' && current.status === 'loading') return;
    scrollRef.current.scrollTop = restoreScroll.current;
    scrollTopRef.current = restoreScroll.current;
    restoreScroll.current = null;
  }, [watching, current.key, current.route.kind, current.status]);

  // A notice or the "checking" line sits above the results; bring it into view.
  useEffect(() => {
    if ((notice || checking) && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [notice, checking]);

  function goBack() {
    if (stack.length <= 1) return;
    const dropped = stack[stack.length - 1];
    controllers.current.get(dropped.key)?.abort();
    controllers.current.delete(dropped.key);
    const previous = stack[stack.length - 2];
    restoreScroll.current = previous.scrollTop;
    setNotice(null);
    setQuery(previous.route.kind === 'search' ? previous.route.query : '');
    setStack(stack.slice(0, -1));
  }

  function startWatching(video: YouTubeVideoChoice) {
    restoreScroll.current = scrollRef.current?.scrollTop ?? 0;
    setNotice(null);
    setRestored(null);
    setWatching(video);
    setRecents(rememberRecentVideo(userId, video));
  }

  /**
   * Plays a video. Anything not fresh from search is checked first (made for kids, embeddable);
   * a video Tempo can't check (no key, lookup failed) is offered on YouTube instead of embedded.
   */
  function play(video: YouTubeVideoChoice, verified: boolean) {
    lookupController.current?.abort();
    if (verified) {
      startWatching(video);
      return;
    }
    if (searchConfigured === false) {
      setNotice({ tone: 'info', message: NOT_CHECKED_MESSAGE, video });
      return;
    }
    const controller = new AbortController();
    lookupController.current = controller;
    setChecking(true);
    setNotice(null);
    lookUpYouTubeVideo(video.id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setChecking(false);
        if (!result.ok) {
          if (result.code === 'not_configured') {
            setSearchConfigured(false);
            setNotice({ tone: 'info', message: NOT_CHECKED_MESSAGE, video });
          } else {
            setNotice({ tone: 'danger', message: `Tempo couldn’t check this video, so it can’t play here. ${result.message}`, video });
          }
          return;
        }
        const { playability, video: details } = result.data;
        if (playability !== 'playable' || !details) {
          setNotice({ tone: 'info', message: PLAYABILITY_MESSAGES[playability === 'playable' ? 'not_found' : playability], video: details ? { ...details, ...(video.startSec ? { startSec: video.startSec } : {}) } : video });
          return;
        }
        startWatching({ ...details, ...(video.startSec ? { startSec: video.startSec } : {}) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
  }

  function playLink(text: string): boolean {
    const link = parseYouTubeLink(text);
    if (!link) return false;
    setQuery('');
    play({ id: link.videoId, title: 'YouTube video', channelTitle: '', ...(link.startSec ? { startSec: link.startSec } : {}) }, false);
    return true;
  }

  function submit() {
    const text = query.trim();
    if (!text) return;
    if (playLink(text)) return;
    if (current.route.kind === 'search' && current.route.query === text && current.status !== 'error') return;
    navigate({ kind: 'search', query: text.slice(0, 100) });
  }

  function leaveWatch() {
    setWatching(null);
    // Hand focus back to the panel so ride shortcuts keep working.
    requestAnimationFrame(() => browseRootRef.current?.focus({ preventScroll: true }));
  }

  return (
    <div className="h-full w-full min-w-0">
      {watching ? (
        <YouTubeWatch
          key={`${watching.id}-${watching.startSec ?? 0}`}
          video={watching}
          rideStatus={status}
          obscured={obscured}
          startPlaying={restored?.videoId === watching.id ? restored.playing : true}
          restored={restored?.videoId === watching.id}
          onBack={leaveWatch}
          onTime={reportTime}
        />
      ) : (
        <div ref={browseRootRef} tabIndex={-1} className="h-full outline-none">
          <YouTubeBrowse
            entry={current}
            canGoBack={stack.length > 1}
            searchConfigured={searchConfigured}
            query={query}
            recents={recents}
            notice={notice}
            checking={checking}
            scrollRef={scrollRef}
            onQueryChange={setQuery}
            onSubmit={submit}
            onPasteLink={playLink}
            onBack={goBack}
            onSuggestion={(suggestion) => {
              setQuery(suggestion);
              navigate({ kind: 'search', query: suggestion });
            }}
            onPlay={play}
            onOpenChannel={(channelId, channelTitle) => navigate({ kind: 'channel', channelId, channelTitle })}
            onRetry={() => {
              updateEntry(current.key, (entry) => ({ ...entry, status: 'loading', error: null }));
              load(current, null);
            }}
            onLoadMore={() => {
              if (!current.nextPageToken || current.status === 'more') return;
              updateEntry(current.key, (entry) => ({ ...entry, status: 'more', moreError: null }));
              load(current, current.nextPageToken);
            }}
            onDismissNotice={() => setNotice(null)}
            onClearRecents={() => {
              clearRecentVideos(userId);
              setRecents([]);
            }}
            onScroll={(top) => { scrollTopRef.current = top; }}
          />
        </div>
      )}
    </div>
  );
});
