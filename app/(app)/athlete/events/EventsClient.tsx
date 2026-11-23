'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { differenceInCalendarDays, format } from 'date-fns';
import { CalendarDays, Ellipsis, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog';
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@ui-sdk/react/alert-dialog';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, OverflowMenuTrigger } from '@/components/tempo/Menu';
import {
  centeredDialogClassName, dialogActionsClassName,
  compactDangerButtonClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  dangerTextClassName,
  EmptyState,
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  formTextareaClassName,
  ghostButtonClassName,
  iconButtonClassName,
  PageShell,
  primaryButtonClassName,
  secondaryButtonClassName,
  TopBar,
} from '@/components/ui';
import { getCalendarHref } from '@/lib/calendar-navigation';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';

type LinkedActivity = { id: number; completedOn: string; durationSec: number; distanceMeters: number | null; session: { title: string; sport: string } };
type EventRow = { id: number; title: string; sport: string; eventDate: string; targetFinishSec: number | null; resultFinishSec: number | null; resultNote: string | null; activities: LinkedActivity[] };
type Candidate = LinkedActivity;
type DurationParts = { hours: string; minutes: string; seconds: string };
const blankDuration: DurationParts = { hours: '', minutes: '', seconds: '' };
const sports = ['RUNNING', 'BIKING', 'SWIMMING', 'TRIATHLON'];
const dialogClassName = `${centeredDialogClassName} z-50 h-fit`;
const dialogButtonClassName = 'max-md:min-h-11';

function dateValue(value: string) { return value.slice(0, 10); }
function formatDay(day: string, pattern = 'EEE\u00A0d\u00A0MMM\u00A0yyyy') { return format(new Date(`${day}T12:00:00`), pattern); }
function toSeconds(parts: DurationParts, optional: boolean) {
  if (optional && !parts.hours && !parts.minutes && !parts.seconds) return null;
  return Number(parts.hours || 0) * 3600 + Number(parts.minutes || 0) * 60 + Number(parts.seconds || 0);
}
function fromSeconds(value: number | null): DurationParts {
  if (value === null) return blankDuration;
  return { hours: String(Math.floor(value / 3600)), minutes: String(Math.floor(value % 3600 / 60)), seconds: String(value % 60) };
}
function hasValidParts(parts: DurationParts) {
  return Number(parts.hours || 0) <= 48 && Number(parts.minutes || 0) <= 59 && Number(parts.seconds || 0) <= 59;
}
function countdownLabel(day: string, today: string) {
  const days = differenceInCalendarDays(new Date(`${day}T12:00:00`), new Date(`${today}T12:00:00`));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  return null;
}
function errorFrom(payload: unknown, fallback: string) {
  return payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string' ? payload.error : fallback;
}

function DurationFields({ label, value, onChange, disabled }: { label: string; value: DurationParts; onChange: (next: DurationParts) => void; disabled?: boolean }) {
  return <fieldset className="min-w-0"><legend className={formLabelClassName}>{label}</legend><div className="grid grid-cols-3 gap-2">
    {(['hours', 'minutes', 'seconds'] as const).map((part) => (
      <label key={part} className="min-w-0">
        <span className="mb-1 block text-xs capitalize text-[var(--text-secondary)]">{part}</span>
        <input inputMode="numeric" type="number" min="0" max={part === 'hours' ? 48 : 59} value={value[part]} onChange={(event) => onChange({ ...value, [part]: event.target.value })} className={`data ${formFieldClassName}`} disabled={disabled} />
      </label>
    ))}
  </div></fieldset>;
}

/** A Tempo modal for one short form; pending work keeps it open. */
function FormDialog({ open, onOpenChange, pending, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; pending: boolean; title: string; description?: string; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={(next, details) => { if (pending) { details.cancel(); return; } onOpenChange(next); }}>
    <DialogBackdrop className="fixed inset-0 z-50 bg-black/60" />
    <DialogContent className={`${dialogClassName} max-w-lg space-y-5`}>
      <div>
        <DialogTitle className="text-base font-medium text-[var(--text)]">{title}</DialogTitle>
        {description ? <DialogDescription className="mt-2 text-sm text-[var(--text-secondary)]">{description}</DialogDescription> : null}
      </div>
      {children}
    </DialogContent>
  </Dialog>;
}

function EventForm({ initial, today, onSaved, onCancel, onPendingChange }: { initial?: EventRow; today: string; onSaved: (event: EventRow) => void; onCancel: () => void; onPendingChange: (pending: boolean) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [sport, setSport] = useState(initial?.sport ?? 'RUNNING');
  const [eventDate, setEventDate] = useState(initial ? dateValue(initial.eventDate) : today);
  const [target, setTarget] = useState(fromSeconds(initial?.targetFinishSec ?? null));
  const [showGoal, setShowGoal] = useState(Boolean(initial?.targetFinishSec));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const targetFinishSec = showGoal ? toSeconds(target, true) : null;
    if (targetFinishSec !== null && (targetFinishSec < 1 || !hasValidParts(target))) { setError('Enter a valid goal time.'); return; }
    setSaving(true); onPendingChange(true);
    try {
      const response = await fetch(initial ? `/api/athlete/events/${initial.id}` : '/api/athlete/events', { method: initial ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, sport, eventDate, targetFinishSec }) });
      const payload = await response.json();
      if (!response.ok) { setError(errorFrom(payload, 'Event could not be saved. Try again.')); return; }
      onSaved(payload.event);
    } catch { setError('Event could not be saved. Check your connection and try again.'); }
    finally { setSaving(false); onPendingChange(false); }
  }
  return <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <label className="min-w-0 sm:col-span-2"><span className={formLabelClassName}>Event name</span><input autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className={formFieldClassName} placeholder="e.g. Oslo Marathon" disabled={saving} /></label>
    <label><span className={formLabelClassName}>Sport</span><select value={sport} onChange={(event) => setSport(event.target.value)} className={formSelectClassName} disabled={saving}>{sports.map((item) => <option value={item} key={item}>{getSportLabel(item)}</option>)}</select></label>
    <label><span className={formLabelClassName}>Date</span><input required type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={formFieldClassName} disabled={saving} /></label>
    <div className="sm:col-span-2">
      {showGoal ? <div className="space-y-2">
        <DurationFields label="Goal finish time" value={target} onChange={setTarget} disabled={saving} />
        <button type="button" className={`${ghostButtonClassName('compact')} max-md:min-h-11`} disabled={saving} onClick={() => { setShowGoal(false); setTarget(blankDuration); }}>Remove goal time</button>
      </div> : <button type="button" className={`${ghostButtonClassName('compact')} -ml-2 max-md:min-h-11`} disabled={saving} onClick={() => setShowGoal(true)}><Plus aria-hidden="true" size={14} strokeWidth={1.8} />Add goal time</button>}
    </div>
    {error ? <p role="alert" className={`${dangerTextClassName} sm:col-span-2`}>{error}</p> : null}
    <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
      <button type="button" disabled={saving} onClick={onCancel} className={`${compactSecondaryButtonClassName} ${dialogButtonClassName}`}>Cancel</button>
      <button disabled={saving} className={`${compactPrimaryButtonClassName} ${dialogButtonClassName}`}>{saving ? 'Saving…' : initial ? 'Save event' : 'Add event'}</button>
    </div>
  </form>;
}

