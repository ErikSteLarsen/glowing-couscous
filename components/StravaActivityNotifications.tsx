'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { StravaNotifications } from '@/lib/strava-inbox-service';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { dangerTextClassName, formFieldClassName, formLabelClassName, formSelectClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';

type NewActivity = StravaNotifications['activities'][number];
const sports = ['RUNNING', 'BIKING', 'SWIMMING', 'STRENGTH', 'STRETCHING', 'OTHER'];

export function StravaActivityNotifications({ paused = false }: { paused?: boolean }) {
  const router = useRouter();
  const [inbox, setInbox] = useState<StravaNotifications | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const revisionRef = useRef(0);
  const hasActivities = Boolean(inbox?.activities.length);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let request: AbortController | null = null;
    async function check() {
      clearTimeout(timer);
      if (disposed) return;
      if (document.visibilityState === 'hidden' || busyRef.current || request) {
        timer = setTimeout(check, 15_000);
        return;
      }
      request = new AbortController();
      const revision = revisionRef.current;
      let delay = 15_000;
      try {
        const response = await fetch('/api/strava/inbox', { cache: 'no-store', signal: request.signal });
        if (!response.ok) throw new Error('New Strava activities could not be checked. Retrying automatically.');
        const result = await response.json() as StravaNotifications;
        if (!disposed && revision === revisionRef.current) {
          setInbox(result);
          setSyncError(null);
        }
        if (!result.connected) delay = 60_000;
      } catch (reason) {
        if (!disposed && !request.signal.aborted && revision === revisionRef.current) {
          setSyncError(reason instanceof Error ? reason.message : 'Strava could not be checked.');
        }
      } finally {
        request = null;
        if (!disposed) timer = setTimeout(check, delay);
      }
    }
    void check();
    const refresh = () => { void check(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('tempo-strava-inbox-changed', refresh);
    return () => {
      disposed = true;
      clearTimeout(timer);
      request?.abort();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('tempo-strava-inbox-changed', refresh);
    };
  }, []);

  useEffect(() => {
    if (!hasActivities || paused) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    let previousFocus: HTMLElement | null = null;
    let previousOverflow: string | null = null;
    function openWhenAvailable() {
      if (!dialog || dialog.open || document.visibilityState === 'hidden') return;
      // Wait for an existing authoring/import modal instead of stacking focus traps.
      if (document.querySelector('dialog[open]')) return;
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
      closeRef.current?.focus();
    }
    openWhenAvailable();
    const timer = setInterval(openWhenAvailable, 500);
    return () => {
      clearInterval(timer);
      if (dialog.open) dialog.close();
      if (previousOverflow !== null) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [hasActivities, paused]);

  async function act(action: 'notify' | 'discard' | 'import', ids: string[], draft?: { title: string; sport: string; plannedSessionId: number | null }) {
    if (busyRef.current) return;
    busyRef.current = true;
    revisionRef.current += 1;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(action === 'import' ? '/api/strava/import' : '/api/strava/inbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'import' ? { stravaActivityId: ids[0], ...draft } : { action, ids }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'The activity could not be saved. Try again.');
      setInbox((current) => current ? {
        ...current,
        activities: current.activities.filter((activity) => !ids.includes(activity.id)),
        plannedSessions: action === 'import' && draft?.plannedSessionId
          ? current.plannedSessions.filter((session) => session.id !== draft.plannedSessionId) : current.plannedSessions,
      } : current);
      setNotice(action === 'import' ? `${draft?.title} was added to Tempo.` : action === 'discard' ? 'Activity discarded for now. Restore it from Import whenever you want.' : 'Activities remain available on the Import page.');
      if (action === 'import') router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Activity review could not be saved.');
    } finally {
      revisionRef.current += 1;
      busyRef.current = false;
      setBusy(false);
      window.dispatchEvent(new Event('tempo-strava-inbox-changed'));
    }
  }

  const later = () => {
    if (inbox?.activities.length) void act('notify', inbox.activities.map((activity) => activity.id));
  };

  return <>
    {notice && !hasActivities ? <div role="status" className="fixed bottom-24 left-4 right-4 z-40 mx-auto max-w-lg rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-4 text-[13px] md:bottom-4">
      <p>{notice}</p><button className={`${secondaryButtonClassName} mt-3`} onClick={() => setNotice(null)}>Dismiss message</button>
    </div> : null}
    {syncError && inbox?.connected && !hasActivities ? <p role="status" className="fixed bottom-24 left-4 right-4 z-40 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[13px] md:bottom-4">{syncError}</p> : null}
    <dialog ref={dialogRef} aria-labelledby="strava-new-title" aria-describedby="strava-new-description" aria-busy={busy}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100%-2rem))] overflow-x-hidden overflow-y-auto rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-[var(--shadow-overlay)] backdrop:bg-[var(--overlay)]"
      onCancel={(event) => { event.preventDefault(); if (!busy) later(); }}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-7">
        <div className="min-w-0 flex-1"><h2 id="strava-new-title" className="text-[20px] font-semibold">New Strava activities</h2>
          <p id="strava-new-description" className="mt-2 text-[13px] text-[var(--text-secondary)]">Match a planned session, add a completed session, or discard for now. {inbox?.activities.length ?? 0} waiting for review.</p></div>
        <button ref={closeRef} type="button" className={secondaryButtonClassName} disabled={busy} onClick={later}>Review later</button>
      </header>
      {inbox?.activities[0] ? <ActivityReview key={inbox.activities[0].id} activity={inbox.activities[0]} plannedSessions={inbox.plannedSessions} busy={busy}
        onImport={(draft) => void act('import', [inbox.activities[0].id], draft)}
        onDiscard={() => void act('discard', [inbox.activities[0].id])} /> : null}
      {error ? <p role="alert" className={`${dangerTextClassName} px-5 pb-5 sm:px-7`}>{error}</p> : null}
      {syncError ? <p role="status" className="px-5 pb-5 text-[13px] text-[var(--text-secondary)] sm:px-7">{syncError}</p> : null}
      {notice && hasActivities ? <p role="status" className="px-5 pb-5 text-[13px] text-[var(--status-success)] sm:px-7">{notice}</p> : null}
    </dialog>
  </>;
}

