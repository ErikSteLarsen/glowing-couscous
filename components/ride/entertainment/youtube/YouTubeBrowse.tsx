'use client';

import { ArrowLeft, ExternalLink, Search } from 'lucide-react';
import { useRef, type ClipboardEvent, type FormEvent, type ReactNode, type RefObject } from 'react';

import {
  buttonFocusClassName,
  compactSecondaryButtonClassName,
  EmptyState,
  formFieldClassName,
  ghostButtonClassName,
  noticeBoxClassNames,
} from '@/components/ui';
import { youTubeWatchUrl } from '@/lib/youtube/youtube-url';
import { VideoCard, VideoCardSkeleton } from './VideoCard';
import type { YouTubeApiErrorCode, YouTubeVideoChoice, YouTubeVideoSummary } from './youtube-client';

export type BrowseRoute =
  | { kind: 'home' }
  | { kind: 'search'; query: string }
  | { kind: 'channel'; channelId: string; channelTitle: string };

export type BrowseEntry = {
  key: number;
  route: BrowseRoute;
  items: YouTubeVideoSummary[];
  nextPageToken: string | null;
  status: 'loading' | 'ready' | 'error' | 'more';
  error: { code: YouTubeApiErrorCode; message: string } | null;
  moreError: string | null;
  scrollTop: number;
};

/** A message about a pasted or recent video that Tempo could not play. */
export type BrowseNotice = { message: string; videoId?: string; tone: 'info' | 'danger' };

export const RIDE_SUGGESTIONS = [
  'Scenic cycling 4K',
  'Tour de France highlights',
  'Indoor cycling music',
  'Nature 4K',
  'Documentaries',
  'Podcasts',
];

const YOUTUBE_HOME = 'https://www.youtube.com/';
const chipClassName = `inline-flex min-h-8 items-center rounded-full border border-[var(--border-strong)] px-3 text-[13px] font-medium text-[var(--text-secondary)] transition-colors control-hover:bg-[var(--raised)] control-hover:text-[var(--text)] max-md:min-h-10 ${buttonFocusClassName}`;
const gridClassName = 'grid grid-cols-2 gap-x-3 gap-y-4 @2xl:grid-cols-3 @4xl:grid-cols-4';

function OpenYouTubeLink({ children = 'Open YouTube in a new tab', href = YOUTUBE_HOME }: { children?: ReactNode; href?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={ghostButtonClassName('compact')}>
      <ExternalLink aria-hidden="true" size={14} strokeWidth={1.6} />
      {children}
    </a>
  );
}

function Attribution() {
  return (
    <a
      href={YOUTUBE_HOME}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
    >
      Videos from YouTube
      <ExternalLink aria-hidden="true" size={12} strokeWidth={1.6} />
    </a>
  );
}

function routeHeading(route: BrowseRoute): string {
  if (route.kind === 'search') return `Results for “${route.query}”`;
  if (route.kind === 'channel') return route.channelTitle ? `Latest from ${route.channelTitle}` : 'Latest from this channel';
  return '';
}

