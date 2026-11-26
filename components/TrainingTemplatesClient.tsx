'use client';

import { AlertDialog } from '@ui-sdk/react/alert-dialog';
import { ConfirmationDialogContent } from '@/components/tempobuilder/ConfirmationDialogContent';
import { SearchField } from '@/components/tempobuilder/SearchField';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Copy, Plus, Repeat2, Trash2 } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuSeparator, OverflowMenuTrigger } from '@/components/tempobuilder/Menu';
import { sectionHeadingClassName, ActionLink, buttonFocusClassName, Surface, EmptyState, primaryButtonClassName, secondaryButtonClassName, compactSecondaryButtonClassName, compactDangerButtonClassName, formFieldClassName, formLabelClassName, ghostButtonClassName, dangerTextClassName, successTextClassName, formTextareaClassName } from '@/components/ui';
import { PlanWorkoutDialog, type PlanWorkoutRequest } from '@/components/PlanWorkoutDialog';
import { SportBadge } from '@/components/tempobuilder/SportBadge';
import { BuiltInTrainingPlans } from '@/components/BuiltInTrainingPlans';
import { selectPlanWorkouts, type BuiltInPlanPreview } from '@/lib/plan-catalog/selection';
import { ROUTINE_DAYS, type RoutineSelection } from '@/lib/template-routine';
import { getCalendarPlacementHref } from '@/lib/calendar-navigation';
import { formatDuration } from '@/lib/format-duration';
import type { AddableWorkout } from '@/lib/placement-options';

type PlanEntry = RoutineSelection & { title: string; sport: string };
type Template = { id: number; name: string; summary: string | null; entries: PlanEntry[] | null };
type Selection = { key: number; weekday: number; workoutValue: string; sport: string; title: string };
type Confirmation = { kind: 'discard' } | { kind: 'delete'; template: Template };
type Draft = { id?: number; catalogPlanSlug?: string; name: string; summary: string; entries: Selection[] };

/** A plan holds at most this many workouts a week (the template contract). */
const MAX_PLAN_ENTRIES = 70;