function ActivityReview({ activity, plannedSessions, busy, onImport, onDiscard }: {
  activity: NewActivity; plannedSessions: StravaNotifications['plannedSessions']; busy: boolean;
  onImport: (draft: { title: string; sport: string; plannedSessionId: number | null }) => void; onDiscard: () => void;
}) {
  const [title, setTitle] = useState(activity.title);
  const [sport, setSport] = useState(activity.sport);
  const [plannedSessionId, setPlannedSessionId] = useState<number | null>(null);
  const matching = plannedSessions.filter((session) => session.sport === sport);
  return <form onSubmit={(event) => { event.preventDefault(); onImport({ title, sport, plannedSessionId }); }}>
    <fieldset disabled={busy} className="min-w-0 space-y-5 px-5 py-5 sm:px-7">
      <div><h3 className="wrap-anywhere text-[20px] font-semibold">{activity.title}</h3>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{format(new Date(activity.startedAt), 'd MMM yyyy · HH:mm')} · {activity.sportType} · {formatDuration(activity.durationSec)}{activity.distanceMeters !== null ? ` · ${(activity.distanceMeters / 1000).toFixed(2)} km` : ''}</p></div>
      <label className="block"><span className={formLabelClassName}>Activity name</span><input className={formFieldClassName} required maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="block"><span className={formLabelClassName}>Categorize as</span><select className={formSelectClassName} value={sport} onChange={(event) => { setSport(event.target.value); setPlannedSessionId(null); }}>{sports.map((option) => <option key={option} value={option}>{getSportLabel(option)}</option>)}</select></label>
      <label className="block"><span className={formLabelClassName}>Planned session to complete</span><select className={formSelectClassName} value={plannedSessionId ?? ''} onChange={(event) => setPlannedSessionId(event.target.value ? Number(event.target.value) : null)}>
        <option value="">Add as a new completed session</option>{matching.map((session) => <option key={session.id} value={session.id}>{session.date ? `${format(new Date(session.date), 'd MMM yyyy')} · ` : ''}{session.title}</option>)}</select>
        <p className="mt-2 text-[12px] text-[var(--text-secondary)]">{plannedSessionId ? 'Your planned workout stays available for comparison.' : matching.length ? 'Choose a planned session above to match this activity.' : 'No unfinished session for this category is available.'}</p></label>
      <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--border)] pt-4">
        <button type="button" className={secondaryButtonClassName} onClick={onDiscard}>Discard for now</button>
        <button type="submit" className={primaryButtonClassName} disabled={busy || !title.trim()}>{busy ? 'Saving…' : plannedSessionId ? 'Match and complete session' : 'Add activity'}</button>
      </div>
      <p className="text-[12px] text-[var(--text-secondary)]">Discard only hides this activity from notifications. You can restore it on the Import page.</p>
    </fieldset>
  </form>;
}
