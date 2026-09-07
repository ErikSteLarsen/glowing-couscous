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
import { SessionComposer } from '@/components/SessionComposer';
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

export function WorkoutLibraryClient({
  role,
  workouts,
  templates,
  endpoint,
}: {
  role: 'COACH' | 'ATHLETE';
  workouts: WorkoutRecord[];
  templates: PlannerEditorTemplateRecord[];
  endpoint: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filterText, setFilterText] = useState('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(null);
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

  function createNewWorkout() {
    setSelectedWorkoutId(null);
    setDraft(createNewDraft());
    setMessage('');
  }

  function loadWorkout(workout: WorkoutRecord) {
    setSelectedWorkoutId(workout.id);
    setDraft(createSessionEditorDraftFromPersisted('create', { ...workout, date: null, scheduledDate: null }));
    setMessage('');
  }

  function loadTemplate(templateId: string) {
    if (!templateId) {
      if (selectedWorkoutId !== null) {
        setDraft((current) => ({ ...current, templateId: null }));
        setMessage('');
      } else {
        createNewWorkout();
      }
      return;
    }
    const template = templates.find((item) => item.id === Number(templateId));
    if (!template) return;
    setSelectedWorkoutId(null);
    setDraft(createTemplateEditorDraftFromRecord(template));
    setMessage('');
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
        createNewWorkout();
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
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Surface className="min-w-0 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Workout library</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Unassigned building blocks for your plan.</p>
          </div>
          <Badge>{workouts.length}</Badge>
        </div>
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          className={formFieldClassName}
          placeholder="Search workouts"
          aria-label="Search workouts"
        />
        {visibleWorkouts.length === 0 ? (
          <EmptyState title={workouts.length === 0 ? 'Your library is empty' : 'No workouts found'} description="Create a workout here, then place it on a day from Planner." />
        ) : (
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {visibleWorkouts.map((workout) => {
              const workoutDraft = createSessionEditorDraftFromPersisted('create', { ...workout, date: null, scheduledDate: null });
              const workoutMetrics = deriveSessionEditorMetrics(workoutDraft);
              const selected = selectedWorkoutId === workout.id;
              return (
                <div key={workout.id} className={`py-4 ${selected ? 'bg-[var(--brand-tint)]' : ''}`}>
                  <button type="button" onClick={() => loadWorkout(workout)} className="w-full px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-inset">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-[14px] font-semibold text-[var(--text)]">{workout.title}</p>
                        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{getSportLabel(workout.sport)} · Not scheduled</p>
                      </div>
                      <span className="shrink-0 text-[12px] text-[var(--text-secondary)]">Edit</span>
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
        <button type="button" className={`${compactSecondaryButtonClassName} w-full`} onClick={createNewWorkout}>
          New workout
        </button>
      </Surface>

      <Surface className="min-w-0 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">{selectedWorkoutId ? 'Edit workout' : 'Create workout'}</h2>
            <p className="mt-1 max-w-[48ch] text-sm leading-6 text-[var(--text-secondary)]">This is the workout itself. It stays unassigned until you choose a date in Planner.</p>
          </div>
          <Badge tone="brand">{formatDuration(metrics.durationSec)}</Badge>
        </div>

        {templates.length > 0 ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Start from a template</span>
            <select className={formSelectClassName} value={draft.templateId ?? ''} onChange={(event) => loadTemplate(event.target.value)}>
              <option value="">Start from scratch</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
        ) : null}

        <SessionComposer
          draft={draft}
          onChange={(next) => setDraft((current) => ({ ...next, scheduledDate: null, planWeekday: null, mode: 'create', id: current.id }))}
          showSportMetrics
          summaryPlaceholder="What is this workout for?"
          durationUnit="minutes"
        />
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
          <button type="button" className={primaryButtonClassName} disabled={isPending} onClick={saveWorkout}>
            {isPending ? 'Saving…' : selectedWorkoutId ? 'Save changes' : 'Save workout'}
          </button>
          {selectedWorkoutId ? <button type="button" className={compactDangerButtonClassName} disabled={isPending} onClick={deleteWorkout}>Delete</button> : null}
          {message ? <p role={messageTone === 'danger' ? 'alert' : 'status'} className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}
        </div>
      </Surface>
    </div>
  );
}

function createNewDraft() {
  return createEmptySessionEditorDraft({
    mode: 'create',
    scheduledDate: null,
    planWeekday: null,
    blocks: [createSessionEditorBlock({ kind: 'work', zone: 3, durationSec: 900 })],
  });
}