export function YouTubeBrowse({
  entry,
  canGoBack,
  searchConfigured,
  query,
  recents,
  notice,
  checking,
  scrollRef,
  onQueryChange,
  onSubmit,
  onPasteLink,
  onBack,
  onSuggestion,
  onPlay,
  onOpenChannel,
  onRetry,
  onLoadMore,
  onDismissNotice,
}: {
  entry: BrowseEntry;
  canGoBack: boolean;
  searchConfigured: boolean | null;
  query: string;
  recents: YouTubeVideoChoice[];
  notice: BrowseNotice | null;
  checking: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onPasteLink: (text: string) => boolean;
  onBack: () => void;
  onSuggestion: (query: string) => void;
  onPlay: (video: YouTubeVideoChoice, verified: boolean) => void;
  onOpenChannel: (channelId: string, channelTitle: string) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onDismissNotice: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const placeholder = searchConfigured === false ? 'Paste a YouTube link' : 'Search YouTube or paste a link';

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text');
    if (text && onPasteLink(text)) event.preventDefault();
  }

  const { route } = entry;

  return (
    <div className="@container flex h-full min-w-0 flex-col">
      <form role="search" onSubmit={submit} className="flex shrink-0 items-center gap-2 pb-3">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label="Back"
          title="Back"
          className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors control-hover:bg-[var(--raised)] control-hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40 ${buttonFocusClassName}`}
        >
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.6} />
        </button>
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" size={16} strokeWidth={1.6} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            maxLength={2048}
            value={query}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => onQueryChange(event.target.value)}
            onPaste={paste}
            onKeyDown={(event) => {
              // Escape hands the keyboard back to the ride's shortcuts.
              if (event.key === 'Escape') inputRef.current?.blur();
            }}
            className={`${formFieldClassName} pl-9`}
          />
        </div>
        <button type="submit" className={`${compactSecondaryButtonClassName} min-h-10 shrink-0 px-3`} aria-label={searchConfigured === false ? 'Play link' : 'Search'}>
          <span className="hidden @md:inline">{searchConfigured === false ? 'Play' : 'Search'}</span>
          <Search aria-hidden="true" size={15} strokeWidth={1.6} className="@md:hidden" />
        </button>
      </form>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
        {notice ? (
          <div role={notice.tone === 'danger' ? 'alert' : 'status'} className={`${noticeBoxClassNames[notice.tone]} mb-3 flex flex-wrap items-center gap-x-3 gap-y-2`}>
            <p className="min-w-0 flex-1">{notice.message}</p>
            <div className="flex flex-wrap gap-1">
              {notice.videoId ? <OpenYouTubeLink href={youTubeWatchUrl(notice.videoId)}>Open on YouTube</OpenYouTubeLink> : null}
              <button type="button" className={ghostButtonClassName('compact')} onClick={onDismissNotice}>Dismiss</button>
            </div>
          </div>
        ) : null}
        {checking ? <p role="status" className="mb-3 text-[13px] text-[var(--text-muted)]">Checking the video…</p> : null}

        {route.kind === 'home' ? (
          <HomeView searchConfigured={searchConfigured} recents={recents} onSuggestion={onSuggestion} onPlay={onPlay} onOpenChannel={onOpenChannel} />
        ) : (
          <section aria-labelledby={`yt-results-${entry.key}`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 id={`yt-results-${entry.key}`} className="min-w-0 truncate text-sm font-medium text-[var(--text)]">{routeHeading(route)}</h2>
              <Attribution />
            </div>
            <ResultsView entry={entry} onPlay={onPlay} onOpenChannel={onOpenChannel} onRetry={onRetry} onLoadMore={onLoadMore} />
          </section>
        )}
      </div>
    </div>
  );
}

function HomeView({
  searchConfigured,
  recents,
  onSuggestion,
  onPlay,
  onOpenChannel,
}: {
  searchConfigured: boolean | null;
  recents: YouTubeVideoChoice[];
  onSuggestion: (query: string) => void;
  onPlay: (video: YouTubeVideoChoice, verified: boolean) => void;
  onOpenChannel: (channelId: string, channelTitle: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {searchConfigured === false ? (
        <div className={`${noticeBoxClassNames.info} flex flex-col gap-2`}>
          <p className="font-medium text-[var(--text)]">Paste a YouTube link to watch it here.</p>
          <p>Search needs a YouTube API key on the Tempo server (<code className="text-[12px]">YOUTUBE_API_KEY</code>). Until then, find a video on YouTube, copy its link and paste it above.</p>
          <div><OpenYouTubeLink /></div>
        </div>
      ) : (
        <section aria-labelledby="yt-suggestions">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="yt-suggestions" className="text-sm font-medium text-[var(--text)]">Ideas for your ride</h2>
            <Attribution />
          </div>
          <div className="flex flex-wrap gap-2">
            {RIDE_SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className={chipClassName} onClick={() => onSuggestion(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </section>
      )}

      {recents.length > 0 ? (
        <section aria-labelledby="yt-recent">
          <h2 id="yt-recent" className="mb-2 text-sm font-medium text-[var(--text)]">Recently watched</h2>
          <ul className={gridClassName}>
            {recents.map((video) => (
              <VideoCard key={video.id} video={video} onPlay={(choice) => onPlay(choice, false)} onOpenChannel={searchConfigured ? onOpenChannel : undefined} />
            ))}
          </ul>
        </section>
      ) : searchConfigured === false ? null : (
        <p className="text-[13px] text-[var(--text-muted)]">Search for something to watch, or paste a YouTube link. Videos you watch show up here.</p>
      )}

      {searchConfigured === false ? null : (
        <div><OpenYouTubeLink /></div>
      )}
    </div>
  );
}

function ResultsView({
  entry,
  onPlay,
  onOpenChannel,
  onRetry,
  onLoadMore,
}: {
  entry: BrowseEntry;
  onPlay: (video: YouTubeVideoChoice, verified: boolean) => void;
  onOpenChannel: (channelId: string, channelTitle: string) => void;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  if (entry.status === 'loading') {
    return (
      <ul className={gridClassName} aria-busy="true" aria-label="Loading videos">
        {Array.from({ length: 8 }, (_, index) => <VideoCardSkeleton key={index} />)}
      </ul>
    );
  }

  if (entry.status === 'error' && entry.error) {
    const limited = entry.error.code === 'quota_exceeded' || entry.error.code === 'not_configured';
    return (
      <div role="alert" className={`${noticeBoxClassNames[limited ? 'info' : 'danger']} flex flex-col items-start gap-2`}>
        <p>{entry.error.message}</p>
        <div className="flex flex-wrap gap-2">
          {limited ? null : <button type="button" className={compactSecondaryButtonClassName} onClick={onRetry}>Try again</button>}
          <OpenYouTubeLink />
        </div>
      </div>
    );
  }

  if (entry.items.length === 0) {
    return (
      <EmptyState
        title="No videos found"
        description={entry.route.kind === 'channel' ? 'This channel has no videos Tempo can play.' : 'Try other words, or paste a YouTube link.'}
      />
    );
  }

  return (
    <>
      <ul className={gridClassName}>
        {entry.items.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onPlay={(choice) => onPlay(choice, true)}
            onOpenChannel={entry.route.kind === 'channel' ? undefined : onOpenChannel}
          />
        ))}
      </ul>
      {entry.nextPageToken || entry.moreError ? (
        <div className="flex flex-col items-center gap-2 py-4">
          {entry.moreError ? <p role="alert" className="text-[13px] text-[var(--status-danger)]">{entry.moreError}</p> : null}
          {entry.nextPageToken ? (
            <button type="button" className={compactSecondaryButtonClassName} onClick={onLoadMore} disabled={entry.status === 'more'}>
              {entry.status === 'more' ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
