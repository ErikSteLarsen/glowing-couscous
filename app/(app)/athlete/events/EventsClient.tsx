'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ActionLink, dangerButtonClassName, EmptyState, formFieldClassName, formLabelClassName, formSelectClassName, formTextareaClassName, PageShell, primaryButtonClassName, secondaryButtonClassName, TopBar } from '@/components/ui';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';

type LinkedActivity = { id: number; completedOn: string; durationSec: number; distanceMeters: number | null; session: { title: string; sport: string } };
type EventRow = { id: number; title: string; sport: string; eventDate: string; targetFinishSec: number | null; resultFinishSec: number | null; resultNote: string | null; activities: LinkedActivity[] };
type Candidate = LinkedActivity;
type DurationParts = { hours: string; minutes: string; seconds: string };
const blankDuration: DurationParts = { hours: '', minutes: '', seconds: '' };
const sports = ['RUNNING', 'BIKING', 'SWIMMING', 'TRIATHLON'];
function dateValue(value: string) { return value.slice(0, 10); }
function toSeconds(parts: DurationParts, optional: boolean) {
  if (optional && !parts.hours && !parts.minutes && !parts.seconds) return null;
  return Number(parts.hours || 0) * 3600 + Number(parts.minutes || 0) * 60 + Number(parts.seconds || 0);
}
function fromSeconds(value: number | null): DurationParts {
  if (value === null) return blankDuration;
  return { hours: String(Math.floor(value / 3600)), minutes: String(Math.floor(value % 3600 / 60)), seconds: String(value % 60) };
}
function DurationFields({ label, value, onChange, disabled }: { label: string; value: DurationParts; onChange: (next: DurationParts) => void; disabled?: boolean }) {
  return <fieldset className="min-w-0"><legend className={formLabelClassName}>{label}</legend><div className="grid grid-cols-3 gap-2">
    {(['hours', 'minutes', 'seconds'] as const).map((part) => <label key={part} className="min-w-0"><span className="sr-only">{label} {part}</span><input aria-label={`${label} ${part}`} inputMode="numeric" type="number" min="0" max={part === 'hours' ? 48 : 59} value={value[part]} onChange={(event) => onChange({ ...value, [part]: event.target.value })} placeholder={part === 'hours' ? 'h' : part === 'minutes' ? 'min' : 'sec'} className={formFieldClassName} disabled={disabled} /></label>)}
  </div></fieldset>;
}
function EventEditor({ initial, today, onSaved, onCancel }: { initial?: EventRow; today: string; onSaved: (event: EventRow) => void; onCancel?: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [sport, setSport] = useState(initial?.sport ?? 'RUNNING');
  const [eventDate, setEventDate] = useState(initial ? dateValue(initial.eventDate) : today);
  const [target, setTarget] = useState(fromSeconds(initial?.targetFinishSec ?? null));
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSavedMessage('');
    const targetFinishSec = toSeconds(target, true);
    if (targetFinishSec !== null && (targetFinishSec < 1 || Number(target.hours || 0) > 48 || Number(target.minutes || 0) > 59 || Number(target.seconds || 0) > 59)) { setError('Enter a valid goal time.'); return; }
    setSaving(true);
    try {
      const response = await fetch(initial ? `/api/athlete/events/${initial.id}` : '/api/athlete/events', { method: initial ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, sport, eventDate, targetFinishSec }) });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error ?? 'Event could not be saved. Try again.'); return; }
      onSaved(payload.event);
      if (!initial) { setTitle(''); setSport('RUNNING'); setEventDate(today); setTarget(blankDuration); setSavedMessage('Event added.'); }
    } catch { setError('Event could not be saved. Check your connection and try again.'); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 sm:p-5">
    <label className="min-w-0 sm:col-span-2"><span className={formLabelClassName}>Event name</span><input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className={formFieldClassName} /></label>
    <label><span className={formLabelClassName}>Event sport</span><select value={sport} onChange={(event) => setSport(event.target.value)} className={formSelectClassName}>{sports.map((item) => <option value={item} key={item}>{getSportLabel(item)}</option>)}</select></label>
    <label><span className={formLabelClassName}>Event date</span><input required type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={formFieldClassName} /></label>
    <DurationFields label="Goal finish time (optional)" value={target} onChange={setTarget} />
    <div className="flex items-end gap-2"><button disabled={saving} className={primaryButtonClassName}>{saving ? 'Saving…' : initial ? 'Save event' : 'Add event'}</button>{onCancel ? <button type="button" disabled={saving} onClick={onCancel} className={secondaryButtonClassName}>Cancel</button> : null}</div>
    {error ? <p role="alert" className="text-sm text-[var(--status-danger)] sm:col-span-2">{error}</p> : null}
    {savedMessage ? <p role="status" className="text-sm text-[var(--text-muted)] sm:col-span-2">{savedMessage}</p> : null}
  </form>;
}

