'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  classifyStoredRides,
  clearRideCheckpoint,
  downloadRideBackup,
  listStoredRides,
  saveRideAsActivity,
  type ClassifiedRide,
  type RideSessionStatus,
} from '@/lib/ride/recording-store';
import { formatDuration } from '@/lib/format-duration';

type RideNotice = ClassifiedRide & { reason: string | null };
type SaveState = { kind: 'saving' } | { kind: 'failed'; error: string } | { kind: 'saved'; sessionId: number; title: string };

const closedReason: Record<RideSessionStatus | 'missing', string | null> = {
  planned: null,
  skipped: 'Session skipped',
  completed: 'Session already completed',
  missing: 'Session no longer in your calendar',
};

async function loadOwnedStatuses(sessionIds: number[], signal: AbortSignal): Promise<Map<number, RideSessionStatus> | null> {
  if (sessionIds.length === 0) return new Map();
  try {
    const response = await fetch(`/api/athlete/ride-checkpoints?sessionIds=${sessionIds.join(',')}`, { signal, cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as { sessions: Array<{ id: number; status: RideSessionStatus }> };
    return new Map(body.sessions.map(({ id, status }) => [id, status]));
  } catch {
    return null;
  }
}

/**
 * Lists the signed-in rider's unsaved rides. Rides whose session is gone, skipped or completed get a backup and a
 * discard control instead of a link. Legacy checkpoints without an owner appear only once the server confirms them.
 */
export function UnsavedRidesNotice({ userId, excludeSessionId }: { userId: number; excludeSessionId?: number }) {
  const [rides, setRides] = useState<RideNotice[]>([]);
  const [saves, setSaves] = useState<Record<number, SaveState>>({});
  const savingIds = useRef(new Set<number>());

  useEffect(() => {
    let controller = new AbortController();
    const refresh = async () => {
      controller.abort();
      const current = (controller = new AbortController());
      const stored = (await listStoredRides(userId)).filter(({ recording }) => recording.sessionId !== excludeSessionId);
      const statuses = await loadOwnedStatuses(stored.map(({ recording }) => recording.sessionId), current.signal);
      if (current.signal.aborted) return;
      // Without a server answer, keep the rider's own rides reachable and hide unowned legacy ones.
      const classified = statuses
        ? classifyStoredRides(stored, statuses)
        : stored.filter(({ legacy }) => !legacy).map((ride) => ({ ride, state: 'open' as const }));
      setRides(classified.map((entry) => ({
        ...entry,
        reason: entry.state === 'open' ? null : closedReason[statuses?.get(entry.ride.recording.sessionId) ?? 'missing'],
      })));
    };
    void refresh();
    const onStorage = () => void refresh();
    window.addEventListener('storage', onStorage);
    return () => {
      controller.abort();
      window.removeEventListener('storage', onStorage);
    };
  }, [userId, excludeSessionId]);

  const discard = (sessionId: number) => {
    if (!window.confirm('Discard this unsaved ride? This cannot be undone.')) return;
    clearRideCheckpoint(userId, sessionId);
    setRides((previous) => previous.filter(({ ride }) => ride.recording.sessionId !== sessionId));
  };

  const saveAsActivity = async ({ recording }: RideNotice['ride']) => {
    const id = recording.sessionId;
    if (savingIds.current.has(id)) return;
    savingIds.current.add(id);
    setSaves((previous) => ({ ...previous, [id]: { kind: 'saving' } }));
    const result = await saveRideAsActivity(userId, recording);
    if (!result.ok) savingIds.current.delete(id);
    setSaves((previous) => ({
      ...previous,
      [id]: result.ok ? { kind: 'saved', sessionId: result.sessionId, title: recording.sessionTitle || 'Indoor ride' } : { kind: 'failed', error: result.error },
    }));
    if (result.ok) setRides((previous) => previous.filter(({ ride }) => ride.recording.sessionId !== id));
  };

  const saved = Object.values(saves).filter((save): save is Extract<SaveState, { kind: 'saved' }> => save.kind === 'saved');
  if (rides.length === 0 && saved.length === 0) return null;
  if (rides.length === 0) {
    return (
      <aside aria-label="Saved rides" role="status" className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
        <ul className="space-y-1">
          {saved.map(({ sessionId, title }) => (
            <li key={sessionId}>
              <span className="text-[var(--text)]">{title}</span> saved as an activity.{' '}
              <Link href={`/athlete/session/${sessionId}`} className="underline underline-offset-2 hover:text-[var(--text)]">View activity</Link>
            </li>
          ))}
        </ul>
      </aside>
    );
  }
  return (
    <aside aria-label="Unsaved rides" className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-4 py-3 text-[13px] text-[var(--text)]">
      <p className="font-medium">{rides.length === 1 ? 'One indoor ride is not saved yet' : `${rides.length} indoor rides are not saved yet`}</p>
      <ul className="mt-1 space-y-1.5 text-[var(--text-secondary)]">
        {saved.map(({ sessionId, title }) => (
          <li key={`saved-${sessionId}`} role="status">
            <span className="text-[var(--text)]">{title}</span> saved as an activity.{' '}
            <Link href={`/athlete/session/${sessionId}`} className="underline underline-offset-2 hover:text-[var(--text)]">View activity</Link>
          </li>
        ))}
        {rides.slice(0, 5).map(({ ride, state, reason }) => {
          const { key, savedAtMs, recording } = ride;
          const title = recording.sessionTitle || 'Indoor ride';
          const save = saves[recording.sessionId];
          const saving = save?.kind === 'saving';
          return (
            <li key={key}>
              {state === 'open' ? (
                <Link href={`/athlete/ride/${recording.sessionId}`} className="underline underline-offset-2 hover:text-[var(--text)]">{title}</Link>
              ) : <span className="text-[var(--text)]">{title}</span>}{' '}
              <span className="data">· {formatDuration(recording.timerSec)} · {new Date(savedAtMs).toLocaleString()}</span>
              {state === 'closed' ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {reason ? <span>{reason}.</span> : null}
                  <button type="button" className="font-medium text-[var(--text)] underline underline-offset-2 disabled:no-underline disabled:opacity-70" disabled={saving} aria-busy={saving} onClick={() => void saveAsActivity(ride)}>{saving ? 'Saving…' : 'Save as activity'}</button>
                  <button type="button" className="underline underline-offset-2 hover:text-[var(--text)]" onClick={() => downloadRideBackup(recording)}>Download backup</button>
                  <button type="button" className="underline underline-offset-2 hover:text-[var(--text)] disabled:opacity-50" disabled={saving} onClick={() => discard(recording.sessionId)}>Discard</button>
                  {save?.kind === 'failed' ? <span role="alert" className="w-full text-[var(--text)]">{save.error} The ride is still on this device.</span> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
