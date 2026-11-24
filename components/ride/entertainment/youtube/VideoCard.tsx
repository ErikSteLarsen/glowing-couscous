'use client';

import { ExternalLink } from 'lucide-react';

import { youTubeWatchUrl } from '@/lib/youtube/youtube-url';
import { thumbnailForVideo } from './recent-videos';
import { formatVideoDuration, type YouTubeVideoChoice } from './youtube-client';

const stretchedClassName =
  'text-left after:absolute after:inset-0 after:rounded-lg after:content-[""] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[var(--brand)] focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-[var(--background)]';

/**
 * One Recently played video: the title button plays it again (after the usual check) and covers
 * the card. When Tempo can't check videos (`opensOnYouTube`) it links out to YouTube instead.
 */
export function VideoCard({
  video,
  onPlay,
  opensOnYouTube = false,
}: {
  video: YouTubeVideoChoice;
  onPlay: (video: YouTubeVideoChoice) => void;
  opensOnYouTube?: boolean;
}) {
  const badge = video.isLive ? 'LIVE' : video.durationSec ? formatVideoDuration(video.durationSec) : null;

  return (
    <li className="group relative flex min-w-0 flex-col">
      {/* At least 120 × 70 px, YouTube's minimum for a thumbnail that starts playback. */}
      <div className="relative aspect-video min-w-[120px] overflow-hidden rounded-lg bg-[var(--raised)]">
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
      <h3 className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug text-[var(--text)]">
        {opensOnYouTube ? (
          <a href={youTubeWatchUrl(video.id)} target="_blank" rel="noopener noreferrer" className={stretchedClassName}>
            {video.title}
            <span className="sr-only"> (opens on YouTube)</span>
          </a>
        ) : (
          <button type="button" className={stretchedClassName} onClick={() => onPlay(video)}>
            {video.title}
          </button>
        )}
      </h3>
      {video.channelTitle ? <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{video.channelTitle}</p> : null}
      {opensOnYouTube ? (
        <p aria-hidden="true" className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <ExternalLink aria-hidden="true" size={12} strokeWidth={1.6} />
          Opens on YouTube
        </p>
      ) : null}
    </li>
  );
}
