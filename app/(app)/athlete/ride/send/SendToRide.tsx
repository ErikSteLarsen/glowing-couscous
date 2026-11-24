'use client';

import { CheckCircle2, CircleAlert, Clapperboard } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { compactPrimaryButtonClassName, compactSecondaryButtonClassName } from '@/components/ui';
import { parseSentStart, readSendKey, sendKeyFromHash, sendVideoToRide } from '@/lib/youtube/send-to-ride';
import { parseYouTubeLink, youTubeWatchUrl } from '@/lib/youtube/youtube-url';

type State = 'loading' | 'confirm' | 'sending' | 'sent' | 'no-ride' | 'invalid';

const CLOSE_AFTER_MS = 1000;

const MESSAGES: Record<State, { title: string; body?: string }> = {
  loading: { title: '' },
  confirm: { title: 'Send this video to your ride?' },
  sending: { title: 'Sending to your ride…' },
  sent: { title: 'Sent to your ride – you can close this window' },
  'no-ride': { title: 'No ride is open in this browser.', body: 'Start your ride in Tempo, then send again.' },
  invalid: { title: 'This isn’t a YouTube video.', body: 'Open a video on YouTube, then click Send to Tempo again.' },
};

const subscribeNever = () => () => {};

/**
 * Hands the video to an open ride tab in this browser (BroadcastChannel) and reports whether one
 * took it. It sends by itself only when the link carries this browser's send key (the rider's own
 * bookmark); any other opener gets an explicit "Send to ride" button.
 */
export function SendToRide({ url, startSec }: { url: string | null; startSec: string | null }) {
  const [link] = useState(() => (url ? parseYouTubeLink(url) : null));
  // undefined during the server render and hydration, then this browser's key (or null).
  const storedKey = useSyncExternalStore(subscribeNever, readSendKey, () => undefined);
  // The bookmark puts its key in the fragment, which the server never sees.
  const sendKey = useSyncExternalStore(subscribeNever, () => sendKeyFromHash(window.location.hash), () => undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<{ attempt: number; acked: boolean } | null>(null);
  // One id per page, so a repeated send (React remounting the effect, Send again) plays only once.
  const [id] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

  const trusted = typeof storedKey === 'string' && sendKey === storedKey;
  const shouldSend = Boolean(link) && (trusted || confirmed);
  const sentStart = parseSentStart(startSec) ?? link?.startSec ?? 0;

  useEffect(() => {
    if (!link || !shouldSend) return;
    let cancelled = false;
    let closeTimer: number | undefined;
    sendVideoToRide({ id: `${id}-${attempt}`, videoId: link.videoId, startSec: sentStart }).then((acked) => {
      if (cancelled) return;
      setOutcome({ attempt, acked });
      if (acked) closeTimer = window.setTimeout(() => window.close(), CLOSE_AFTER_MS);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(closeTimer);
    };
  }, [link, shouldSend, sentStart, id, attempt]);

  const state: State = !link
    ? 'invalid'
    : storedKey === undefined
      ? 'loading'
      : !shouldSend
        ? 'confirm'
        : outcome?.attempt === attempt
          ? (outcome.acked ? 'sent' : 'no-ride')
          : 'sending';

  const message = MESSAGES[state];
  const Icon = state === 'sent' ? CheckCircle2 : state === 'sending' || state === 'confirm' ? Clapperboard : CircleAlert;
  const watchUrl = link ? youTubeWatchUrl(link.videoId, sentStart || undefined) : null;
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] p-4">
      {state === 'loading' ? null : (
        <div role="status" aria-live="polite" className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
          <Icon
            aria-hidden="true"
            size={28}
            strokeWidth={1.6}
            className={state === 'sent' ? 'text-[var(--status-success)]' : state === 'sending' || state === 'confirm' ? 'text-[var(--brand)]' : 'text-[var(--text-secondary)]'}
          />
          <p className="text-[15px] font-medium text-[var(--text)]">{message.title}</p>
          {message.body ? <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{message.body}</p> : null}
          {state === 'confirm' && watchUrl ? (
            <>
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-full truncate text-[13px] text-[var(--text-secondary)] underline underline-offset-2"
              >
                {watchUrl.replace(/^https:\/\/www\./, '')}
              </a>
              <div className="flex gap-2">
                <button type="button" className={compactPrimaryButtonClassName} onClick={() => setConfirmed(true)}>Send to ride</button>
                <button type="button" className={compactSecondaryButtonClassName} onClick={() => window.close()}>Close</button>
              </div>
            </>
          ) : state === 'no-ride' ? (
            <div className="flex gap-2">
              <button type="button" className={compactSecondaryButtonClassName} onClick={() => setAttempt((value) => value + 1)}>
                Send again
              </button>
              <button type="button" className={compactSecondaryButtonClassName} onClick={() => window.close()}>Close</button>
            </div>
          ) : state === 'invalid' ? (
            <button type="button" className={compactSecondaryButtonClassName} onClick={() => window.close()}>Close</button>
          ) : null}
        </div>
      )}
    </main>
  );
}
