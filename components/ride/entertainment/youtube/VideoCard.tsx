'use client';

import { ExternalLink } from 'lucide-react';

import { youTubeWatchUrl } from '@/lib/youtube/youtube-url';
import { thumbnailForVideo } from './recent-videos';
import { formatVideoAge, formatVideoDuration, type YouTubeVideoChoice, type YouTubeVideoSummary } from './youtube-client';

const stretchedClassName =
  'text-left after:absolute after:inset-0 after:rounded-lg after:content-[""] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[var(--brand)] focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-[var(--background)]';

type CardVideo = YouTubeVideoChoice & Partial<Pick<YouTubeVideoSummary, 'publishedAt' | 'madeForKids'>>;

/**
 * One video in the browse grid: the title button plays it (and covers the card), the channel
 * name opens that channel. Made-for-kids videos, and every video when Tempo can't check them
 * (`opensOnYouTube`), link out to YouTube instead of playing in Tempo.
 */
export function VideoCard({
  video,
  onPlay,
  onOpenChannel,
  opensOnYouTube = false,
}: {
  video: CardVideo;
  onPlay: (video: CardVideo) => void;
  onOpenChannel?: (channelId: string, channelTitle: string) => void;
  opensOnYouTube?: boolean;
}) {
  const linksOut = opensOnYouTube || video.madeForKids;
  const linkOutNote = video.madeForKids ? 'Made for kids, opens on YouTube' : 'Opens on YouTube';
  const age = video.publishedAt ? formatVideoAge(video.publishedAt) : '';
  const badge = video.isLive ? 'LIVE' : video.durationSec ? formatVideoDuration(video.durationSec) : null;

  return (
    <li className="group relative flex min-w-0 flex-col">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-[var(--raised)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnails are served as-is from i.ytimg.com */}
        <img
          src={thumbnailForVideo(video)}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-opacity duration-150 group-hover:opacity-85"
        />
        {badge ? (
          <span
            className={`absolute bottom-1.5 right-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${video.isLive ? 'bg-[#cc1f1f] text-white' : 'bg-black/80 text-white'}`}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <h3 className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-[var(--text)]">
        {linksOut ? (
          <a href={youTubeWatchUrl(video.id)} target="_blank" rel="noopener noreferrer" className={stretchedClassName}>
            {video.title}
            <span className="sr-only"> ({linkOutNote.toLowerCase()})</span>
          </a>
        ) : (
          <button type="button" className={stretchedClassName} onClick={() => onPlay(video)}>
            {video.title}
          </button>
        )}
      </h3>
      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-[var(--text-muted)]">
        {video.channelTitle && video.channelId && onOpenChannel ? (
          <button
            type="button"
            className="relative z-10 min-w-0 truncate rounded text-left hover:text-[var(--text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            onClick={() => onOpenChannel(video.channelId!, video.channelTitle)}
          >
            {video.channelTitle}
          </button>
        ) : video.channelTitle ? (
          <span className="min-w-0 truncate">{video.channelTitle}</span>
        ) : null}
        {age ? <span className="shrink-0">{video.channelTitle ? '– ' : ''}{age}</span> : null}
      </p>
      {linksOut ? (
        <p aria-hidden="true" className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <ExternalLink aria-hidden="true" size={12} strokeWidth={1.6} />
          {linkOutNote}
        </p>
      ) : null}
    </li>
  );
}

export function VideoCardSkeleton() {
  return (
    <li aria-hidden="true" className="flex flex-col">
      <div className="skeleton aspect-video rounded-lg" />
      <div className="skeleton mt-2 h-3.5 w-11/12 rounded" />
      <div className="skeleton mt-1.5 h-3 w-1/2 rounded" />
    </li>
  );
}
