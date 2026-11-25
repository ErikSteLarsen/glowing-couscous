'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { noticeBoxClassNames } from '@/components/ui';
import { clearExecutionProgress, executionProgressKey, listExecutionProgressSessions } from '@/lib/athlete-execution-progress-store';
import {
  classifyStoredRides,
  clearRideCheckpoint,
  downloadRideBackup,
  listStoredRides,
  saveStoredRide,
  type ClassifiedRide,
  type RideSessionStatus,
} from '@/lib/ride/recording-store';
import { formatDuration } from '@/lib/format-duration';

/** A ride whose checkpoint is this fresh is still being ridden, in another tab. */
const LIVE_CHECKPOINT_MS = 15_000;
const MAX_SHOWN = 5;
const actionClassName = 'underline underline-offset-2 control-hover:text-[var(--text)] disabled:opacity-50';
const mainActionClassName = 'font-medium text-[var(--text)] underline underline-offset-2 control-hover:text-[var(--brand)] disabled:no-underline disabled:opacity-70';

type OwnedSession = { id: number; title: string; status: RideSessionStatus };
type RideNotice = ClassifiedRide & { reason: string | null; live: boolean };
type FollowedWorkout = { sessionId: number; title: string };
type SaveState = { kind: 'saving' } | { kind: 'failed'; error: string } | { kind: 'saved'; sessionId: number; title: string };

const closedReason: Record<RideSessionStatus | 'missing', string | null> = {
  planned: null,
  skipped: 'Workout skipped',
  completed: 'Workout already done',
  missing: 'Workout no longer in your Calendar',
};

