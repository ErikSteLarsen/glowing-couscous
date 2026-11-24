'use client';

import { CheckCircle2, CircleAlert, Clapperboard } from 'lucide-react';
import { useEffect, useState } from 'react';

import { compactSecondaryButtonClassName } from '@/components/ui';
import { parseSentStart, sendVideoToRide } from '@/lib/youtube/send-to-ride';
import { parseYouTubeLink } from '@/lib/youtube/youtube-url';

type State = 'sending' | 'sent' | 'no-ride' | 'invalid';

const CLOSE_AFTER_MS = 1000;

const MESSAGES: Record<State, { title: string; body?: string }> = {
  sending: { title: 'Sending to your ride…' },
  sent: { title: 'Sent to your ride – you can close this window' },
  'no-ride': { title: 'No ride is open in this browser.', body: 'Start your ride in Tempo, then send again.' },
  invalid: { title: 'This isn’t a YouTube video.', body: 'Open a video on YouTube, then click Send to Tempo again.' },
};

/** Hands the video to an open ride tab in this browser (BroadcastChannel) and reports whether one answered. */
export function SendToRide({ url, startSec }: { url: string | null; startSec: string | null }) {
  const [link] = useState(() => (url ? parseYouTubeLink(url) : null));
  const [state, setState] = useState<State>(link ? 'sending' : 'invalid');
  const [attempt, setAttempt] = useState(0);
  // One id per page, so a repeated send (React remounting the effect, Try again) plays only once.
  const [id] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    let closeTimer: number | undefined;
    const sent = parseSentStart(startSec) ?? link.startSec ?? 0;
    sendVideoToRide({ id: `${id}-${attempt}`, videoId: link.videoId, startSec: sent }).then((acked) => {
      if (cancelled) return;
      setState(acked ? 'sent' : 'no-ride');
      if (acked) closeTimer = window.setTimeout(() => window.close(), CLOSE_AFTER_MS);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(closeTimer);
    };
  }, [link, startSec, id, attempt]);

  const message = MESSAGES[state];
  const Icon = state === 'sent' ? CheckCircle2 : state === 'sending' ? Clapperboard : CircleAlert;
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] p-4">
      <div role="status" aria-live="polite" className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <Icon
          aria-hidden="true"
          size={28}
          strokeWidth={1.6}
          className={state === 'sent' ? 'text-[var(--status-success)]' : state === 'sending' ? 'text-[var(--brand)]' : 'text-[var(--text-secondary)]'}
        />
        <p className="text-[15px] font-medium text-[var(--text)]">{message.title}</p>
        {message.body ? <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{message.body}</p> : null}
        {state === 'no-ride' ? (
          <div className="flex gap-2">
            <button
              type="button"
              className={compactSecondaryButtonClassName}
              onClick={() => {
                setState('sending');
                setAttempt((value) => value + 1);
              }}
            >
              Send again
            </button>
            <button type="button" className={compactSecondaryButtonClassName} onClick={() => window.close()}>Close</button>
          </div>
        ) : state === 'invalid' ? (
          <button type="button" className={compactSecondaryButtonClassName} onClick={() => window.close()}>Close</button>
        ) : null}
      </div>
    </main>
  );
}