function ResultForm({ event, onSaved, onCancel, onPendingChange }: { event: EventRow; onSaved: (event: EventRow) => void; onCancel: () => void; onPendingChange: (pending: boolean) => void }) {
  const [result, setResult] = useState(fromSeconds(event.resultFinishSec));
  const [note, setNote] = useState(event.resultNote ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    const resultFinishSec = toSeconds(result, false);
    if (!Number.isInteger(resultFinishSec) || resultFinishSec! < 1 || !hasValidParts(result)) { setError('Enter a valid result time.'); return; }
    setSaving(true); onPendingChange(true);
    try {
      const response = await fetch(`/api/athlete/events/${event.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'result', resultFinishSec, resultNote: note }) });
      const payload = await response.json();
      if (!response.ok) { setError(errorFrom(payload, 'Result could not be saved. Try again.')); return; }
      onSaved(payload.event);
    } catch { setError('Result could not be saved. Check your connection and try again.'); }
    finally { setSaving(false); onPendingChange(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <DurationFields label="Actual finish time" value={result} onChange={setResult} disabled={saving} />
    <label className="block"><span className={formLabelClassName}>Note (optional)</span><textarea maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={formTextareaClassName} disabled={saving} placeholder="How did it go?" /></label>
    {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
    <div className={dialogActionsClassName}>
      <button type="button" disabled={saving} onClick={onCancel} className={`${compactSecondaryButtonClassName} ${dialogButtonClassName}`}>Cancel</button>
      <button disabled={saving} className={`${compactPrimaryButtonClassName} ${dialogButtonClassName}`}>{saving ? 'Saving…' : 'Save result'}</button>
    </div>
  </form>;
}

function ActivitySummary({ activity }: { activity: LinkedActivity }) {
  return <div className="min-w-0"><p className="break-words text-sm text-[var(--text)]">{activity.session.title}&nbsp;· {getSportLabel(activity.session.sport)}</p><p className="data text-xs text-[var(--text-muted)]">{formatDay(activity.completedOn)}&nbsp;· {formatDuration(activity.durationSec)}{activity.distanceMeters !== null ? `\u00A0· ${(activity.distanceMeters / 1000).toFixed(2)}\u00A0km` : ''}</p></div>;
}

/** Explicit link and unlink of completed activities; the event result stays separate. */
function LinkedActivitiesPanel({ event, onChange, onPendingChange }: { event: EventRow; onChange: (event: EventRow) => void; onPendingChange: (pending: boolean) => void }) {
  const [activityQuery, setActivityQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateTotal, setCandidateTotal] = useState(0);
  const [candidatePage, setCandidatePage] = useState(0);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSavingState] = useState(false);
  const setSaving = (next: boolean) => { setSavingState(next); onPendingChange(next); };
  const linked = event.activities ?? [];
  async function searchActivities(page = 0): Promise<boolean> {
    setMessage(''); setSaving(true);
    try {
      const params = new URLSearchParams({ q: activityQuery, page: String(page) });
      const response = await fetch(`/api/athlete/events/${event.id}/activities?${params}`);
      const payload = await response.json();
      if (!response.ok) { setMessage(errorFrom(payload, 'Activities could not be loaded.')); return false; }
      setCandidates(payload.activities); setCandidateTotal(payload.total); setCandidatePage(payload.page); setSearched(true);
      return true;
    } catch { setMessage('Activities could not be loaded. Check your connection and try again.'); return false; }
    finally { setSaving(false); }
  }
  async function linkActivity(activityId: number) {
    setMessage(''); setSaving(true);
    try {
      const response = await fetch(`/api/athlete/events/${event.id}/activities`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ activityId }) });
      const payload = await response.json();
      if (!response.ok) { setMessage(errorFrom(payload, 'Activity could not be linked.')); return; }
      const selected = candidates.find((activity) => activity.id === activityId);
      if (selected) onChange({ ...event, activities: [...linked, selected] });
      const remainingTotal = Math.max(0, candidateTotal - 1);
      const remainingLastPage = Math.max(0, Math.ceil(remainingTotal / 30) - 1);
      const requestedPage = Math.min(candidatePage, remainingLastPage);
      setCandidates((current) => current.filter((activity) => activity.id !== activityId)); setCandidateTotal(remainingTotal); setCandidatePage(requestedPage);
      const refreshed = await searchActivities(requestedPage);
      setMessage(refreshed ? 'Activity linked to event.' : 'Activity linked, but the activity list could not be refreshed. Use Search to try again.');
    } catch { setMessage('Activity could not be linked. Check your connection and try again.'); }
    finally { setSaving(false); }
  }
  async function unlinkActivity(activityId: number) {
    setMessage(''); setSaving(true);
    try {
      const response = await fetch(`/api/athlete/events/${event.id}/activities?activityId=${activityId}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) { setMessage(errorFrom(payload, 'Activity could not be unlinked.')); return; }
      onChange({ ...event, activities: linked.filter((activity) => activity.id !== activityId) });
      if (searched) {
        const refreshed = await searchActivities(0);
        setMessage(refreshed ? 'Activity unlinked.' : 'Activity unlinked, but the activity list could not be refreshed. Use Search to try again.');
      } else setMessage('Activity unlinked.');
    } catch { setMessage('Activity could not be unlinked. Check your connection and try again.'); }
    finally { setSaving(false); }
  }
  return <div className="space-y-5">
    <section aria-label={`Activities linked to ${event.title}`} className="space-y-2">
      {linked.length ? <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-3">{linked.map((activity) => <li key={activity.id} className="flex items-center justify-between gap-3 py-2.5"><ActivitySummary activity={activity} /><button type="button" disabled={saving} className={`${compactSecondaryButtonClassName} ${dialogButtonClassName} shrink-0`} onClick={() => void unlinkActivity(activity.id)}>Unlink</button></li>)}</ul> : <p className="text-sm text-[var(--text-muted)]">No activities linked yet.</p>}
    </section>
    <section aria-label="Link a completed activity" className="space-y-3 border-t border-[var(--border)] pt-4">
      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); void searchActivities(0); }}><label className="min-w-0 flex-1"><span className={formLabelClassName}>Find a completed activity</span><input value={activityQuery} onChange={(e) => setActivityQuery(e.target.value)} className={formFieldClassName} placeholder="Search title or sport" /></label><button disabled={saving} className={`${secondaryButtonClassName} max-md:min-h-11`}>Search</button></form>
      {searched ? candidates.length ? <ul className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-xl border border-[var(--border)] px-3">{candidates.map((activity) => <li key={activity.id} className="flex items-center justify-between gap-3 py-2.5"><ActivitySummary activity={activity} /><button type="button" disabled={saving} className={`${compactPrimaryButtonClassName} ${dialogButtonClassName} shrink-0`} onClick={() => void linkActivity(activity.id)}>Link</button></li>)}</ul> : <p className="text-sm text-[var(--text-muted)]">No matching unlinked completed activities.</p> : null}
      {candidateTotal > 30 ? <div className="flex items-center gap-2"><button type="button" disabled={saving || candidatePage === 0} className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => void searchActivities(candidatePage - 1)}>Previous</button><span className="data text-xs text-[var(--text-muted)]">Page {candidatePage + 1} of {Math.ceil(candidateTotal / 30)}</span><button type="button" disabled={saving || (candidatePage + 1) * 30 >= candidateTotal} className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => void searchActivities(candidatePage + 1)}>Next</button></div> : null}
    </section>
    {message ? <p aria-live="polite" className="text-sm text-[var(--text-muted)]">{message}</p> : null}
  </div>;
}