async function loadOwnedSessions(sessionIds: number[], signal: AbortSignal): Promise<Map<number, OwnedSession> | null> {
  if (sessionIds.length === 0) return new Map();
  try {
    const response = await fetch(`/api/athlete/ride-checkpoints?sessionIds=${sessionIds.join(',')}`, { signal, cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as { sessions: OwnedSession[] };
    return new Map(body.sessions.map((session) => [session.id, session]));
  } catch {
    return null;
  }
}

/**
 * Lists what the signed-in athlete started but hasn't saved: rides recorded on this device and Follow along progress.
 * Rides whose session is gone, skipped or completed get a backup and a
 * discard control instead of a link. Legacy checkpoints without an owner appear only once the server confirms them.
 */
export function UnsavedRidesNotice({ userId, excludeSessionId }: { userId: number; excludeSessionId?: number }) {
  const router = useRouter();
  const [followed, setFollowed] = useState<FollowedWorkout[]>([]);
  const [rides, setRides] = useState<RideNotice[]>([]);
  const [saves, setSaves] = useState<Record<number, SaveState>>({});
  const savingIds = useRef(new Set<number>());

  useEffect(() => {
    let controller = new AbortController();
    let recheck: number | undefined;
    const refresh = async () => {
      controller.abort();
      const current = (controller = new AbortController());
      const stored = (await listStoredRides(userId)).filter(({ recording }) => recording.sessionId !== excludeSessionId);
      const followedIds = listExecutionProgressSessions().filter((id) => id !== excludeSessionId);
      const ids = [...new Set([...stored.map(({ recording }) => recording.sessionId), ...followedIds])].slice(0, 50);
      const owned = await loadOwnedSessions(ids, current.signal);
      if (current.signal.aborted) return;
      // Without a server answer, keep the rider's own rides reachable and hide unowned legacy ones.
      const classified = owned
        ? classifyStoredRides(stored, new Map([...owned].map(([id, { status }]) => [id, status])))
        : stored.filter(({ legacy }) => !legacy).map((ride) => ({ ride, state: 'open' as const }));
      const notices = classified.map((entry) => ({
        ...entry,
        reason: entry.state === 'open' ? null : closedReason[owned?.get(entry.ride.recording.sessionId)?.status ?? 'missing'],
        live: entry.ride.recording.status === 'running' && Date.now() - entry.ride.savedAtMs < LIVE_CHECKPOINT_MS,
      }));
      setRides(notices);
      // A ride closed a moment ago looks live until its last checkpoint is old enough.
      window.clearTimeout(recheck);
      if (notices.some(({ live }) => live)) recheck = window.setTimeout(() => void refresh(), LIVE_CHECKPOINT_MS);
      setFollowed(followedIds.flatMap((sessionId) => {
        const session = owned?.get(sessionId);
        return session?.status === 'planned' ? [{ sessionId, title: session.title }] : [];
      }));
    };
    void refresh();
    const onStorage = () => void refresh();
    window.addEventListener('storage', onStorage);
    return () => {
      controller.abort();
      window.clearTimeout(recheck);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId, excludeSessionId]);

  const discard = (sessionId: number) => {
    if (!window.confirm('Discard this unsaved ride? This cannot be undone.')) return;
    clearRideCheckpoint(userId, sessionId);
    setRides((previous) => previous.filter(({ ride }) => ride.recording.sessionId !== sessionId));
  };

  const discardFollowed = (sessionId: number) => {
    if (!window.confirm('Discard your progress in this workout? This cannot be undone.')) return;
    clearExecutionProgress(executionProgressKey(sessionId));
    setFollowed((previous) => previous.filter((entry) => entry.sessionId !== sessionId));
  };

  const saveRide = async ({ ride: { recording }, state }: RideNotice) => {
    const id = recording.sessionId;
    if (savingIds.current.has(id)) return;
    savingIds.current.add(id);
    setSaves((previous) => ({ ...previous, [id]: { kind: 'saving' } }));
    const result = await saveStoredRide(userId, recording, { standalone: state === 'closed' });
    if (!result.ok) savingIds.current.delete(id);
    setSaves((previous) => ({
      ...previous,
      [id]: result.ok ? { kind: 'saved', sessionId: result.sessionId, title: recording.sessionTitle || 'Indoor ride' } : { kind: 'failed', error: result.error },
    }));
    if (!result.ok) return;
    setRides((previous) => previous.filter(({ ride }) => ride.recording.sessionId !== id));
    router.refresh();
  };

  const saved = Object.values(saves).filter((save): save is Extract<SaveState, { kind: 'saved' }> => save.kind === 'saved');
  const unsavedCount = rides.length + followed.length;
  if (unsavedCount === 0 && saved.length === 0) return null;
  return (
    <aside aria-label={unsavedCount ? 'Workouts not saved yet' : 'Saved rides'} className={unsavedCount ? noticeBoxClassNames.warning : noticeBoxClassNames.info}>
      {unsavedCount ? <p className="font-medium">{unsavedCount === 1 ? 'One workout is not saved yet' : `${unsavedCount} workouts are not saved yet`}</p> : null}
      <ul className={`space-y-2 text-[var(--text-secondary)] ${unsavedCount ? 'mt-1.5' : ''}`}>
        {saved.map(({ sessionId, title }) => (
          <li key={`saved-${sessionId}`} role="status">
            <span className="text-[var(--text)]">{title}</span> saved.{' '}
            <Link href={`/athlete/session/${sessionId}`} className="underline underline-offset-2 hover:text-[var(--text)]">View activity</Link>
          </li>
        ))}
        {rides.slice(0, MAX_SHOWN).map((notice) => {
          const { ride: { key, savedAtMs, recording }, state, reason, live } = notice;
          const rideHref = `/athlete/ride/${recording.sessionId}`;
          const save = saves[recording.sessionId];
          const saving = save?.kind === 'saving';
          return (
            <li key={key}>
              <span className="text-[var(--text)]">{recording.sessionTitle || 'Indoor ride'}</span>{' '}
              <span className="data">– {formatDuration(recording.timerSec)} ridden&nbsp;– {new Date(savedAtMs).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                {reason ? <span>{reason}.</span> : null}
                {live ? <span>Open in another tab, or just closed. Checking…</span> : (
                  <>
                    {state === 'open' ? <Link href={rideHref} className={mainActionClassName}>Continue</Link> : null}
                    <button type="button" className={state === 'open' ? actionClassName : mainActionClassName} disabled={saving} aria-busy={saving} onClick={() => void saveRide(notice)}>
                      {saving ? 'Saving…' : state === 'open' ? 'Save what I have' : 'Save as activity'}
                    </button>
                    {state === 'closed' ? <button type="button" className={actionClassName} onClick={() => downloadRideBackup(recording)}>Download backup</button> : null}
                    <button type="button" className={actionClassName} disabled={saving} onClick={() => discard(recording.sessionId)}>Discard</button>
                  </>
                )}
                {save?.kind === 'failed' ? <span role="alert" className="w-full text-[var(--text)]">{save.error} The ride is still on this device.</span> : null}
              </div>
            </li>
          );
        })}
        {followed.slice(0, MAX_SHOWN).map(({ sessionId, title }) => (
          <li key={`follow-${sessionId}`}>
            <span className="text-[var(--text)]">{title}</span> – followed along, not marked as done
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <Link href={`/athlete/live/${sessionId}`} className={mainActionClassName}>Continue</Link>
              <button type="button" className={actionClassName} onClick={() => discardFollowed(sessionId)}>Discard</button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
