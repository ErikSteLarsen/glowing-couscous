'use client';

import { useSyncExternalStore } from 'react';
import { ActionLink } from '@/components/ui';

const downloadUrl = process.env.NEXT_PUBLIC_TEMPO_RIDE_DOWNLOAD_URL;
const subscribeNever = () => () => undefined;

/** "Ride with trainer" plus a deep link into the Tempo Ride desktop app for bike sessions. */
export function RideEntryLinks({ sessionId, from }: { sessionId: number; from?: string }) {
  const origin = useSyncExternalStore(subscribeNever, () => window.location.origin, () => '');
  const isDesktop = useSyncExternalStore(subscribeNever, () => Boolean(window.tempoDesktop?.isDesktop), () => false);
  const ridePath = `/athlete/ride/${sessionId}${from ? `?from=${from}` : ''}`;
  return (
    <>
      <ActionLink href={ridePath} tone="secondary">Ride with trainer</ActionLink>
      {isDesktop || !origin ? null : (
        <span className="inline-flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
          <a
            href={`tempo-ride://open?url=${encodeURIComponent(`${origin}/athlete/ride/${sessionId}`)}`}
            className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
          >
            Open in Tempo Ride app
          </a>
          {downloadUrl ? (
            <span>
              (not installed? <a href={downloadUrl} className="underline underline-offset-2 hover:text-[var(--text)]" target="_blank" rel="noreferrer">Download</a>)
            </span>
          ) : null}
        </span>
      )}
    </>
  );
}
