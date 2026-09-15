'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  compactDangerButtonClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  EmptyState,
  formFieldClassName,
  formSelectClassName,
  primaryButtonClassName,
  successTextClassName,
  dangerTextClassName,
  Surface,
} from '@/components/ui';
import { WorkoutBuilder } from '@/components/WorkoutBuilder';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { ShareLinkButton } from '@/components/ShareLinkButton';
import { formatDuration } from '@/lib/format-duration';
import {
  createEmptySessionEditorDraft,
  createSessionEditorBlock,
  createSessionEditorDraftFromPersisted,
  deriveSessionEditorMetrics,
  serializeSessionEditorDraft,
  type SessionEditorDraft,
} from '@/lib/session-editor';
import {
  createTemplateEditorDraftFromRecord,
  type PlannerEditorTemplateRecord,
} from '@/lib/session-editor-adapters';
import { getSportLabel } from '@/lib/sport';
import type { PerformanceProfile } from '@/lib/performance-profile';

type WorkoutRecord = {
  id: number;
  templateId: number | null;
  sport: string;
  title: string;
  summary: string | null;
  sportMetricsJson: string | null;
  date?: string | Date | null;
  blocks: PlannerEditorTemplateRecord['blocks'];
};

type PendingDraftAction =
  | { kind: 'new' }
  | { kind: 'workout'; workout: WorkoutRecord }
  | { kind: 'template'; template: PlannerEditorTemplateRecord }
  | { kind: 'close' };

