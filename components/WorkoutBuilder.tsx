'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';

import { updateSessionEditorFields, updateSessionEditorSchedule, type SessionEditorDraft } from '@/lib/session-editor';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { buttonFocusClassName, formFieldClassName, formLabelClassName, formSelectClassName, formTextareaClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
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
  showCanvasDraftStatus = true,
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
  showCanvasDraftStatus?: boolean;
}) {
  const [basicsDismissed, setBasicsDismissed] = useState(() => Boolean(draft.id || draft.blocks.length));
  const [basicsEditing, setBasicsEditing] = useState(false);
  const [notesOpen, setNotesOpen] = useState(() => Boolean(draft.summary));
  const [pendingSport, setPendingSport] = useState<string | null>(null);
  const [targetDialogRequest, setTargetDialogRequest] = useState(0);
  const basicsReady = Boolean(draft.title.trim() && draft.sport);
  const itemNoun = titleLabel === 'Template name' ? 'template' : 'workout';

  function changeSport(sport: string) {
    if (sport === draft.sport) { setPendingSport(null); return; }
    if (draft.blocks.length) { setPendingSport(sport); return; }
    onChange(updateSessionEditorFields(draft, { sport }));
  }

  function confirmSportChange() {
    if (!pendingSport) return;
    onChange(updateSessionEditorFields({ ...draft, blocks: [], sportMetrics: { ftp: null, thresholdPaceSecPerKm: null, thresholdHr: null } }, { sport: pendingSport }));
    setPendingSport(null);
  }

  useEffect(() => {
    onDetailsVisibilityChange?.(basicsDismissed);
  }, [basicsDismissed, onDetailsVisibilityChange]);

  return <section className="min-w-0 space-y-4" aria-label="Visual workout builder">
    {!basicsDismissed || (!basicsReady && !basicsEditing) ? <div className="mx-auto w-full max-w-[46rem] space-y-5 rounded-[3px] border border-[var(--field-selected-border)] bg-[var(--brand-tint)] p-5 shadow-[var(--shadow-inset)] sm:p-6" aria-labelledby="workout-basics-heading">
      <div><h2 id="workout-basics-heading" className="text-xl font-medium tracking-[-0.02em] text-[var(--text)]">Start with the basics</h2><p className="mt-2 max-w-[52ch] text-sm leading-6 text-[var(--text-secondary)]">Give this {itemNoun} a clear name and choose its sport. <span className="hidden md:inline">Then build on the complete session chart.</span><span className="md:hidden">Then add training blocks and adjust their targets.</span></p></div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.45fr)_minmax(12rem,0.55fr)]">
        <label className="block space-y-2"><span className={formLabelClassName}>{titleLabel}</span><input autoFocus={!draft.title.trim()} className={formFieldClassName} value={draft.title} onChange={(event) => onChange(updateSessionEditorFields(draft, { title: event.target.value }))} placeholder={titleLabel === 'Template name' ? 'e.g. Base week' : 'e.g. Tuesday threshold'} /></label>
        <label className="block space-y-2"><span className={formLabelClassName}>Sport</span><select className={formSelectClassName} value={draft.sport} onChange={(event) => changeSport(event.target.value)}>{SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}</select></label>
      </div>
      <div className="flex flex-col gap-3 border-t border-[var(--field-selected-border)] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-[38ch] text-xs leading-5 text-[var(--text-secondary)]"><span className="hidden md:inline">Next, drag intensity blocks into the chart and adjust each duration.</span><span className="md:hidden">Next, tap an effort zone, then adjust its target and duration.</span></p><button type="button" className={`${primaryButtonClassName} w-full sm:w-auto`} disabled={!basicsReady} onClick={() => setBasicsDismissed(true)}>Continue to workout details</button></div>
    </div> : <div className="space-y-3 border-b border-[var(--border)] pb-3" aria-label="Workout basics">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {basicsEditing ? <input autoFocus aria-label={titleLabel} className={`${formFieldClassName} max-w-md`} value={draft.title} onChange={(event) => onChange(updateSessionEditorFields(draft, { title: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter' && basicsReady) setBasicsEditing(false); }} /> : <h2 className="min-w-0 break-words text-base font-semibold text-[var(--text)]">{draft.title}</h2>}
          <button type="button" className={`inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-[3px] text-[var(--text-secondary)] hover:bg-[var(--field-surface)] hover:text-[var(--text)] ${buttonFocusClassName}`} aria-label={basicsEditing ? 'Finish editing workout name' : `Edit ${titleLabel.toLowerCase()}`} disabled={basicsEditing && !basicsReady} onClick={() => setBasicsEditing(!basicsEditing)}><Pencil size={16} aria-hidden="true" /></button>
          <details open={notesOpen || Boolean(draft.summary)} onToggle={(event) => setNotesOpen(event.currentTarget.open)} className="min-w-[8rem] flex-1"><summary className={`inline-flex min-h-10 cursor-pointer list-none items-center text-sm font-medium text-[var(--text-secondary)] underline decoration-[var(--border)] underline-offset-4 ${buttonFocusClassName}`}>{summaryLabel}</summary><label className="block w-full space-y-2"><span className="sr-only">{summaryLabel}</span><textarea className={formTextareaClassName} value={draft.summary} placeholder={summaryPlaceholder} onChange={(event) => onChange(updateSessionEditorFields(draft, { summary: event.target.value }))} /></label></details>
        </div>
        <div className="flex flex-wrap items-center gap-2"><label className="flex min-w-[10rem] items-center gap-2 text-sm text-[var(--text-secondary)]"><span>Sport</span><select aria-label="Sport" className={`${formSelectClassName} min-w-0`} value={draft.sport} onChange={(event) => changeSport(event.target.value)}>{SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}</select></label><button type="button" className={secondaryButtonClassName} onClick={() => setTargetDialogRequest((count) => count + 1)}>Session targets</button></div>
      </div>
    </div>}

    {pendingSport ? <div role="alert" className="space-y-3 rounded-[3px] border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] p-4"><p className="text-sm font-semibold text-[var(--text)]">Change sport to {getSportLabel(pendingSport)}?</p><p className="text-sm text-[var(--text-secondary)]">This clears the {draft.blocks.length} block{draft.blocks.length === 1 ? '' : 's'} in the editor and sport-specific metrics. Your name and notes stay.</p><div className="flex flex-wrap gap-2"><button type="button" className={secondaryButtonClassName} onClick={() => setPendingSport(null)}>Keep current sport</button><button type="button" className={primaryButtonClassName} onClick={confirmSportChange}>Change sport and clear blocks</button></div></div> : null}

    {basicsDismissed && basicsReady ? <>
      {showSchedule ? <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-2"><span className={formLabelClassName}>Scheduled date</span><input className={formFieldClassName} type="date" value={draft.scheduledDate ?? ''} onChange={(event) => onChange(updateSessionEditorSchedule(draft, { scheduledDate: event.target.value || null }))} /></label><label className="block space-y-2"><span className={formLabelClassName}>Time</span><input className={formFieldClassName} type="time" value={draft.timeLabel ?? ''} onChange={(event) => onChange(updateSessionEditorSchedule(draft, { timeLabel: event.target.value || null }))} /></label></div> : null}
      <WorkoutCanvasEditor draft={draft} onChange={onChange} performanceProfile={performanceProfile} profileLabel={profileLabel} showDraftStatus={showCanvasDraftStatus} targetDialogRequest={targetDialogRequest} />
    </> : null}
  </section>;
}
