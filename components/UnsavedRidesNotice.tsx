'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listStoredRides, type StoredRide } from '@/lib/ride/recording-store';
import { formatDuration } from '@/lib/format-duration';

/** Modest reminder of indoor rides recorded in this browser (or desktop app) but not yet saved. */
export function UnsavedRidesNotice({ excludeSessionId }: { excludeSessionId?: number }) {
  const [rides, setRides] = useState<StoredRide[]>([]);

  useEffect(() => {
    let active = true;
    void listStoredRides().then((stored) => {
      if (active) setRides(stored.filter((ride) => ride.recording.sessionId !== excludeSessionId));
    });
    return () => { active = false; };
  }, [excludeSessionId]);

  if (rides.length === 0) return null;
  return (
    <aside aria-label="Unsaved rides" className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-4 py-3 text-[13px] text-[var(--text)]">
      <p className="font-medium">{rides.length === 1 ? 'One indoor ride is not saved yet' : `${rides.length} indoor rides are not saved yet`}</p>
      <ul className="mt-1 space-y-0.5 text-[var(--text-secondary)]">
        {rides.slice(0, 3).map((ride) => (
          <li key={ride.key}>
            <Link href={`/athlete/ride/${ride.recording.sessionId}`} className="underline underline-offset-2 hover:text-[var(--text)]">
              {ride.recording.sessionTitle || 'Indoor ride'}
            </Link>{' '}
            <span className="data">· {formatDuration(ride.recording.timerSec)} · {new Date(ride.savedAtMs).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