export function WorkoutLibraryClient({
  role,
  workouts,
  templates,
  endpoint,
  performanceProfile = null,
}: {
  role: 'COACH' | 'ATHLETE';
  workouts: WorkoutRecord[];
  templates: PlannerEditorTemplateRecord[];
  endpoint: string;
  performanceProfile?: PerformanceProfile | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filterText, setFilterText] = useState('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupSport, setSetupSport] = useState('RUNNING');
  const [setupTitle, setSetupTitle] = useState('');
  const [setupStart, setSetupStart] = useState<'blank' | 'template' | 'recent'>('blank');
  const [isDirty, setIsDirty] = useState(false);
  const [pendingDraftAction, setPendingDraftAction] = useState<PendingDraftAction | null>(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [draft, setDraft] = useState<SessionEditorDraft>(() => createNewDraft());

  const visibleWorkouts = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return workouts;
    return workouts.filter((workout) =>
      workout.title.toLowerCase().includes(query) || (workout.summary ?? '').toLowerCase().includes(query),
    );
  }, [filterText, workouts]);

  function applyDraftAction(action: PendingDraftAction) {
    if (action.kind === 'new') {
      setSelectedWorkoutId(null);
      setDraft(createNewDraft());
      setEditorOpen(true);
    } else if (action.kind === 'workout') {
      setSelectedWorkoutId(action.workout.id);
      setDraft(createSessionEditorDraftFromPersisted('create', { ...action.workout, date: null, scheduledDate: null }));
      setEditorOpen(true);
    } else if (action.kind === 'template') {
      setSelectedWorkoutId(null);
      setDraft(createTemplateEditorDraftFromRecord(action.template));
      setEditorOpen(true);
    } else {
      setSelectedWorkoutId(null);
      setDraft(createNewDraft());
      setEditorOpen(false);
    }
    setIsDirty(false);
    setPendingDraftAction(null);
    setMessage('');
  }

  function requestDraftAction(action: PendingDraftAction) {
    if (isPending) return;
    if (editorOpen && isDirty) {
      setPendingDraftAction(action);
      return;
    }
    applyDraftAction(action);
  }

  function beginNewWorkout() {
    const source = setupStart === 'template' ? templates[0] : setupStart === 'recent' ? workouts[0] : null;
    if (source && 'name' in source) {
      const next = createTemplateEditorDraftFromRecord(source);
      setDraft({ ...next, sport: setupSport, title: setupTitle || next.title });
    } else if (source) {
      const next = createSessionEditorDraftFromPersisted('create', { ...source, date: null, scheduledDate: null });
      setDraft({ ...next, sport: setupSport, title: setupTitle || next.title });
    } else {
      setDraft(createNewDraft(setupSport, setupTitle));
    }
    setSelectedWorkoutId(null);
    setEditorOpen(true);
    setIsDirty(false);
    setSetupOpen(false);
  }

  function loadTemplate(templateId: string) {
    if (!templateId) {
      if (selectedWorkoutId !== null) {
        setDraft((current) => ({ ...current, templateId: null }));
        setIsDirty(true);
        setMessage('');
      } else {
        requestDraftAction({ kind: 'new' });
      }
      return;
    }
    const template = templates.find((item) => item.id === Number(templateId));
    if (!template) return;
    requestDraftAction({ kind: 'template', template });
  }

  function saveWorkout() {
    startTransition(async () => {
      try {
        const payload = {
          ...serializeSessionEditorDraft(draft),
          scheduledDate: null,
          planWeekday: null,
          source: role === 'COACH' ? 'coach-library' : 'athlete-library',
        };
        const response = await fetch(selectedWorkoutId ? `${endpoint}/${selectedWorkoutId}` : endpoint, {
          method: selectedWorkoutId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const payloadResponse = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) {
          setMessageTone('danger');
          setMessage(payloadResponse.error ?? 'Could not save workout.');
          return;
        }
        setMessageTone('success');
        setMessage(selectedWorkoutId ? 'Workout updated.' : 'Workout created.');
        setIsDirty(false);
        if (!selectedWorkoutId) setEditorOpen(false);
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  function deleteWorkout() {
    if (!selectedWorkoutId) return;
    if (!window.confirm('Delete this workout? This cannot be undone.')) return;
    startTransition(async () => {
      try {
        const response = await fetch(`${endpoint}/${selectedWorkoutId}`, { method: 'DELETE' });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) {
          setMessageTone('danger');
          setMessage(payload.error ?? 'Could not delete workout.');
          return;
        }
        applyDraftAction({ kind: 'close' });
        setMessageTone('success');
        setMessage('Workout deleted.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  const metrics = deriveSessionEditorMetrics(draft);

  return (
    <div
      className={`grid min-w-0 gap-6 ${editorOpen ? 'xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]' : ''}`}
    >
      <Surface className="min-w-0 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Saved workouts</h2>
            <p className="mt-1 max-w-[44ch] text-sm leading-6 text-[var(--text-secondary)]">
              Reusable workout definitions. Dates and scheduling stay in Planner.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{workouts.length}</Badge>
            <button type="button" className={compactPrimaryButtonClassName} onClick={() => setSetupOpen(true)}>
              New workout
            </button>
          </div>
        </div>
        {setupOpen ? <div className="space-y-3 rounded-[10px] border border-[var(--brand)] bg-[var(--brand-tint)] p-4"><h3 className="text-base font-semibold text-[var(--text)]">Set up your workout</h3><div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-2"><span className="text-sm text-[var(--text-secondary)]">Sport</span><select className={formSelectClassName} value={setupSport} onChange={(event) => setSetupSport(event.target.value)}>{['RUNNING', 'BIKING', 'SWIMMING', 'STRENGTH'].map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}</select></label><label className="block space-y-2"><span className="text-sm text-[var(--text-secondary)]">Working title (optional)</span><input className={formFieldClassName} value={setupTitle} onChange={(event) => setSetupTitle(event.target.value)} placeholder="e.g. Tuesday threshold" /></label></div><fieldset className="flex flex-wrap gap-2"><legend className="mb-2 text-sm text-[var(--text-secondary)]">Start from</legend>{(['blank', 'template', 'recent'] as const).map((start) => <button key={start} type="button" className={setupStart === start ? compactPrimaryButtonClassName : compactSecondaryButtonClassName} disabled={(start === 'template' && templates.length === 0) || (start === 'recent' && workouts.length === 0)} onClick={() => setSetupStart(start)}>{start === 'blank' ? 'Blank workout' : start === 'template' ? 'First template' : 'Recent workout'}</button>)}</fieldset><div className="flex flex-wrap gap-2"><button type="button" className={compactPrimaryButtonClassName} onClick={beginNewWorkout}>Open canvas</button><button type="button" className={compactSecondaryButtonClassName} onClick={() => setSetupOpen(false)}>Cancel</button></div></div> : null}
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          className={formFieldClassName}
          placeholder="Search saved workouts"
          aria-label="Search saved workouts"
        />
        {message ? (
          <p role={messageTone === 'danger' ? 'alert' : 'status'} className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>
            {message}
          </p>
        ) : null}
        {visibleWorkouts.length === 0 ? (
          <EmptyState title={workouts.length === 0 ? 'No saved workouts yet' : 'No workouts found'} description="Create a reusable workout definition, then use it from Planner when you are ready." />
        ) : (
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {visibleWorkouts.map((workout) => {
              const workoutDraft = createSessionEditorDraftFromPersisted('create', { ...workout, date: null, scheduledDate: null });
              const workoutMetrics = deriveSessionEditorMetrics(workoutDraft);
              const selected = editorOpen && selectedWorkoutId === workout.id;
              return (
                <div key={workout.id} className={`py-4 ${selected ? 'bg-[var(--brand-tint)]' : ''}`}>
                  <button
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => requestDraftAction({ kind: 'workout', workout })}
                    className="w-full px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-inset"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-[14px] font-semibold text-[var(--text)]">{workout.title}</p>
                        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{getSportLabel(workout.sport)} · Reusable workout</p>
                      </div>
                      <span className="shrink-0 text-[12px] text-[var(--text-secondary)]">{selected ? 'Editing' : 'Edit'}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <SessionBlockBar segments={workoutMetrics.segments} compact />
                      <div className="flex gap-3 text-[12px] text-[var(--text-secondary)]">
                        <MetricText>{formatDuration(workoutMetrics.durationSec)}</MetricText>
                        <MetricText>{workoutMetrics.tss} TSS</MetricText>
                      </div>
                    </div>
                  </button>
                  {role === 'COACH' ? <div className="mt-2 px-2"><ShareLinkButton sourceKind="session" sourceId={workout.id} /></div> : null}
                </div>
              );
            })}
          </div>
        )}
      </Surface>

      {editorOpen ? <Surface className="min-w-0 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">{selectedWorkoutId ? 'Edit workout' : 'Create workout'}</h2>
            <p className="mt-1 max-w-[48ch] text-sm leading-6 text-[var(--text-secondary)]">
              Build the workout once. Planner makes an independent copy when you choose a date.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">{formatDuration(metrics.durationSec)}</Badge>
            <button type="button" className={compactSecondaryButtonClassName} disabled={isPending} onClick={() => requestDraftAction({ kind: 'close' })}>
              Close
            </button>
          </div>
        </div>

        {pendingDraftAction ? (
          <div role="alert" className="space-y-3 rounded-[10px] border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Discard unsaved changes?</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Your edits to this workout have not been saved.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={compactSecondaryButtonClassName} onClick={() => setPendingDraftAction(null)}>
                Keep editing
              </button>
              <button type="button" className={compactDangerButtonClassName} onClick={() => applyDraftAction(pendingDraftAction)}>
                Discard changes
              </button>
            </div>
          </div>
        ) : null}

        {templates.length > 0 ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Start from a template</span>
            <select className={formSelectClassName} value={draft.templateId ?? ''} onChange={(event) => loadTemplate(event.target.value)}>
              <option value="">Start from scratch</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
        ) : null}

        <WorkoutBuilder
          draft={draft}
          onChange={(next) => {
            setDraft((current) => ({ ...next, scheduledDate: null, planWeekday: null, mode: 'create', id: current.id }));
            setIsDirty(true);
          }}
          showSportMetrics
          summaryPlaceholder="What is this workout for?"
          durationUnit="minutes"
          performanceProfile={performanceProfile}
        />
        <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <button type="button" className={primaryButtonClassName} disabled={isPending} onClick={saveWorkout}>
            {isPending ? 'Saving…' : selectedWorkoutId ? 'Save changes' : 'Save workout'}
          </button>
          {selectedWorkoutId ? <button type="button" className={compactDangerButtonClassName} disabled={isPending} onClick={deleteWorkout}>Delete</button> : null}
        </div>
      </Surface> : null}
    </div>
  );
}

function createNewDraft(sport = 'RUNNING', title = '') {
  return createEmptySessionEditorDraft({
    mode: 'create',
    scheduledDate: null,
    planWeekday: null,
    sport,
    title,
    blocks: [createSessionEditorBlock({ kind: 'work', zone: 3, durationSec: 900 })],
  });
}
