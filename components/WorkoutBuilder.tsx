'use client';

import { useEffect, useState } from 'react';

import { updateSessionEditorFields, updateSessionEditorSchedule, type SessionEditorDraft } from '@/lib/session-editor';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { formFieldClassName, formLabelClassName, formSelectClassName, formTextareaClassName, primaryButtonClassName, secondaryButtonClassName, compactSecondaryButtonClassName } from '@/components/ui';
import { WorkoutCanvasEditor } from '@/components/WorkoutCanvasEditor';

export function WorkoutBuilder({
  draft,
  onChange,
  showSchedule = false,
  summaryPlaceholder = 'Coach notes or session intent',
  performanceProfile = null,
  profileLabel = 'current profile',
  titleLabel = 'Workout name',
  summaryLabel = 'Workout summary',
  onDetailsVisibilityChange,
}: {
  draft: SessionEditorDraft;
  onChange: (draft: SessionEditorDraft) => void;
  showSportMetrics?: boolean;
  showSchedule?: boolean;
  summaryPlaceholder?: string;
  durationUnit?: 'minutes' | 'seconds';
  performanceProfile?: PerformanceProfile | null;
  profileLabel?: string;
  titleLabel?: string;
  summaryLabel?: string;
  onDetailsVisibilityChange?: (visible: boolean) => void;
}) {
  const [basicsDismissed, setBasicsDismissed] = useState(() => Boolean(draft.id || draft.blocks.length));
  const [basicsEditing, setBasicsEditing] = useState(false);
  const [notesOpen, setNotesOpen] = useState(() => Boolean(draft.summary));
  const basicsReady = Boolean(draft.title.trim() && draft.sport);
  const itemNoun = titleLabel === 'Template name' ? 'template' : 'workout';

  useEffect(() => {
    onDetailsVisibilityChange?.(basicsDismissed);
  }, [basicsDismissed, onDetailsVisibilityChange]);

  return <section className="min-w-0 space-y-4" aria-label="Visual workout builder">
    {!basicsDismissed || !basicsReady ? <div className="mx-auto w-full max-w-[46rem] space-y-5 rounded-[3px] border border-[var(--field-selected-border)] bg-[var(--brand-tint)] p-5 shadow-[var(--shadow-inset)] sm:p-6" aria-labelledby="workout-basics-heading">
      <div><h2 id="workout-basics-heading" className="text-xl font-medium tracking-[-0.02em] text-[var(--text)]">Start with the basics</h2><p className="mt-2 max-w-[52ch] text-sm leading-6 text-[var(--text-secondary)]">Give this {itemNoun} a clear name and choose its sport. Then build on the complete session chart.</p></div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.45fr)_minmax(12rem,0.55fr)]">
        <label className="block space-y-2"><span className={formLabelClassName}>{titleLabel}</span><input autoFocus={!draft.title.trim()} className={formFieldClassName} value={draft.title} onChange={(event) => onChange(updateSessionEditorFields(draft, { title: event.target.value }))} placeholder={titleLabel === 'Template name' ? 'e.g. Base week' : 'e.g. Tuesday threshold'} /></label>
        <label className="block space-y-2"><span className={formLabelClassName}>Sport</span><select className={formSelectClassName} value={draft.sport} onChange={(event) => onChange(updateSessionEditorFields(draft, { sport: event.target.value }))}>{SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}</select></label>
      </div>
      <div className="flex flex-col gap-3 border-t border-[var(--field-selected-border)] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-[38ch] text-xs leading-5 text-[var(--text-secondary)]">Next, drag intensity blocks into the chart and adjust each duration.</p><button type="button" className={`${primaryButtonClassName} w-full sm:w-auto`} disabled={!basicsReady} onClick={() => setBasicsDismissed(true)}>Continue to workout details</button></div>
    </div> : basicsEditing ? <div className="grid gap-3 border-b border-[var(--border)] pb-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.55fr)_auto] sm:items-end" aria-label="Edit workout basics">
      <label className="block space-y-2"><span className={formLabelClassName}>{titleLabel}</span><input autoFocus className={formFieldClassName} value={draft.title} onChange={(event) => { const title = event.target.value; if (!title.trim()) setBasicsDismissed(false); onChange(updateSessionEditorFields(draft, { title })); }} /></label>
      <label className="block space-y-2"><span className={formLabelClassName}>Sport</span><select className={formSelectClassName} value={draft.sport} onChange={(event) => onChange(updateSessionEditorFields(draft, { sport: event.target.value }))}>{SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}</select></label>
      <button type="button" className={`${secondaryButtonClassName} w-full sm:w-auto`} disabled={!basicsReady} onClick={() => setBasicsEditing(false)}>Done</button>
    </div> : <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3" aria-label="Workout basics"><div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="min-w-0 break-words text-base font-semibold text-[var(--text)]">{draft.title}</h2><span className="text-sm text-[var(--text-secondary)]">{getSportLabel(draft.sport)}</span></div><button type="button" className={compactSecondaryButtonClassName} onClick={() => setBasicsEditing(true)}>Edit basics</button></div>}

    {basicsDismissed && basicsReady ? <>
      <details open={notesOpen || Boolean(draft.summary)} onToggle={(event) => setNotesOpen(event.currentTarget.open)}><summary className="inline-flex min-h-9 cursor-pointer list-none items-center text-sm font-medium text-[var(--text-secondary)] underline decoration-[var(--border)] underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">{summaryLabel}</summary><label className="mt-3 block space-y-2"><span className="sr-only">{summaryLabel}</span><textarea className={formTextareaClassName} value={draft.summary} placeholder={summaryPlaceholder} onChange={(event) => onChange(updateSessionEditorFields(draft, { summary: event.target.value }))} /></label></details>
      {showSchedule ? <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-2"><span className={formLabelClassName}>Scheduled date</span><input className={formFieldClassName} type="date" value={draft.scheduledDate ?? ''} onChange={(event) => onChange(updateSessionEditorSchedule(draft, { scheduledDate: event.target.value || null }))} /></label><label className="block space-y-2"><span className={formLabelClassName}>Time</span><input className={formFieldClassName} type="time" value={draft.timeLabel ?? ''} onChange={(event) => onChange(updateSessionEditorSchedule(draft, { timeLabel: event.target.value || null }))} /></label></div> : null}
      <WorkoutCanvasEditor draft={draft} onChange={onChange} performanceProfile={performanceProfile} profileLabel={profileLabel} />
    </> : null}
  </section>;
}
