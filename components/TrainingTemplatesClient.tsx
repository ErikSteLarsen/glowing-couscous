'use client';

import { SearchField } from '@/components/tempo/SearchField';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuSeparator, OverflowMenuTrigger } from '@/components/tempo/Menu';
import { ActionLink, buttonFocusClassName, Surface, EmptyState, primaryButtonClassName, secondaryButtonClassName, compactSecondaryButtonClassName, compactDangerButtonClassName, formFieldClassName, formLabelClassName, formSelectClassName, dangerTextClassName, successTextClassName } from '@/components/ui';
import { parseTemplateRoutine, ROUTINE_DAYS } from '@/lib/template-routine';
import { getSportLabel } from '@/lib/sport';
import { getCalendarPlacementHref } from '@/lib/calendar-navigation';
import { formatDuration } from '@/lib/format-duration';

type Template = { id: number; name: string; summary: string | null; routineJson: string };
type Workout = { id: number; title: string; sport: string; durationSec: number };
type Selection = { key: number; weekday: number; workoutId: number };
type Draft = { id?: number; name: string; summary: string; entries: Selection[] };

export function TrainingTemplatesClient({ templates, workouts }: { templates: Template[]; workouts: Workout[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [workoutId, setWorkoutId] = useState(workouts[0]?.id ?? 0);
  const [weekdays, setWeekdays] = useState<number[]>([0]);
  const [notesOpen, setNotesOpen] = useState(false);
  const nextKey = useRef(0);
  const inFlight = useRef(false);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!draft) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [draft]);

  function edit(template?: Template) {
    if (draft && !window.confirm('Discard your unsaved template changes?')) return;
    const routine = parseTemplateRoutine(template?.routineJson);
    setDraft({ id: template?.id, name: template?.name ?? '', summary: template?.summary ?? '', entries: routine?.entries.map(entry => ({ key: nextKey.current++, weekday: entry.weekday, workoutId: entry.workoutId })) ?? [] });
    setNotice(null);
    setNotesOpen(false);
    requestAnimationFrame(() => { editorHeading.current?.focus(); editorHeading.current?.scrollIntoView({ block: 'nearest' }); });
  }

  async function mutate(path: string, method: string, body?: unknown) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setNotice(null);
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Could not save your changes. Try again.');
      if (method === 'PATCH' || (method === 'POST' && body)) setDraft(null);
      setNotice({ text: method === 'DELETE' ? 'Template deleted. Calendar sessions are kept.' : path.endsWith('/duplicate') ? 'Template duplicated.' : 'Template saved. Choose a week or month in Calendar to apply it.', error: false });
      router.refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Could not reach the server. Your changes are kept here; try again.', error: true });
    } finally { inFlight.current = false; setBusy(false); }
  }

  function move(key: number, direction: number) {
    if (!draft) return;
    const entry = draft.entries.find(item => item.key === key)!;
    const siblings = draft.entries.filter(item => item.weekday === entry.weekday);
    const neighbor = siblings[siblings.indexOf(entry) + direction];
    if (!neighbor) return;
    const entries = [...draft.entries];
    const from = entries.indexOf(entry), to = entries.indexOf(neighbor);
    [entries[from], entries[to]] = [entries[to], entries[from]];
    setDraft({ ...draft, entries });
  }

  const visible = templates.filter(template => `${template.name} ${template.summary ?? ''}`.toLowerCase().includes(filter.toLowerCase().trim()));
  return <div className="space-y-6">
    {notice && !draft && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? dangerTextClassName : successTextClassName}>{notice.text}</p>}
    {draft ? <Surface className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={editorHeading} tabIndex={-1} className="text-lg font-semibold">{draft.id ? 'Edit training template' : 'New training template'}</h2>
        <button type="button" disabled={busy} className={`${secondaryButtonClassName} max-md:min-h-11`} onClick={() => { if (window.confirm('Discard your unsaved template changes?')) setDraft(null); }}>Cancel</button>
      </div>
      <fieldset disabled={busy} className="space-y-6 min-w-0">
        <div className="space-y-3">
          <label className="block max-w-xl space-y-2"><span className={formLabelClassName}>Template name</span><input autoComplete="off" maxLength={160} value={draft.name} className={formFieldClassName} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Easy running and intervals" /></label>
          <details open={notesOpen} onToggle={event => setNotesOpen(event.currentTarget.open)}>
            <summary className={`-ml-2 inline-flex min-h-9 cursor-pointer list-none items-center rounded-lg px-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)] max-md:min-h-11 [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}><span className="underline decoration-[var(--border)] underline-offset-4">Purpose or notes (optional)</span>{!notesOpen && draft.summary.trim() ? <span className="ml-1.5 font-normal text-[var(--text-muted)]">· Added</span> : null}</summary>
            <label className="mt-2 block max-w-xl"><span className="sr-only">Purpose or notes (optional)</span><textarea maxLength={2000} value={draft.summary} rows={2} className={formFieldClassName} onChange={event => setDraft({ ...draft, summary: event.target.value })} placeholder="A relaxed base week with two interval days" /></label>
          </details>
        </div>
        {workouts.length ? <div className="space-y-4 border-y border-[var(--border)] py-5">
          <h3 className="font-semibold">Add a saved workout</h3>
          <label className="block space-y-2"><span className={formLabelClassName}>Workout</span><select className={formSelectClassName} value={workoutId} onChange={event => setWorkoutId(Number(event.target.value))}>{workouts.map(workout => <option key={workout.id} value={workout.id}>{workout.title}&nbsp;· {getSportLabel(workout.sport)}&nbsp;· {formatDuration(workout.durationSec)}</option>)}</select></label>
          <fieldset className="space-y-2"><legend className={formLabelClassName}>Days for this workout</legend><div className="flex flex-wrap gap-3">{ROUTINE_DAYS.map((day, weekday) => <label key={day} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={weekdays.includes(weekday)} onChange={event => setWeekdays(current => event.target.checked ? [...current, weekday].sort() : current.filter(value => value !== weekday))} />{day}</label>)}</div></fieldset>
          <button type="button" disabled={!weekdays.length || draft.entries.length + weekdays.length > 70} className={`${secondaryButtonClassName} max-md:min-h-11`} onClick={() => setDraft({ ...draft, entries: [...draft.entries, ...weekdays.map(weekday => ({ key: nextKey.current++, weekday, workoutId }))] })}><Plus size={16} />Add to {weekdays.length || 'selected'} {weekdays.length === 1 ? 'day' : 'days'}</button>
        </div> : <EmptyState title="Save a workout first" description="Templates use workouts from your library. Create your easy session and intervals there, then group them here." action={<div className="max-md:[&>a]:min-h-11"><ActionLink href="/athlete/workouts">Open Workouts</ActionLink></div>} />}
        <div className="space-y-2">
          <h3 className="font-semibold">Your weekly routine</h3>
          <p role="status" aria-live="polite" className="text-sm text-[var(--text-secondary)]">{draft.entries.length} sessions per week. Days without workouts leave the calendar unchanged.</p>
          <div className="divide-y divide-[var(--border)]">{ROUTINE_DAYS.map((day, weekday) => {
            const entries = draft.entries.filter(entry => entry.weekday === weekday);
            return <section key={day} className="grid gap-3 py-4 md:grid-cols-[120px_minmax(0,1fr)]"><h4 className="text-sm font-semibold">{day}</h4><div className="min-w-0 space-y-3">{entries.length ? entries.map((entry, index) => {
              const workout = workouts.find(item => item.id === entry.workoutId);
              return <div key={entry.key} className="flex flex-wrap items-center gap-2">
                <label className="min-w-0 flex-1 basis-40"><span className="sr-only">{day} workout {index + 1}</span><select className={formSelectClassName} value={entry.workoutId} onChange={event => setDraft({ ...draft, entries: draft.entries.map(item => item.key === entry.key ? { ...item, workoutId: Number(event.target.value) } : item) })}>{!workout && <option value={entry.workoutId}>Unavailable workout — choose a replacement</option>}{workouts.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                <div className="flex w-full justify-end gap-1 sm:w-auto">{entries.length > 1 && <><button type="button" aria-label={`Move ${day} workout ${index + 1} earlier`} disabled={index === 0} className={`${compactSecondaryButtonClassName} max-md:min-h-11 max-md:min-w-11`} onClick={() => move(entry.key, -1)}><ArrowUp size={16} /></button><button type="button" aria-label={`Move ${day} workout ${index + 1} later`} disabled={index === entries.length - 1} className={`${compactSecondaryButtonClassName} max-md:min-h-11 max-md:min-w-11`} onClick={() => move(entry.key, 1)}><ArrowDown size={16} /></button></>}<button type="button" aria-label={`Remove ${day} workout ${index + 1}`} className={`${compactDangerButtonClassName} max-md:min-h-11 max-md:min-w-11`} onClick={() => setDraft({ ...draft, entries: draft.entries.filter(item => item.key !== entry.key) })}><Trash2 size={16} /></button></div>
              </div>;
            }) : <p className="text-sm text-[var(--text-muted)]">No workout</p>}</div></section>;
          })}</div>
        </div>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">Saving captures the selected workouts as they are now. Profile-based pace, power and heart-rate targets stay relative; fixed targets stay fixed. Later library edits do not change this template or sessions already scheduled.</p>
        {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? dangerTextClassName : successTextClassName}>{notice.text}</p>}
        <button type="button" disabled={!draft.name.trim() || !draft.entries.length || draft.entries.some(entry => !workouts.some(workout => workout.id === entry.workoutId))} className={`${primaryButtonClassName} max-md:min-h-11`} onClick={() => void mutate(draft.id ? `/api/athlete/templates/${draft.id}` : '/api/athlete/templates', draft.id ? 'PATCH' : 'POST', { name: draft.name, summary: draft.summary, entries: draft.entries.map(({ weekday, workoutId }) => ({ weekday, workoutId })) })}>{busy ? 'Saving…' : 'Save template'}</button>
      </fieldset>
    </Surface> : <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{templates.length ? <SearchField label="Search templates" labelClassName="flex-1 sm:max-w-md" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search templates" /> : null}<button type="button" disabled={busy} className={`${primaryButtonClassName} max-md:min-h-11`} onClick={() => edit()}>New template</button></div>}
    {!draft && (visible.length ? <div className="space-y-4">{visible.map(template => {
      const routine = parseTemplateRoutine(template.routineJson);
      const filledDays = routine ? ROUTINE_DAYS.flatMap((day, weekday) => {
        const titles = routine.entries.filter(entry => entry.weekday === weekday).map(entry => entry.title);
        return titles.length ? [{ day, titles }] : [];
      }) : [];
      return <Surface key={template.id} className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold break-words"><button type="button" disabled={busy} aria-label={`Edit ${template.name}`} className={`rounded-sm text-left underline-offset-4 max-md:min-h-11 control-hover:text-[var(--brand)] control-hover:underline disabled:opacity-60 ${buttonFocusClassName}`} onClick={() => edit(template)}>{template.name}</button></h2>
            {template.summary && <p className="text-sm leading-6 text-[var(--text-secondary)] break-words">{template.summary}</p>}
            <p className="text-sm text-[var(--text-muted)]">{routine ? `${routine.entries.length} ${routine.entries.length === 1 ? 'session' : 'sessions'} per week` : 'Invalid routine — edit and save again'}</p>
          </div>
          <Menu>
            <OverflowMenuTrigger disabled={busy} aria-label={`More actions for ${template.name}`} />
            <MenuContent align="end">
              <MenuItem onSelect={() => void mutate(`/api/athlete/templates/${template.id}/duplicate`, 'POST')}>
                <Copy aria-hidden="true" size={16} strokeWidth={1.8} />
                Duplicate
              </MenuItem>
              <MenuSeparator />
              <MenuItem destructive onSelect={() => { if (window.confirm(`Delete “${template.name}”? Sessions already on your calendar will remain.`)) void mutate(`/api/athlete/templates/${template.id}`, 'DELETE'); }}>
                <Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />
                Delete…
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        {filledDays.length ? <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">{filledDays.map(({ day, titles }) => <div key={day} className="flex min-w-0 gap-3 text-sm"><dt className="w-24 shrink-0 text-[var(--text-secondary)]">{day}</dt><dd className="break-words min-w-0">{titles.join(', ')}</dd></div>)}</dl> : null}
        <div className="max-md:[&>a]:min-h-11"><ActionLink href={getCalendarPlacementHref(`template:${template.id}`)} size="compact">Apply to Calendar</ActionLink></div>
      </Surface>;
    })}</div> : <EmptyState title={templates.length ? 'No matching templates' : 'Build your first training routine'} description={templates.length ? 'Try a different search.' : 'Put saved workouts on the days you train. Days left empty add nothing when you apply it.'} />)}
  </div>;
}
