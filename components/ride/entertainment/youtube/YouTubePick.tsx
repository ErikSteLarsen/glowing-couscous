'use client';

import { Bookmark, ClipboardPaste, ExternalLink, MousePointerClick } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  compactPrimaryButtonClassName,
  formFieldClassName,
  ghostButtonClassName,
  noticeBoxClassNames,
} from '@/components/ui';
import { parseYouTubeLink, youTubeWatchUrl, type YouTubeLink } from '@/lib/youtube/youtube-url';
import { thumbnailForVideo } from './recent-videos';
import { SendToTempoBookmark } from './SendToTempoBookmark';
import { VideoCard } from './VideoCard';
import type { YouTubeVideoChoice } from './youtube-client';

/** A message about a video Tempo could not play, with a link to it on YouTube. */
export type PickNotice = { message: string; video?: YouTubeVideoChoice; tone: 'info' | 'danger' };

const NOT_A_LINK = 'That isn’t a YouTube video link. Copy the link of a video and try again.';

/** A video Tempo won't play here, shown as a small card that opens it on YouTube. */
function LinkOutVideo({ video }: { video: YouTubeVideoChoice }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnails are served as-is from i.ytimg.com */}
      <img src={thumbnailForVideo(video)} alt="" loading="lazy" decoding="async" className="aspect-video w-32 shrink-0 rounded-md bg-[var(--raised)] object-cover" />
      <div className="flex min-w-0 flex-col items-start gap-1">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--text)]">{video.title}</p>
        {video.channelTitle ? <p className="truncate text-xs text-[var(--text-muted)]">{video.channelTitle}</p> : null}
        <a href={youTubeWatchUrl(video.id, video.startSec)} target="_blank" rel="noopener noreferrer" className={ghostButtonClassName('compact')}>
          <ExternalLink aria-hidden="true" size={14} strokeWidth={1.6} />
          Open on YouTube
        </a>
      </div>
    </div>
  );
}

function PasteField({ onLink, onInvalid }: { onLink: (link: YouTubeLink) => void; onInvalid: () => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = (text: string) => {
    const link = parseYouTubeLink(text);
    if (!link) {
      onInvalid();
      return;
    }
    setValue('');
    onLink(link);
  };
  return (
    <form
      className="flex min-w-0 gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) submit(value);
      }}
    >
      <input
        ref={inputRef}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        maxLength={2048}
        value={value}
        placeholder="Paste a YouTube link"
        aria-label="Paste a YouTube link"
        onChange={(event) => setValue(event.target.value)}
        onPaste={(event) => {
          const text = event.clipboardData.getData('text');
          if (text && parseYouTubeLink(text)) {
            event.preventDefault();
            submit(text);
          }
        }}
        onKeyDown={(event) => {
          // Escape hands the keyboard back to the ride's shortcuts.
          if (event.key === 'Escape') inputRef.current?.blur();
        }}
        className={`${formFieldClassName} min-w-0 flex-1`}
      />
    </form>
  );
}