type EventPanel = 'edit' | 'result' | 'activities' | 'delete' | null;

function EventCard({ event, today, onChange, onDelete }: { event: EventRow; today: string; onChange: (event: EventRow) => void; onDelete: (id: number) => void }) {
  const [panel, setPanel] = useState<EventPanel>(null);
  const [pending, setPending] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const day = dateValue(event.eventDate);
  const canRecord = day <= today;
  const countdown = countdownLabel(day, today);
  const linkedCount = event.activities?.length ?? 0;
  const close = () => setPanel(null);
  const openPanel = (next: EventPanel) => { setNotice(''); setDeleteError(''); setPanel(next); };
  async function remove() {
    setDeleteError(''); setPending(true);
    try {
      const response = await fetch(`/api/athlete/events/${event.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) { setDeleteError(errorFrom(payload, 'Event could not be deleted. Try again.')); return; }
      setPanel(null); onDelete(event.id);
    } catch { setDeleteError('Event could not be deleted. Check your connection and try again.'); }
    finally { setPending(false); }
  }
  return <article id={`event-${event.id}`} aria-labelledby={`event-${event.id}-title`} className="scroll-mt-24 py-4 target:bg-[var(--brand-tint)]">
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h3 id={`event-${event.id}-title`} className="break-words text-base font-medium text-[var(--text)]">{event.title}</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]"><span className="data">{formatDay(day)}</span> · {getSportLabel(event.sport)}{countdown ? <> · <span className="text-[var(--text-secondary)]">{countdown}</span></> : null}</p>
        {event.targetFinishSec || event.resultFinishSec !== null ? <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{event.targetFinishSec ? <>Goal <span className="data">{formatDuration(event.targetFinishSec)}</span></> : null}{event.targetFinishSec && event.resultFinishSec !== null ? ' · ' : null}{event.resultFinishSec !== null ? <>Result <span className="data text-[var(--text)]">{formatDuration(event.resultFinishSec)}</span></> : null}</p> : null}
        {event.resultNote ? <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-muted)]">{event.resultNote}</p> : null}
        {linkedCount ? <button type="button" className={`${ghostButtonClassName('compact')} -ml-2 max-md:min-h-11 mt-1`} onClick={() => openPanel('activities')}><Link2 aria-hidden="true" size={14} strokeWidth={1.8} />Linked activities <span className="data">{linkedCount}</span></button> : null}
        {notice ? <p role="status" className="mt-1 text-sm text-[var(--status-success)]">{notice}</p> : null}
        {deleteError && panel !== 'delete' ? <p role="alert" className={`${dangerTextClassName} mt-1`}>{deleteError}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {canRecord ? <button type="button" className={`${event.resultFinishSec === null ? compactPrimaryButtonClassName : compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => openPanel('result')}>{event.resultFinishSec === null ? 'Record result' : 'Edit result'}</button> : null}
        <Menu>
          <OverflowMenuTrigger aria-label={`Actions for ${event.title}`} compact />
          <MenuContent align="end">
            <MenuItem onSelect={() => openPanel('edit')}><Pencil aria-hidden="true" size={16} strokeWidth={1.8} />Edit event…</MenuItem>
            <MenuItem onSelect={() => openPanel('activities')}><Link2 aria-hidden="true" size={16} strokeWidth={1.8} />Linked activities<span className="data ml-auto text-xs text-[var(--text-muted)]">{linkedCount}</span></MenuItem>
            <MenuItem render={<Link href={getCalendarHref('week', day)} />}><CalendarDays aria-hidden="true" size={16} strokeWidth={1.8} />Show in Calendar</MenuItem>
            <MenuSeparator />
            <MenuItem destructive onSelect={() => openPanel('delete')}><Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />Delete event…</MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </div>
    <FormDialog open={panel === 'edit'} onOpenChange={(open) => { if (!open) close(); }} pending={pending} title="Edit event">
      <EventForm initial={event} today={today} onPendingChange={setPending} onCancel={close} onSaved={(updated) => { onChange(updated); close(); setNotice('Event saved.'); }} />
    </FormDialog>
    <FormDialog open={panel === 'result'} onOpenChange={(open) => { if (!open) close(); }} pending={pending} title={event.resultFinishSec === null ? 'Record result' : 'Edit result'} description={`${event.title}\u00A0· ${formatDay(day, 'd\u00A0MMM\u00A0yyyy')}${event.targetFinishSec ? ` · Goal ${formatDuration(event.targetFinishSec)}` : ''}`}>
      <ResultForm event={event} onPendingChange={setPending} onCancel={close} onSaved={(updated) => { onChange(updated); close(); setNotice('Result saved.'); }} />
    </FormDialog>
    <FormDialog open={panel === 'activities'} onOpenChange={(open) => { if (!open) close(); }} pending={pending} title="Linked activities" description={`Link completed activities to ${event.title}. The event result is recorded separately.`}>
      <LinkedActivitiesPanel event={event} onChange={onChange} onPendingChange={setPending} />
      <div className="flex justify-end"><button type="button" disabled={pending} onClick={close} className={`${compactSecondaryButtonClassName} ${dialogButtonClassName}`}>Done</button></div>
    </FormDialog>
    <AlertDialog open={panel === 'delete'} onOpenChange={(open, details) => { if (pending) { details.cancel(); return; } if (!open) close(); }}>
      <AlertDialogContent className={`${dialogClassName} max-w-md space-y-4`}>
        <div>
          <AlertDialogTitle className="text-base font-medium text-[var(--text)]">Delete this event?</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm text-[var(--text-secondary)]">“{event.title}” and its result will be deleted. Linked activities stay in your history. This cannot be undone.</AlertDialogDescription>
        </div>
        {deleteError ? <p role="alert" className={dangerTextClassName}>{deleteError}</p> : null}
        <div className={dialogActionsClassName}>
          <AlertDialogClose className={`${compactSecondaryButtonClassName} ${dialogButtonClassName}`} disabled={pending}>Keep event</AlertDialogClose>
          <button type="button" className={`${compactDangerButtonClassName} ${dialogButtonClassName}`} disabled={pending} onClick={() => void remove()}>{pending ? 'Deleting…' : 'Delete event'}</button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  </article>;
}

function EventList({ events, today, onChange, onDelete }: { events: EventRow[]; today: string; onChange: (event: EventRow) => void; onDelete: (id: number) => void }) {
  return <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-4">{events.map((event) => <EventCard key={event.id} event={event} today={today} onChange={onChange} onDelete={onDelete} />)}</div>;
}

export function EventsClient({ initialEvents, today }: { initialEvents: EventRow[]; today: string }) {
  const [events, setEvents] = useState(initialEvents);
  const [adding, setAdding] = useState(false);
  const [addPending, setAddPending] = useState(false);
  const [notice, setNotice] = useState('');
  const router = useRouter();
  const updateEvent = (updated: EventRow) => { setEvents((current) => current.map((event) => event.id === updated.id ? { ...event, ...updated, activities: updated.activities ?? event.activities ?? [] } : event).sort((a, b) => a.eventDate.localeCompare(b.eventDate))); router.refresh(); };
  const deleteEvent = (id: number) => { setEvents((current) => current.filter((item) => item.id !== id)); setNotice('Event deleted.'); router.refresh(); };
  const upcoming = events.filter((event) => dateValue(event.eventDate) >= today);
  const past = events.filter((event) => dateValue(event.eventDate) < today).reverse();
  const openAdd = () => { setNotice(''); setAdding(true); };
  return <PageShell size="default">
    <TopBar title="Events" description="Plan race days, set goal times, and record results." actions={<>
      <button type="button" className={`${primaryButtonClassName} max-md:min-h-11`} onClick={openAdd}><Plus aria-hidden="true" size={16} strokeWidth={1.8} />Add event</button>
      <Menu>
        <MenuTrigger aria-label="More event options" className={iconButtonClassName}><Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} /></MenuTrigger>
        <MenuContent align="end">
          <MenuItem render={<Link href="/athlete/calendar" />}><CalendarDays aria-hidden="true" size={16} strokeWidth={1.8} />Open Calendar</MenuItem>
        </MenuContent>
      </Menu>
    </>} />
    {notice ? <p role="status" className="text-sm text-[var(--status-success)]">{notice}</p> : null}
    <FormDialog open={adding} onOpenChange={setAdding} pending={addPending} title="Add event" description="Name, sport and date. You can add a goal time now or later.">
      <EventForm today={today} onPendingChange={setAddPending} onCancel={() => setAdding(false)} onSaved={(created) => {
        setEvents((current) => [...current, { ...created, activities: created.activities ?? [] }].sort((a, b) => a.eventDate.localeCompare(b.eventDate)));
        setAdding(false); setNotice(`${created.title} added.`); router.refresh();
      }} />
    </FormDialog>
    {events.length === 0 ? <EmptyState title="No events yet" description="Add a race or goal day to see it on your Calendar." /> : <>
      <section aria-labelledby="upcoming-events"><h2 id="upcoming-events" className="mb-2 text-base font-medium text-[var(--text)]">Upcoming</h2>{upcoming.length ? <EventList events={upcoming} today={today} onChange={updateEvent} onDelete={deleteEvent} /> : <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--text-muted)]">Nothing coming up. Use <span className="text-[var(--text-secondary)]">Add event</span> for your next race or goal day.</p>}</section>
      {past.length ? <section aria-labelledby="past-events"><h2 id="past-events" className="mb-2 text-base font-medium text-[var(--text)]">Past events</h2><EventList events={past} today={today} onChange={updateEvent} onDelete={deleteEvent} /></section> : null}
    </>}
  </PageShell>;
}
