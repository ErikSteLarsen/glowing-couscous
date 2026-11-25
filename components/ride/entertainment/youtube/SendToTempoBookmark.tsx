'use client';

import { Bookmark } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getOrCreateSendKey, sendToTempoBookmarklet } from '@/lib/youtube/send-to-ride';

/**
 * The "Send to Wattonaut" bookmark. React refuses `javascript:` URLs, so the href is set after mount.
 * It carries this browser's send key, so the send window it opens plays without asking. Clicking
 * it here only explains where it goes.
 */
export function SendToTempoBookmark() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    ref.current?.setAttribute('href', sendToTempoBookmarklet(window.location.origin, getOrCreateSendKey()));
  }, []);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <a
        ref={ref}
        draggable
        data-send-to-tempo=""
        title="Drag to your bookmarks bar"
        onClick={(event) => {
          event.preventDefault();
          setHint(true);
        }}
        className="inline-flex min-h-8 cursor-grab items-center gap-1.5 rounded-full border border-dashed border-[var(--brand)] px-3 text-[13px] font-medium text-[var(--text)] active:cursor-grabbing"
      >
        <Bookmark aria-hidden="true" size={14} strokeWidth={1.7} className="text-[var(--brand)]" />
        Send to Wattonaut
      </a>
      <span aria-live="polite" className="text-xs text-[var(--text-muted)]">
        {hint ? 'Drag it to your bookmarks bar, then click it on a YouTube video.' : null}
      </span>
    </span>
  );
}
