'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { ActionLink, Surface, EmptyState, primaryButtonClassName, secondaryButtonClassName, compactSecondaryButtonClassName, compactDangerButtonClassName, formFieldClassName, formLabelClassName, formSelectClassName, dangerTextClassName, successTextClassName } from '@/components/ui';
import { parseTemplateRoutine, ROUTINE_DAYS } from '@/lib/template-routine';
import { getSportLabel } from '@/lib/sport';
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
    <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Group saved workouts into a Monday–Sunday routine. Apply it to one week or repeat it through a calendar month. Edit workouts in your workout library.</p>
    {notice && !draft && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? dangerTextClassName : successTextClassName}>{notice.text}</p>}
    {draft ? <Surface className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={editorHeading} tabIndex={-1} className="text-lg font-semibold">{draft.id ? 'Edit training template' : 'New training template'}</h2>
        <button type="button" disabled={busy} className={secondaryButtonClassName} onClick={() => { if (window.confirm('Discard your unsaved template changes?')) setDraft(null); }}>Cancel</button>
      </div>
      <fieldset disabled={busy} className="space-y-6 min-w-0">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2"><span className={formLabelClassName}>Template name</span><input autoComplete="off" maxLength={160} value={draft.name} className={formFieldClassName} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Easy running and intervals" /></label>
          <label className="space-y-2"><span className={formLabelClassName}>Purpose or notes (optional)</span><textarea maxLength={2000} value={draft.summary} rows={2} className={formFieldClassName} onChange={event => setDraft({ ...draft, summary: event.target.value })} placeholder="A relaxed base week with two interval days" /></label>
        </div>
        {workouts.length ? <div className="space-y-4 border-y border-[var(--border)] py-5">
          <h3 className="font-semibold">Add a saved workout</h3>
          <label className="block space-y-2"><span className={formLabelClassName}>Workout</span><select className={formSelectClassName} value={workoutId} onChange={event => setWorkoutId(Number(event.target.value))}>{workouts.map(workout => <option key={workout.id} value={workout.id}>{workout.title} · {getSportLabel(workout.sport)} · {formatDuration(workout.durationSec)}</option>)}</select></label>
          <fieldset className="space-y-2"><legend className={formLabelClassName}>Days for this workout</legend><div className="flex flex-wrap gap-3">{ROUTINE_DAYS.map((day, weekday) => <label key={day} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={weekdays.includes(weekday)} onChange={event => setWeekdays(current => event.target.checked ? [...current, weekday].sort() : current.filter(value => value !== weekday))} />{day}</label>)}</div></fieldset>
          <button type="button" disabled={!weekdays.length || draft.entries.length + weekdays.length > 70} className={`${secondaryButtonClassName} gap-2`} onClick={() => setDraft({ ...draft, entries: [...draft.entries, ...weekdays.map(weekday => ({ key: nextKey.current++, weekday, workoutId }))] })}><Plus size={16} />Add to {weekdays.length || 'selected'} {weekdays.length === 1 ? 'day' : 'days'}</button>
        </div> : <EmptyState title="Save a workout first" description="Templates use workouts from your library. Create your easy session and intervals there, then group them here." action={<ActionLink href="/athlete/workouts">Open Workouts</ActionLink>} />}
        <div className="space-y-2">
          <h3 className="font-semibold">Your weekly routine</h3>
          <p role="status" aria-live="polite" className="text-sm text-[var(--text-secondary)]">{draft.entries.length} sessions per week. Days without workouts leave the calendar unchanged.</p>
          <div className="divide-y divide-[var(--border)]">{ROUTINE_DAYS.map((day, weekday) => {
            const entries = draft.entries.filter(entry => entry.weekday === weekday);
            return <section key={day} className="grid gap-3 py-4 md:grid-cols-[120px_minmax(0,1fr)]"><h4 className="text-sm font-semibold">{day}</h4><div className="min-w-0 space-y-3">{entries.length ? entries.map((entry, index) => {
              const workout = workouts.find(item => item.id === entry.workoutId);
              return <div key={entry.key} className="flex flex-wrap items-center gap-2">
                <label className="min-w-0 flex-1 basis-40"><span className="sr-only">{day} workout {index + 1}</span><select className={formSelectClassName} value={entry.workoutId} onChange={event => setDraft({ ...draft, entries: draft.entries.map(item => item.key === entry.key ? { ...item, workoutId: Number(event.target.value) } : item) })}>{!workout && <option value={entry.workoutId}>Unavailable workout — choose a replacement</option>}{workouts.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                <div className="flex w-full justify-end gap-1 sm:w-auto">{entries.length > 1 && <><button type="button" aria-label={`Move ${day} workout ${index + 1} earlier`} disabled={index === 0} className={compactSecondaryButtonClassName} onClick={() => move(entry.key, -1)}><ArrowUp size={16} /></button><button type="button" aria-label={`Move ${day} workout ${index + 1} later`} disabled={index === entries.length - 1} className={compactSecondaryButtonClassName} onClick={() => move(entry.key, 1)}><ArrowDown size={16} /></button></>}<button type="button" aria-label={`Remove ${day} workout ${index + 1}`} className={compactDangerButtonClassName} onClick={() => setDraft({ ...draft, entries: draft.entries.filter(item => item.key !== entry.key) })}><Trash2 size={16} /></button></div>
              </div>;
            }) : <p className="text-sm text-[var(--text-muted)]">No workout</p>}</div></section>;
          })}</div>
        </div>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">Saving captures the selected workouts as they are now. Profile-based pace, power and heart-rate targets stay relative; fixed targets stay fixed. Later library edits do not change this template or sessions already scheduled.</p>
        {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? dangerTextClassName : successTextClassName}>{notice.text}</p>}
        <button type="button" disabled={!draft.name.trim() || !draft.entries.length || draft.entries.some(entry => !workouts.some(workout => workout.id === entry.workoutId))} className={primaryButtonClassName} onClick={() => void mutate(draft.id ? `/api/athlete/templates/${draft.id}` : '/api/athlete/templates', draft.id ? 'PATCH' : 'POST', { name: draft.name, summary: draft.summary, entries: draft.entries.map(({ weekday, workoutId }) => ({ weekday, workoutId })) })}>{busy ? 'Saving…' : 'Save template'}</button>
      </fieldset>
    </Surface> : <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className="flex-1"><span className="sr-only">Search templates</span><input type="search" value={filter} onChange={event => setFilter(event.target.value)} className={formFieldClassName} placeholder="Search templates" /></label><button type="button" disabled={busy} className={primaryButtonClassName} onClick={() => edit()}>New template</button></div>}
    {!draft && (visible.length ? <div className="space-y-4">{visible.map(template => {
      const routine = parseTemplateRoutine(template.routineJson);
      return <Surface key={template.id} className="space-y-4">
        <div className="space-y-2"><h2 className="text-lg font-semibold break-words">{template.name}</h2>{template.summary && <p className="text-sm leading-6 text-[var(--text-secondary)] break-words">{template.summary}</p>}<p className="text-sm text-[var(--text-muted)]">{routine ? `${routine.entries.length} sessions per week · Apply to a week or month` : 'Invalid routine — edit and save again'}</p></div>
        {routine && <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">{ROUTINE_DAYS.map((day, weekday) => <div key={day} className="flex min-w-0 gap-3 text-sm"><dt className="w-24 shrink-0 text-[var(--text-secondary)]">{day}</dt><dd className="break-words min-w-0">{routine.entries.filter(entry => entry.weekday === weekday).map(entry => entry.title).join(', ') || 'No workout'}</dd></div>)}</dl>}
        <div className="flex flex-wrap gap-3"><ActionLink href={`/athlete/planner?source=template:${template.id}`} size="compact">Apply to Calendar</ActionLink><button type="button" disabled={busy} className={compactSecondaryButtonClassName} onClick={() => edit(template)}>Edit routine</button><details><summary className={`${compactSecondaryButtonClassName} list-none`}>More actions</summary><div className="flex flex-wrap gap-2 pt-2"><button type="button" disabled={busy} className={compactSecondaryButtonClassName} onClick={() => void mutate(`/api/athlete/templates/${template.id}/duplicate`, 'POST')}>Duplicate</button><button type="button" disabled={busy} className={compactDangerButtonClassName} onClick={() => { if (window.confirm(`Delete “${template.name}”? Sessions already on your calendar will remain.`)) void mutate(`/api/athlete/templates/${template.id}`, 'DELETE'); }}>Delete</button></div></details></div>
      </Surface>;
    })}</div> : <EmptyState title={templates.length ? 'No matching templates' : 'Build your first training routine'} description={templates.length ? 'Try a different search.' : 'Add your easy workout on Monday, Wednesday and Friday, then your intervals on Tuesday and Thursday. Apply the finished routine in Calendar.'} />)}
  </div>;
}