export function TrainingTemplatesClient({ templates, workouts, builtInPlans, openPlanSlug }: {
  templates: Template[];
  /** Saved and public workouts, keyed `workout:<id>` / `catalog:<slug>`. */
  workouts: AddableWorkout[];
  builtInPlans: BuiltInPlanPreview[];
  openPlanSlug: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openedDraft, setOpenedDraft] = useState<Draft | null>(null);
  // Every edit replaces the draft object, so identity tells whether anything changed.
  const dirty = draft !== null && draft !== openedDraft;
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const confirmationTrigger = useRef<HTMLElement | null>(null);
  const newTemplateButton = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [picker, setPicker] = useState<PlanWorkoutRequest | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const nextKey = useRef(0);
  const inFlight = useRef(false);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const byKey = new Map(workouts.map(item => [item.key, item]));

  function openDraft(nextDraft: Omit<Draft, 'entries'>, entries: PlanEntry[]) {
    const opened: Draft = {
      ...nextDraft,
      entries: entries.map(({ weekday, title, sport, workoutId, catalogWorkoutSlug }) => ({
        key: nextKey.current++, weekday, title, sport,
        workoutValue: workoutId === undefined ? `catalog:${catalogWorkoutSlug}` : `workout:${workoutId}`,
      })),
    };
    setDraft(opened);
    setOpenedDraft(opened);
    setNotice(null);
    setNotesOpen(false);
    setPicker(null);
    requestAnimationFrame(() => { editorHeading.current?.focus(); editorHeading.current?.scrollIntoView({ block: 'nearest' }); });
  }

  function edit(template?: Template) {
    openDraft({ id: template?.id, name: template?.name ?? '', summary: template?.summary ?? '' }, template?.entries ?? []);
  }

  function customize(plan: BuiltInPlanPreview) {
    openDraft(
      { name: `${plan.name} (my version)`, summary: '', catalogPlanSlug: plan.slug },
      selectPlanWorkouts(plan.slots, {}).map(({ weekday, option }) => ({
        weekday, title: option.title, sport: option.sport, catalogWorkoutSlug: option.id,
      })),
    );
  }

  async function mutate(path: string, method: string, body?: unknown) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setNotice(null);
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Could not save your changes. Try again.');
      if (method === 'DELETE') {
        confirmationTrigger.current = null;
        setConfirmationOpen(false);
      }
      if (method === 'PATCH' || (method === 'POST' && body)) setDraft(null);
      setNotice({ text: method === 'DELETE' ? 'Training plan deleted. Workouts already on your Calendar stay.' : path.endsWith('/duplicate') ? 'Training plan copied.' : 'Training plan saved. Use Add to Calendar to put it on your weeks.', error: false });
      router.refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Could not reach TempoBuilder. Your changes are still here. Try again.', error: true });
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
    {notice && !draft && !confirmationOpen && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? dangerTextClassName : successTextClassName}>{notice.text}</p>}
    {!draft && <BuiltInTrainingPlans openSlug={openPlanSlug} plans={builtInPlans} onCustomize={customize} busy={busy} />}
    {!draft && <h2 className={sectionHeadingClassName}>My training plans</h2>}
    {draft ? <Surface className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={editorHeading} tabIndex={-1} className={sectionHeadingClassName}>{draft.id ? 'Edit training plan' : 'New training plan'}</h2>
        <button type="button" disabled={busy} className={`${secondaryButtonClassName} max-md:min-h-11`} onClick={(event) => {
          if (!dirty) { setDraft(null); return; }
          confirmationTrigger.current = event.currentTarget;
          setConfirmation({ kind: 'discard' });
          setConfirmationOpen(true);
        }}>Cancel</button>
      </div>
      {draft.catalogPlanSlug && <p className="text-sm text-[var(--text-secondary)]">Changes here apply only to your copy.</p>}
      <fieldset disabled={busy} className="space-y-6 min-w-0">
        <div className="space-y-3">
          <label className="block max-w-xl space-y-2"><span className={formLabelClassName}>Training plan name</span><input autoComplete="off" maxLength={160} value={draft.name} className={formFieldClassName} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Easy running and intervals" /></label>
          <details open={notesOpen} onToggle={event => setNotesOpen(event.currentTarget.open)}>
            <summary className={`-ml-2 inline-flex min-h-9 cursor-pointer list-none items-center rounded-lg px-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)] max-md:min-h-11 [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}><span className="underline decoration-[var(--border)] underline-offset-4">Purpose or notes (optional)</span>{!notesOpen && draft.summary.trim() ? <span className="ml-1.5 font-normal text-[var(--text-muted)]">Added</span> : null}</summary>
            <label className="mt-2 block max-w-xl"><span className="sr-only">Purpose or notes (optional)</span><textarea maxLength={2000} value={draft.summary} rows={2} className={formTextareaClassName} onChange={event => setDraft({ ...draft, summary: event.target.value })} placeholder="A relaxed base week with two interval days" /></label>
          </details>
        </div>
        <div className="space-y-3 border-t border-[var(--border)] pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h3 className="font-semibold">Your weekly plan</h3>
              <p role="status" aria-live="polite" className="text-sm text-[var(--text-secondary)]">{draft.entries.length} {draft.entries.length === 1 ? 'workout' : 'workouts'} a week. Days without workouts stay empty on your Calendar.</p>
            </div>
            <button type="button" disabled={draft.entries.length >= MAX_PLAN_ENTRIES} className={`${secondaryButtonClassName} max-md:min-h-11`} onClick={() => setPicker({ kind: 'add', weekdays: [] })}><Plus aria-hidden="true" size={16} />Add a workout</button>
          </div>
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{ROUTINE_DAYS.map((day, weekday) => {
            const entries = draft.entries.filter(entry => entry.weekday === weekday);
            return <section key={day} aria-label={day} className="grid gap-2 py-3 md:grid-cols-[120px_minmax(0,1fr)] md:gap-3">
              <h4 className="text-sm font-semibold md:pt-2">{day}</h4>
              <div className="min-w-0 space-y-2">
                {entries.map((entry, index) => {
                  const workout = byKey.get(entry.workoutValue);
                  return <div key={entry.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{entry.title}{workout ? null : <span className="font-normal text-[var(--status-warning)]"> (unavailable, change it)</span>}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
                        <SportBadge sport={entry.sport} />
                        {workout ? <span className="data">{formatDuration(workout.durationSec)}{workout.tss === null ? '' : ` · ${workout.tss} TSS`}</span> : null}
                        {workout?.focus ? <span className="truncate">{workout.focus}</span> : null}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" aria-label={`Change ${day} workout ${index + 1}: ${entry.title}`} className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => setPicker({ kind: 'replace', weekday, currentKey: entry.workoutValue, entryKey: entry.key })}><Repeat2 aria-hidden="true" size={16} /><span className="max-sm:sr-only">Change</span></button>
                      {entries.length > 1 && <><button type="button" aria-label={`Move ${day} workout ${index + 1} earlier`} disabled={index === 0} className={`${compactSecondaryButtonClassName} max-md:min-h-11 max-md:min-w-11`} onClick={() => move(entry.key, -1)}><ArrowUp size={16} /></button><button type="button" aria-label={`Move ${day} workout ${index + 1} later`} disabled={index === entries.length - 1} className={`${compactSecondaryButtonClassName} max-md:min-h-11 max-md:min-w-11`} onClick={() => move(entry.key, 1)}><ArrowDown size={16} /></button></>}
                      <button type="button" aria-label={`Remove ${day} workout ${index + 1}`} className={`${compactDangerButtonClassName} max-md:min-h-11 max-md:min-w-11`} onClick={() => setDraft({ ...draft, entries: draft.entries.filter(item => item.key !== entry.key) })}><Trash2 size={16} /></button>
                    </div>
                  </div>;
                })}
                <div className="flex flex-wrap items-center gap-x-3">
                  {entries.length ? null : <p className="text-sm text-[var(--text-muted)]">No workout</p>}
                  <button type="button" disabled={draft.entries.length >= MAX_PLAN_ENTRIES} aria-label={`Add a workout on ${day}`} className={`${ghostButtonClassName('compact')} ${entries.length ? '-ml-2' : ''} max-md:min-h-11`} onClick={() => setPicker({ kind: 'add', weekdays: [weekday] })}>
                    <Plus aria-hidden="true" size={14} strokeWidth={1.8} />{entries.length ? 'Add another' : 'Add workout'}
                  </button>
                </div>
              </div>
            </section>;
          })}</div>
        </div>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">Saving copies these workouts as they are now. Targets based on your Profile (pace, power, heart rate) update with it; fixed targets stay fixed. Editing a workout later doesn’t change this training plan or workouts already on your Calendar.</p>
        {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? dangerTextClassName : successTextClassName}>{notice.text}</p>}
        <button type="button" disabled={!draft.name.trim() || !draft.entries.length || draft.entries.some(entry => !byKey.has(entry.workoutValue))} className={`${primaryButtonClassName} max-md:min-h-11`} onClick={() => void mutate(
          draft.id ? `/api/athlete/templates/${draft.id}` : '/api/athlete/templates',
          draft.id ? 'PATCH' : 'POST',
          {
            name: draft.name,
            summary: draft.summary,
            catalogPlanSlug: draft.catalogPlanSlug,
            entries: draft.entries.map(({ weekday, workoutValue }) => workoutValue.startsWith('workout:')
              ? { weekday, workoutId: Number(workoutValue.slice('workout:'.length)) }
              : { weekday, catalogWorkoutSlug: workoutValue.slice('catalog:'.length) }),
          },
        )}>{busy ? 'Saving…' : 'Save training plan'}</button>
      </fieldset>
    </Surface> : <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{templates.length ? <SearchField label="Search training plans" labelClassName="flex-1 sm:max-w-md" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search training plans" /> : null}<button type="button" disabled={busy} className={`${primaryButtonClassName} max-md:min-h-11`} ref={newTemplateButton} onClick={() => edit()}>New training plan</button></div>}
    {!draft && (visible.length ? <div className="space-y-4">{visible.map(template => {
      const filledDays = template.entries ? ROUTINE_DAYS.flatMap((day, weekday) => {
        const titles = template.entries?.filter(entry => entry.weekday === weekday).map(entry => entry.title) ?? [];
        return titles.length ? [{ day, titles }] : [];
      }) : [];
      return <Surface key={template.id} className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className={`break-words ${sectionHeadingClassName}`}><button type="button" disabled={busy} aria-label={`Edit ${template.name}`} className={`rounded-sm text-left underline-offset-4 max-md:min-h-11 control-hover:text-[var(--brand)] control-hover:underline disabled:opacity-60 ${buttonFocusClassName}`} onClick={() => edit(template)}>{template.name}</button></h2>
            {template.summary && <p className="text-sm leading-6 text-[var(--text-secondary)] break-words">{template.summary}</p>}
            <p className="text-sm text-[var(--text-muted)]">{template.entries ? `${template.entries.length} ${template.entries.length === 1 ? 'workout' : 'workouts'} a week` : 'This training plan can’t be read. Edit it and save again.'}</p>
          </div>
          <Menu>
            <OverflowMenuTrigger id={`template-menu-${template.id}`} disabled={busy} aria-label={`More actions for ${template.name}`} />
            <MenuContent align="end">
              <MenuItem onSelect={() => void mutate(`/api/athlete/templates/${template.id}/duplicate`, 'POST')}>
                <Copy aria-hidden="true" size={16} strokeWidth={1.8} />
                Duplicate
              </MenuItem>
              <MenuSeparator />
              <MenuItem destructive onSelect={() => {
                confirmationTrigger.current = document.getElementById(`template-menu-${template.id}`);
                setNotice(null);
                setConfirmation({ kind: 'delete', template });
                setConfirmationOpen(true);
              }}>
                <Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />
                Delete…
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        {filledDays.length ? <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">{filledDays.map(({ day, titles }) => <div key={day} className="flex min-w-0 gap-3 text-sm"><dt className="w-24 shrink-0 text-[var(--text-secondary)]">{day}</dt><dd className="break-words min-w-0">{titles.join(', ')}</dd></div>)}</dl> : null}
        <div className="max-md:[&>a]:min-h-11"><ActionLink href={getCalendarPlacementHref(`template:${template.id}`, { back: '/athlete/templates' })} size="compact">Add to Calendar<span className="sr-only">: {template.name}</span></ActionLink></div>
      </Surface>;
    })}</div> : <EmptyState title={templates.length ? 'No matching training plans' : 'Build your first training plan'} description={templates.length ? 'Try a different search.' : 'Choose workouts for the days you train. Days left empty add nothing when you apply it.'} />)}
    {draft && picker ? <PlanWorkoutDialog
      key={JSON.stringify(picker)}
      workouts={workouts}
      request={picker}
      room={MAX_PLAN_ENTRIES - draft.entries.length}
      onClose={() => setPicker(null)}
      onAdd={(workout, weekdays) => {
        const added = weekdays.map(weekday => ({ key: nextKey.current++, weekday, workoutValue: workout.key, sport: workout.sport, title: workout.title }));
        setDraft({ ...draft, entries: [...draft.entries, ...added] });
        setPicker(null);
      }}
      onReplace={(workout) => {
        if (picker.kind !== 'replace') return;
        setDraft({ ...draft, entries: draft.entries.map(item => item.key === picker.entryKey ? { ...item, workoutValue: workout.key, sport: workout.sport, title: workout.title } : item) });
        setPicker(null);
      }}
    /> : null}
    <AlertDialog open={confirmationOpen} onOpenChange={(open, details) => {
      if (busy) { details.cancel(); return; }
      setConfirmationOpen(open);
    }}>
      {confirmation?.kind === 'discard' ? (
        <ConfirmationDialogContent
          title="Discard your unsaved changes to this training plan?"
          description="Your changes will be lost."
          cancelLabel="Keep editing"
          confirmLabel="Discard changes"
          finalFocus={() => confirmationTrigger.current ?? newTemplateButton.current}
          onConfirm={() => {
            confirmationTrigger.current = null;
            setDraft(null);
            setConfirmationOpen(false);
          }}
        />
      ) : confirmation?.kind === 'delete' ? (
        <ConfirmationDialogContent
          title={`Delete “${confirmation.template.name}”?`}
          description="Workouts already on your Calendar stay."
          cancelLabel="Keep training plan"
          confirmLabel={busy ? 'Deleting…' : 'Delete training plan'}
          finalFocus={() => confirmationTrigger.current ?? newTemplateButton.current}
          pending={busy}
          error={notice?.error ? notice.text : undefined}
          onConfirm={() => void mutate(`/api/athlete/templates/${confirmation.template.id}`, 'DELETE')}
        />
      ) : null}
    </AlertDialog>
  </div>;
}