function Way({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex min-w-0 gap-3 @2xl:flex-col @2xl:gap-2">
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--raised)] text-[var(--text-secondary)]">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[13px] font-medium text-[var(--text)]">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * The YouTube view before a video plays: open YouTube (the rider's own, signed-in site), then bring
 * a video back with the bookmark, a drag, or a pasted link. The Tempo Ride app
 * opens YouTube in the rider's browser, where the bookmark sends the video to the app.
 */
export function YouTubePick({
  configured,
  desktopApp,
  playerBlocked,
  recents,
  notice,
  checking,
  dragActive,
  onOpenYouTube,
  onGetBookmark,
  onLink,
  onPlay,
  onNotice,
  onDismissNotice,
  onClearRecents,
}: {
  /** Tempo can check videos (a YouTube API key is set). null while unknown. */
  configured: boolean | null;
  desktopApp: boolean;
  /** An older Tempo Ride app, which blocks the player. */
  playerBlocked: boolean;
  recents: YouTubeVideoChoice[];
  notice: PickNotice | null;
  checking: boolean;
  dragActive: boolean;
  onOpenYouTube: () => void;
  onGetBookmark: () => void;
  onLink: (link: YouTubeLink) => void;
  onPlay: (video: YouTubeVideoChoice) => void;
  onNotice: (notice: PickNotice) => void;
  onDismissNotice: () => void;
  onClearRecents: () => void;
}) {
  const [pasteKeys] = useState(() => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘V' : 'Ctrl+V'));
  const scrollRef = useRef<HTMLDivElement>(null);
  const invalid = () => onNotice({ tone: 'info', message: NOT_A_LINK });

  // A notice or the "checking" line sits at the top; bring it into view.
  useEffect(() => {
    if ((notice || checking) && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [notice, checking]);

  return (
    <div className="@container relative h-full min-w-0">
      <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 py-1 @3xl:gap-5 @3xl:py-3">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0 max-w-md">
              <h2 className="text-base font-medium text-[var(--text)]">Pick a video on YouTube</h2>
              <p className="mt-1 text-[13px] leading-snug text-[var(--text-secondary)]">
                {desktopApp
                  ? 'YouTube opens in your browser, with your account and recommendations. Bring a video back here and it plays beside your stats.'
                  : 'YouTube opens in its own window next to your ride, with your account and recommendations. Bring a video back here and it plays beside your stats.'}
              </p>
            </div>
            <button type="button" className={`${compactPrimaryButtonClassName} shrink-0`} onClick={onOpenYouTube}>
              <ExternalLink aria-hidden="true" size={14} strokeWidth={1.7} />
              Open YouTube
            </button>
          </div>

          {playerBlocked ? (
            <p className={noticeBoxClassNames.info}>
              This version of Tempo Ride can’t play videos. Update the app, or ride in Chrome or Edge, to watch beside your stats.
            </p>
          ) : configured === false ? (
            <p className={noticeBoxClassNames.info}>
              Tempo can’t check videos on this server (no YouTube API key), so videos you bring here open on YouTube instead of playing beside your stats.
            </p>
          ) : null}
          {notice ? (
            <div role={notice.tone === 'danger' ? 'alert' : 'status'} className={`${noticeBoxClassNames[notice.tone]} flex flex-col gap-3`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="min-w-0 flex-1">{notice.message}</p>
                <button type="button" className={ghostButtonClassName('compact')} onClick={onDismissNotice}>Dismiss</button>
              </div>
              {notice.video ? <LinkOutVideo video={notice.video} /> : null}
            </div>
          ) : null}
          {checking ? <p role="status" className="text-[13px] text-[var(--text-muted)]">Checking the video…</p> : null}

          {playerBlocked ? null : (
            <ol aria-label="Ways to bring a video here" className="grid gap-3 rounded-xl border border-[var(--border)] p-3 @2xl:grid-cols-3 @2xl:gap-5 @2xl:p-4">
              <Way icon={<Bookmark size={15} strokeWidth={1.7} />} title="Send it with a bookmark">
                {desktopApp ? (
                  <>
                    <p className="text-[13px] leading-snug text-[var(--text-secondary)]">Add it once in your browser. On any YouTube video, click it, then Send to the Tempo Ride app.</p>
                    <button type="button" className={`${ghostButtonClassName('compact')} self-start`} onClick={onGetBookmark}>Get the bookmark</button>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] leading-snug text-[var(--text-secondary)]">Drag this to your bookmarks bar. On any YouTube video, click it.</p>
                    <div className="mt-0.5"><SendToTempoBookmark /></div>
                  </>
                )}
              </Way>
              <Way icon={<MousePointerClick size={15} strokeWidth={1.7} />} title="Drag it here">
                <p className="text-[13px] leading-snug text-[var(--text-secondary)]">Drag a video’s thumbnail or title from {desktopApp ? 'your browser' : 'the YouTube window'} onto this panel.</p>
              </Way>
              <Way icon={<ClipboardPaste size={15} strokeWidth={1.7} />} title="Paste the link">
                <p className="text-[13px] leading-snug text-[var(--text-secondary)]">Copy the video’s link and press {pasteKeys} anywhere on the ride screen, or paste it here.</p>
                <div className="mt-0.5 max-w-md"><PasteField onLink={onLink} onInvalid={invalid} /></div>
              </Way>
            </ol>
          )}

          {recents.length > 0 ? (
            <section aria-labelledby="yt-recent">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 id="yt-recent" className="text-sm font-medium text-[var(--text)]">Recently played</h2>
                <button type="button" className={ghostButtonClassName('compact')} onClick={onClearRecents}>Clear</button>
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-4 @xl:grid-cols-3 @3xl:grid-cols-4">
                {recents.map((video) => (
                  <VideoCard key={video.id} video={video} onPlay={onPlay} opensOnYouTube={configured === false || playerBlocked} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {dragActive ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl border-2 border-dashed border-[var(--brand)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)]">
          <p className="text-base font-medium text-[var(--text)]">Drop to play</p>
        </div>
      ) : null}
    </div>
  );
}