function EventCard({ event, today, onChange, onDelete }: { event: EventRow; today: string; onChange: (event: EventRow) => void; onDelete: (id: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState(fromSeconds(event.resultFinishSec));
  const [note, setNote] = useState(event.resultNote ?? '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [activityQuery, setActivityQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateTotal, setCandidateTotal] = useState(0);
  const [candidatePage, setCandidatePage] = useState(0);
  const [activityMessage, setActivityMessage] = useState('');
  const [showActivities, setShowActivities] = useState(false);
  const canRecord = dateValue(event.eventDate) <= today;
  async function saveResult(e: FormEvent) {
    e.preventDefault(); setMessage('');
    const resultFinishSec = toSeconds(result, false);
    if (!Number.isInteger(resultFinishSec) || resultFinishSec! < 1 || Number(result.hours || 0) > 48 || Number(result.minutes || 0) > 59 || Number(result.seconds || 0) > 59) { setMessage('Enter a valid result time.'); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/athlete/events/${event.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'result', resultFinishSec, resultNote: note }) });
      const payload = await response.json();
      if (!response.ok) { setMessage(payload.error ?? 'Result could not be saved. Try again.'); return; }
      onChange(payload.event); setMessage('Result saved.');
    } catch { setMessage('Result could not be saved. Check your connection and try again.'); }
    finally { setSaving(false); }
  }
  async function searchActivities(page = 0): Promise<boolean> {
    setActivityMessage(''); setSaving(true);
    try {
      const params = new URLSearchParams({ q: activityQuery, page: String(page) });
      const response = await fetch(`/api/athlete/events/${event.id}/activities?${params}`);
      const payload = await response.json();
      if (!response.ok) { setActivityMessage(payload.error ?? 'Activities could not be loaded.'); return false; }
      setCandidates(payload.activities); setCandidateTotal(payload.total); setCandidatePage(payload.page);
      return true;
    } catch { setActivityMessage('Activities could not be loaded. Check your connection and try again.'); return false; }
    finally { setSaving(false); }
  }
  async function linkActivity(activityId: number) {
    setActivityMessage(''); setSaving(true);
    try {
      const response = await fetch(`/api/athlete/events/${event.id}/activities`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ activityId }) });
      const payload = await response.json();
      if (!response.ok) { setActivityMessage(payload.error ?? 'Activity could not be linked.'); return; }
      const selected = candidates.find((activity) => activity.id === activityId);
      if (selected) onChange({ ...event, activities: [...(event.activities ?? []), selected] });
      const remainingTotal = Math.max(0, candidateTotal - 1);
      const remainingLastPage = Math.max(0, Math.ceil(remainingTotal / 30) - 1);
      const requestedPage = Math.min(candidatePage, remainingLastPage);
      setCandidates((current) => current.filter((activity) => activity.id !== activityId)); setCandidateTotal(remainingTotal); setCandidatePage(requestedPage);
      const refreshed = await searchActivities(requestedPage);
      setActivityMessage(refreshed ? 'Activity linked to event.' : 'Activity linked, but the activity list could not be refreshed. Use Search to try again.');
    } catch { setActivityMessage('Activity could not be linked. Check your connection and try again.'); }
    finally { setSaving(false); }
  }
  async function unlinkActivity(activityId: number) {
    setActivityMessage(''); setSaving(true);
    try {
      const response = await fetch(`/api/athlete/events/${event.id}/activities?activityId=${activityId}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) { setActivityMessage(payload.error ?? 'Activity could not be unlinked.'); return; }
      onChange({ ...event, activities: (event.activities ?? []).filter((activity) => activity.id !== activityId) });
      if (showActivities) {
        const refreshed = await searchActivities(0);
        setActivityMessage(refreshed ? 'Activity unlinked.' : 'Activity unlinked, but the activity list could not be refreshed. Use Search to try again.');
      } else setActivityMessage('Activity unlinked.');
    } catch { setActivityMessage('Activity could not be unlinked. Check your connection and try again.'); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!window.confirm(`Delete ${event.title}?`)) return;
    setMessage(''); setSaving(true);
    try { const response = await fetch(`/api/athlete/events/${event.id}`, { method: 'DELETE' }); const payload = await response.json(); if (!response.ok) { setMessage(payload.error ?? 'Event could not be deleted. Try again.'); return; } onDelete(event.id); }
    catch { setMessage('Event could not be deleted. Check your connection and try again.'); }
    finally { setSaving(false); }
  }
  if (editing) return <EventEditor initial={event} today={today} onSaved={(updated) => { onChange(updated); setEditing(false); }} onCancel={() => setEditing(false)} />;
  return <article id={`event-${event.id}`} className="space-y-3 border-b border-[var(--border)] py-5 last:border-0">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="break-words text-base font-medium text-[var(--text)]">{event.title}</h3><p className="mt-1 text-sm text-[var(--text-muted)]">{format(new Date(`${dateValue(event.eventDate)}T12:00:00`), 'EEE d MMM yyyy')} · {getSportLabel(event.sport)}</p><p className="mt-2 text-sm text-[var(--text-secondary)]">{event.targetFinishSec ? <>Goal <span className="data">{formatDuration(event.targetFinishSec)}</span></> : 'No goal time'}{event.resultFinishSec !== null ? <> · Result <span className="data">{formatDuration(event.resultFinishSec)}</span></> : null}</p>{event.resultNote ? <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-muted)]">{event.resultNote}</p> : null}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditing(true)} className={secondaryButtonClassName}>Edit</button><button type="button" onClick={remove} disabled={saving} className={dangerButtonClassName}>Delete</button></div></div>
    {canRecord ? <form onSubmit={saveResult} className="grid gap-3 rounded-lg bg-[var(--raised)] p-3 sm:grid-cols-2"><DurationFields label="Actual finish time" value={result} onChange={setResult} disabled={saving} /><label className="sm:col-span-1"><span className={formLabelClassName}>Result note (optional)</span><textarea maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={formTextareaClassName} disabled={saving} /></label><div className="flex flex-wrap items-end gap-2"><button disabled={saving} className={primaryButtonClassName}>{saving ? 'Saving…' : event.resultFinishSec === null ? 'Save result' : 'Update result'}</button>{message ? <p aria-live="polite" className="text-sm text-[var(--text-muted)]">{message}</p> : null}</div></form> : null}
    <section aria-label={`Activities for ${event.title}`} className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-medium text-[var(--text)]">Linked activities <span className="data text-[var(--text-muted)]">{event.activities?.length ?? 0}</span></h4><button type="button" className={secondaryButtonClassName} onClick={() => { setShowActivities((value) => !value); if (!showActivities) void searchActivities(0); }}>Link activities</button></div>
      {event.activities?.length ? <ul className="space-y-2">{event.activities.map((activity) => <li key={activity.id} className="flex flex-col gap-2 border-t border-[var(--border)] pt-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words text-sm text-[var(--text)]">{activity.session.title} · {getSportLabel(activity.session.sport)}</p><p className="data text-xs text-[var(--text-muted)]">{format(new Date(`${activity.completedOn}T12:00:00`), 'EEE d MMM yyyy')} · {formatDuration(activity.durationSec)}{activity.distanceMeters !== null ? ` · ${(activity.distanceMeters / 1000).toFixed(2)} km` : ''}</p></div><button type="button" disabled={saving} className={secondaryButtonClassName} onClick={() => void unlinkActivity(activity.id)}>Unlink</button></li>)}</ul> : <p className="text-sm text-[var(--text-muted)]">No activities linked. Event result time and note are recorded separately.</p>}
      {showActivities ? <div className="space-y-3 border-t border-[var(--border)] pt-3"><form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void searchActivities(0); }}><label className="min-w-0 flex-1"><span className={formLabelClassName}>Find a completed activity</span><input value={activityQuery} onChange={(e) => setActivityQuery(e.target.value)} className={formFieldClassName} placeholder="Search title or sport" /></label><button disabled={saving} className={secondaryButtonClassName}>Search</button></form>{candidates.length ? <ul className="space-y-2">{candidates.map((activity) => <li key={activity.id} className="flex flex-col gap-2 border-t border-[var(--border)] pt-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words text-sm text-[var(--text)]">{activity.session.title} · {getSportLabel(activity.session.sport)}</p><p className="data text-xs text-[var(--text-muted)]">{format(new Date(`${activity.completedOn}T12:00:00`), 'EEE d MMM yyyy')} · {formatDuration(activity.durationSec)}{activity.distanceMeters !== null ? ` · ${(activity.distanceMeters / 1000).toFixed(2)} km` : ''}</p></div><button type="button" disabled={saving} className={primaryButtonClassName} onClick={() => void linkActivity(activity.id)}>Link to event</button></li>)}</ul> : <p className="text-sm text-[var(--text-muted)]">No matching unlinked completed activities.</p>}{candidateTotal > 30 ? <div className="flex items-center gap-2"><button type="button" disabled={saving || candidatePage === 0} className={secondaryButtonClassName} onClick={() => void searchActivities(candidatePage - 1)}>Previous</button><span className="data text-xs text-[var(--text-muted)]">Page {candidatePage + 1} of {Math.ceil(candidateTotal / 30)}</span><button type="button" disabled={saving || (candidatePage + 1) * 30 >= candidateTotal} className={secondaryButtonClassName} onClick={() => void searchActivities(candidatePage + 1)}>Next</button></div> : null}</div> : null}
      {activityMessage ? <p aria-live="polite" className="text-sm text-[var(--text-muted)]">{activityMessage}</p> : null}
    </section>
    {message && !canRecord ? <p role="alert" className="text-sm text-[var(--status-danger)]">{message}</p> : null}
  </article>;
}

export function EventsClient({ initialEvents, today }: { initialEvents: EventRow[]; today: string }) {
  const [events, setEvents] = useState(initialEvents);
  const router = useRouter();
  const updateEvent = (updated: EventRow) => { setEvents((current) => current.map((event) => event.id === updated.id ? { ...event, ...updated, activities: updated.activities ?? event.activities ?? [] } : event)); router.refresh(); };
  const upcoming = events.filter((event) => dateValue(event.eventDate) >= today);
  const past = events.filter((event) => dateValue(event.eventDate) < today);
  return <PageShell size="default"><TopBar title="Events" description="Keep your event goals and results alongside your training." actions={<ActionLink href="/athlete/calendar" tone="secondary">Open Calendar</ActionLink>} />
    <EventEditor today={today} onSaved={(created) => { setEvents((current) => [...current, { ...created, activities: created.activities ?? [] }].sort((a, b) => a.eventDate.localeCompare(b.eventDate))); router.refresh(); }} />
    <section aria-labelledby="upcoming-events"><h2 id="upcoming-events" className="mb-2 text-base font-medium text-[var(--text)]">Upcoming</h2>{upcoming.length ? <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-4">{upcoming.map((event) => <EventCard key={event.id} event={event} today={today} onChange={updateEvent} onDelete={(id) => setEvents((current) => current.filter((item) => item.id !== id))} />)}</div> : <EmptyState title="No upcoming events" description="Add an event date and an optional goal finish time." />}</section>
    {past.length ? <section aria-labelledby="past-events"><h2 id="past-events" className="mb-2 text-base font-medium text-[var(--text)]">Past events</h2><div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-4">{past.map((event) => <EventCard key={event.id} event={event} today={today} onChange={updateEvent} onDelete={(id) => setEvents((current) => current.filter((item) => item.id !== id))} />)}</div></section> : null}
  </PageShell>;
}
