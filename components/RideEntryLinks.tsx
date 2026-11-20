'use client';

import { useId } from 'react';
import { MonitorCheck } from 'lucide-react';
import { ActionLink, buttonFocusClassName } from '@/components/ui';
import { rideSessionPath } from '@/lib/ride/launch';
import { RideAppInstallPanel, useRideAppEnvironment, useRideAppLaunch } from '@/components/RideAppLaunch';

/** "Ride with trainer", plus a deep link into the Tempo Ride desktop app with an install fallback. */
export function RideEntryLinks({ sessionId, from }: { sessionId: number; from?: string }) {
  const { origin, isDesktop } = useRideAppEnvironment();
  const app = useRideAppLaunch();
  const panelId = useId();
  const ridePath = rideSessionPath(sessionId, from);

  if (isDesktop) {
    return (
      <>
        <ActionLink href={ridePath} tone="secondary">Ride with trainer</ActionLink>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
          <MonitorCheck aria-hidden="true" size={14} strokeWidth={1.6} className="text-[var(--status-success)]" />
          Running in Tempo Ride
        </span>
      </>
    );
  }

  return (
    <>
      <ActionLink href={ridePath} tone="secondary">Ride with trainer</ActionLink>
      {origin ? (
        <span className="relative inline-flex">
          <button
            type="button"
            onClick={() => app.launch(sessionId, from)}
            disabled={app.state === 'launching'}
            aria-expanded={app.state === 'failed'}
            aria-controls={panelId}
            className={`rounded text-[13px] font-medium text-[var(--brand)] underline-offset-4 hover:underline disabled:opacity-60 ${buttonFocusClassName}`}
          >
            {app.state === 'launching' ? 'Opening Tempo Ride…' : 'Open in Tempo Ride app'}
          </button>
          {app.state === 'failed' ? <RideAppInstallPanel id={panelId} onClose={app.dismiss} onRetry={() => app.launch(sessionId, from)} /> : null}
        </span>
      ) : null}
    </>
  );
}
