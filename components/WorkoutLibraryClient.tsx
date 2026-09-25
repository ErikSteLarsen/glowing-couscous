'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  buttonFocusClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  EmptyState,
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  dangerButtonClassName,
  successTextClassName,
  dangerTextClassName,
  Surface,
} from '@/components/ui';
import { WorkoutBuilder } from '@/components/WorkoutBuilder';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { ShareLinkButton } from '@/components/ShareLinkButton';
import { formatDurationExact } from '@/lib/format-duration';
import {
  createEmptySessionEditorDraft,
  createSessionEditorDraftFromPersisted,
  deriveSessionEditorMetrics,
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
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
  initialWorkoutId = null,
}: {
  role: 'COACH' | 'ATHLETE';
  workouts: WorkoutRecord[];
  templates: PlannerEditorTemplateRecord[];
  endpoint: string;
  performanceProfile?: PerformanceProfile | null;
  initialWorkoutId?: number | null;
}) {
  const router = useRouter();
  const initialWorkout = initialWorkoutId === null ? null : workouts.find((workout) => workout.id === initialWorkoutId) ?? null;
  const [isPending, startTransition] = useTransition();
  const [filterText, setFilterText] = useState('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(() => initialWorkout?.id ?? null);
  const [editorOpen, setEditorOpen] = useState(() => initialWorkout !== null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingDraftAction, setPendingDraftAction] = useState<PendingDraftAction | null>(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [draft, setDraft] = useState<SessionEditorDraft>(() => initialWorkout
    ? createSessionEditorDraftFromPersisted('create', { ...initialWorkout, date: null, scheduledDate: null })
    : createNewDraft());
  const [builderDetailsVisible, setBuilderDetailsVisible] = useState(() => initialWorkout !== null);

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
      if (initialWorkoutId !== null) router.replace(`/athlete/workouts?edit=${action.workout.id}`, { scroll: false });
    } else if (action.kind === 'template') {
      setSelectedWorkoutId(null);
      setDraft(createTemplateEditorDraftFromRecord(action.template));
      setEditorOpen(true);
    } else {
      setSelectedWorkoutId(null);
      setDraft(createNewDraft());
      setEditorOpen(false);
      if (initialWorkoutId !== null) router.replace('/athlete/workouts', { scroll: false });
    }
    setIsDirty(false);
    setBuilderDetailsVisible(action.kind === 'workout' || action.kind === 'template');
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
    if (!draft.blocks.some((block) => !block.skipped && block.kind !== 'pause')) {
      setMessageTone('danger');
      setMessage('Add at least one active block before saving this workout.');
      return;
    }
    const validationError = validateSessionEditorDraft(draft);
    if (validationError) {
      setMessageTone('danger');
      setMessage(validationError);
      return;
    }
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
          setMessage(payloadResponse.error ?? 'Could not save this workout. Check the fields and try again.');
          return;
        }
        setMessageTone('success');
        setMessage(selectedWorkoutId ? 'Workout updated in your library.' : 'Workout created in your library. You can now add a copy in Planner.');
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
    const workoutName = draft.title.trim() || 'this workout';
    if (!window.confirm(`Delete "${workoutName}" from your workout library? This cannot be undone. Scheduled copies are not affected.`)) return;
    startTransition(async () => {
      try {
        const response = await fetch(`${endpoint}/${selectedWorkoutId}`, { method: 'DELETE' });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) {
          setMessageTone('danger');
          setMessage(payload.error ?? 'Could not delete this workout. Try again.');
          return;
        }
        applyDraftAction({ kind: 'close' });
        setMessageTone('success');
        setMessage('Workout removed from your library.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  const metrics = deriveSessionEditorMetrics(draft);

  return (
    <div className={editorOpen ? 'min-w-0' : 'page-content--workout-list'}>
      {!editorOpen ? <Surface className="min-w-0 space-y-4">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Workout library</h2>
            <p className="mt-1 max-w-[44ch] text-sm leading-6 text-[var(--text-secondary)]">
              Keep reusable workouts here. They stay unscheduled until you add a copy to a day in Planner.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{workouts.length}</Badge>
            <button type="button" className={compactPrimaryButtonClassName} onClick={() => requestDraftAction({ kind: 'new' })}>
              Create workout
            </button>
          </div>
        </div>
        <label className="block space-y-2">
          <span className={formLabelClassName}>Find a workout</span>
          <input
            type="search"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            className={formFieldClassName}
            placeholder="Search by name or summary"
            aria-label="Search by name or summary"
          />
        </label>
        {message ? (
          <p role={messageTone === 'danger' ? 'alert' : 'status'} className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>
            {message}
          </p>
        ) : null}
        {visibleWorkouts.length === 0 ? workouts.length === 0 ? (
          <EmptyState
            title="Your workout library is empty"
            description="Create a workout here, then add a copy to a day in Planner."
            action={<button type="button" className={primaryButtonClassName} onClick={() => requestDraftAction({ kind: 'new' })}>Create workout</button>}
          />
        ) : (
          <EmptyState
            title="No matching workouts"
            description="Try a different name or summary, or clear your search."
            action={<button type="button" className={secondaryButtonClassName} onClick={() => setFilterText('')}>Clear search</button>}
          />
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
                    className={`w-full rounded-[3px] px-2 text-left ${buttonFocusClassName} focus-visible:ring-inset`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-[13px] font-semibold text-[var(--text)]">{workout.title}</p>
                        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{getSportLabel(workout.sport)} · Saved in library</p>
                      </div>
                      <span className="shrink-0 text-[12px] text-[var(--text-secondary)]">{selected ? 'Editing' : 'Edit workout'}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <SessionBlockBar segments={workoutMetrics.segments} compact />
                      <div className="flex gap-3 text-[12px] text-[var(--text-secondary)]">
                        <MetricText>{formatDurationExact(workoutMetrics.durationSec)}</MetricText>
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
      </Surface> : null}

      {editorOpen ? <Surface className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3"><h2 className="min-w-0 text-lg font-semibold text-[var(--text)]">{selectedWorkoutId ? 'Edit workout' : 'Create workout'}</h2>{!selectedWorkoutId || isDirty ? <span className="inline-flex min-h-8 items-center rounded-[3px] border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-3 text-xs font-semibold text-[var(--status-warning)]" role="status">{isPending ? 'Saving…' : selectedWorkoutId ? 'Unsaved changes' : 'Unsaved draft'}</span> : null}</div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">{formatDurationExact(metrics.durationSec)}</Badge>
            <button type="button" className={compactSecondaryButtonClassName} disabled={isPending} onClick={() => requestDraftAction({ kind: 'close' })}>
              Back to library
            </button>
          </div>
        </div>

        {pendingDraftAction ? (
          <div role="alert" className="space-y-3 rounded-[10px] border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Discard unsaved changes?</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Your changes to this workout will be lost.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={secondaryButtonClassName} onClick={() => setPendingDraftAction(null)}>
                Keep editing
              </button>
              <button type="button" className={dangerButtonClassName} onClick={() => applyDraftAction(pendingDraftAction)}>
                Discard changes
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p role={messageTone === 'danger' ? 'alert' : 'status'} className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>
            {message}
          </p>
        ) : null}

        {builderDetailsVisible && templates.length > 0 ? (
          <details className="rounded-[3px] border border-[var(--border)] bg-[var(--field-surface)] px-3">
            <summary className={`flex min-h-11 cursor-pointer list-none items-center text-[13px] font-medium text-[var(--text-secondary)] ${buttonFocusClassName}`}>
              Start from a saved template (optional)
            </summary>
            <label className="block space-y-2 border-t border-[var(--border)] py-3">
              <span className="sr-only">Saved template</span>
              <select className={formSelectClassName} value={draft.templateId ?? ''} onChange={(event) => loadTemplate(event.target.value)}>
                <option value="">No template (start blank)</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
          </details>
        ) : null}
        <WorkoutBuilder
          key={`${draft.id ?? 'new'}:${draft.templateId ?? 'none'}`}
          draft={draft}
          onChange={(next) => {
            setDraft((current) => ({ ...next, scheduledDate: null, planWeekday: null, mode: 'create', id: current.id }));
            setIsDirty(true);
          }}
          showSportMetrics
          summaryLabel="Notes (optional)"
          summaryPlaceholder="What is this workout for?"
          durationUnit="minutes"
          performanceProfile={performanceProfile}
          onDetailsVisibilityChange={setBuilderDetailsVisible}
          showCanvasDraftStatus={false}
          />
        {builderDetailsVisible ? <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <button type="button" className={primaryButtonClassName} disabled={isPending || !draft.blocks.some((block) => !block.skipped && block.kind !== 'pause')} onClick={saveWorkout}>
            {isPending ? 'Saving…' : selectedWorkoutId ? 'Save changes' : 'Save workout'}
          </button>
          {!draft.blocks.some((block) => !block.skipped && block.kind !== 'pause') ? <span className="text-xs text-[var(--text-secondary)]">Add an active block to save.</span> : null}
        </div> : null}
        {builderDetailsVisible && selectedWorkoutId ? <div className="border-t border-[var(--border)] pt-4"><button type="button" className={dangerButtonClassName} disabled={isPending} onClick={deleteWorkout}>Delete workout from library</button></div> : null}
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
    blocks: [],
  });
}
