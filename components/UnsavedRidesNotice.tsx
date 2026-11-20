'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clearRideCheckpoint, downloadRideBackup, listStoredRides } from '@/lib/ride/recording-store';
import type { RideRecording } from '@/lib/ride/recorder';
import { formatDuration } from '@/lib/format-duration';

type RideNotice = {
  key: string;
  savedAtMs: number;
  sessionId: number;
  title: string;
  timerSec: number;
  backup: RideRecording | null;
};

/** Shows local rides and gives the rider access to a backup when the session is closed. */
export function UnsavedRidesNotice({ excludeSessionId, closedSessionId }: { excludeSessionId?: number; closedSessionId?: number }) {
  const [rides, setRides] = useState<RideNotice[]>([]);

  useEffect(() => {
    let active = true;
    let request = 0;
    const refresh = () => {
      const current = ++request;
      void listStoredRides(closedSessionId).then((stored) => {
        if (!active || request !== current) return;
        setRides(stored.filter(({ recording }) => recording.sessionId !== excludeSessionId)
          .map(({ key, savedAtMs, recording }) => ({
            key,
            savedAtMs,
            sessionId: recording.sessionId,
            title: recording.sessionTitle || 'Indoor ride',
            timerSec: recording.timerSec,
            backup: closedSessionId === recording.sessionId ? recording : null,
          })));
      });
    };
    refresh();
    window.addEventListener('storage', refresh);
    return () => {
      active = false;
      window.removeEventListener('storage', refresh);
    };
  }, [closedSessionId, excludeSessionId]);

  const discard = (sessionId: number) => {
    if (!window.confirm('Discard this unsaved ride? This cannot be undone.')) return;
    clearRideCheckpoint(sessionId);
    setRides((previous) => previous.filter((ride) => ride.sessionId !== sessionId));
  };

  if (rides.length === 0) return null;
  return (
    <aside aria-label="Unsaved rides" className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-4 py-3 text-[13px] text-[var(--text)]">
      <p className="font-medium">{rides.length === 1 ? 'One indoor ride is not saved yet' : `${rides.length} indoor rides are not saved yet`}</p>
      <ul className="mt-1 space-y-0.5 text-[var(--text-secondary)]">
        {rides.slice(0, 3).map(({ key, sessionId, title, savedAtMs, timerSec, backup }) => (
          <li key={key}>
            {backup ? title : (
              <Link href={`/athlete/ride/${sessionId}`} className="underline underline-offset-2 hover:text-[var(--text)]">
                {title}
              </Link>
            )}{' '}
            <span className="data">· {formatDuration(timerSec)} · {new Date(savedAtMs).toLocaleString()}</span>
            {backup ? (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <button type="button" className="underline underline-offset-2" onClick={() => downloadRideBackup(backup)}>Download backup</button>
                <button type="button" className="underline underline-offset-2" onClick={() => discard(sessionId)}>Discard</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}
