'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  BackControl,
  Badge,
  buttonFocusClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  EmptyState,
  formFieldClassName,
  formLabelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  dangerButtonClassName,
  successTextClassName,
  dangerTextClassName,
  Surface,
} from '@/components/ui';
import { WorkoutBuilder } from '@/components/WorkoutBuilder';
import { GuidedWorkoutForm, type GuidedWorkoutInfo } from '@/components/GuidedWorkoutForm';
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
  type PersistedSessionBlock,
} from '@/lib/session-editor';
import { getSportLabel } from '@/lib/sport';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { useDraftRecovery } from '@/components/useDraftRecovery';
import { DraftRecoveryNotice } from '@/components/DraftRecoveryNotice';
import { parseWorkoutRecovery } from '@/lib/workout-recovery';
import type { RecoveryDraft } from '@/lib/draft-recovery';

type WorkoutRecord = {
  id: number;
  templateId: number | null;
  sport: string;
  title: string;
  summary: string | null;
  sportMetricsJson: string | null;
  date?: string | Date | null;
  updatedAt?: string | Date;
  blocks: PersistedSessionBlock[];
};

type PendingDraftAction =
  | { kind: 'new' }
  | { kind: 'workout'; workout: WorkoutRecord }
  | { kind: 'close' };

const subscribeToNothing = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function WorkoutLibraryClient({
  role,
  workouts,
  endpoint,
  performanceProfile = null,
  initialWorkoutId = null,
  previewMode = false,
  designDirection = null,
  ownerId = null,
}: {
  role: 'COACH' | 'ATHLETE';
  workouts: WorkoutRecord[];
  endpoint: string;
  performanceProfile?: PerformanceProfile | null;
  initialWorkoutId?: number | null;
  previewMode?: boolean;
  designDirection?: 'nocturne' | null;
  ownerId?: number | null;
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
  const [guidedFormOpen, setGuidedFormOpen] = useState(false);
  const [guidedInfo, setGuidedInfo] = useState<GuidedWorkoutInfo | null>(null);
  const clientMounted = useSyncExternalStore(subscribeToNothing, clientSnapshot, serverSnapshot);
  const [requestKey, setRequestKey] = useState('');
  const [revision, setRevision] = useState(() => initialWorkout?.updatedAt ? new Date(initialWorkout.updatedAt).toISOString() : '');
  const recovery = useDraftRecovery({ userId: previewMode ? null : ownerId, surface: 'workout', resource: selectedWorkoutId === null ? 'new' : String(selectedWorkoutId), baseline: revision, payload: JSON.stringify({ draft, requestKey }), dirty: editorOpen && isDirty });
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  function restoreWorkout(record: RecoveryDraft) {
    const recovered = parseWorkoutRecovery(record.payload);
    if (!recovered) { setMessageTone('danger'); setMessage('This draft cannot be read. Discard it and start again.'); return; }
    if (editorOpen && isDirty && !window.confirm('Replace the open draft with this recovered draft?')) return;
    const original = record.resource === 'new' ? null : workouts.find((workout) => String(workout.id) === record.resource);
    const currentRevision = original?.updatedAt ? new Date(original.updatedAt).toISOString() : '';
    const asCopy = record.resource !== 'new' && (!original || currentRevision !== record.baseline);
    recovery.discard();
    setSelectedWorkoutId(original && !asCopy ? original.id : null);
    setRevision(original && !asCopy ? currentRevision : '');
    setDraft({ ...recovered.draft, id: original && !asCopy ? original.id : null, mode: 'create', scheduledDate: null, planWeekday: null });
    setRequestKey(asCopy || !recovered.requestKey ? crypto.randomUUID() : recovered.requestKey);
    setIsDirty(true); setEditorOpen(true);
    recovery.restored(record);
    setMessageTone('success');
    setMessage(asCopy ? 'The saved workout changed or was removed. Your draft was restored as a new workout to protect the saved version.' : 'Workout draft restored. Review it before saving.');
  }

  const visibleWorkouts = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return workouts;
    return workouts.filter((workout) =>
      workout.title.toLowerCase().includes(query) || (workout.summary ?? '').toLowerCase().includes(query),
    );
  }, [filterText, workouts]);

  function applyDraftAction(action: PendingDraftAction) {
    recovery.discard();
    setRequestKey(crypto.randomUUID());
    setRevision(action.kind === 'workout' && action.workout.updatedAt ? new Date(action.workout.updatedAt).toISOString() : '');
    setGuidedInfo(null);
    setGuidedFormOpen(false);
    if (action.kind === 'new') {
      setSelectedWorkoutId(null);
      setDraft(createNewDraft());
      setEditorOpen(true);
    } else if (action.kind === 'workout') {
      setSelectedWorkoutId(action.workout.id);
      setDraft(createSessionEditorDraftFromPersisted('create', { ...action.workout, date: null, scheduledDate: null }));
      setEditorOpen(true);
      if (initialWorkoutId !== null) router.replace(`/athlete/workouts?edit=${action.workout.id}`, { scroll: false });
    } else {
      setSelectedWorkoutId(null);
      setDraft(createNewDraft());
      setEditorOpen(false);
      if (initialWorkoutId !== null) router.replace('/athlete/workouts', { scroll: false });
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

  function saveWorkout() {
    if (previewMode) {
      setMessageTone('danger');
      setMessage('This is a design preview. Open your Workouts page to save changes.');
      return;
    }
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
    const submittedSnapshot = JSON.stringify(draft);
    startTransition(async () => {
      try {
        const payload = {
          ...serializeSessionEditorDraft(draft),
          scheduledDate: null,
          planWeekday: null,
          source: role === 'COACH' ? 'coach-library' : 'athlete-library',
          ...(selectedWorkoutId && revision ? { expectedUpdatedAt: revision } : {}),
          ...(!selectedWorkoutId && requestKey ? { requestKey } : {}),
        };
        const response = await fetch(selectedWorkoutId ? `${endpoint}/${selectedWorkoutId}` : endpoint, {
          method: selectedWorkoutId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const payloadResponse = await response.json().catch(() => ({})) as { error?: string; sessionId?: number; updatedAt?: string };
        if (!response.ok) {
          setMessageTone('danger');
          setMessage(payloadResponse.error ?? 'Could not save this workout. Check the fields and try again.');
          return;
        }
        setMessageTone('success');
        const untouched = JSON.stringify(draftRef.current) === submittedSnapshot;
        if (untouched) recovery.discard();
        if (payloadResponse.updatedAt) setRevision(payloadResponse.updatedAt);
        setMessage(selectedWorkoutId ? 'Workout updated in your library.' : 'Workout created in your library. You can now schedule a copy.');
        setIsDirty(!untouched);
        if (!selectedWorkoutId && payloadResponse.sessionId) {
          setSelectedWorkoutId(payloadResponse.sessionId);
          setDraft((current) => ({ ...current, id: payloadResponse.sessionId! }));
          if (untouched) setEditorOpen(false);
        }
        if (!untouched) setMessage('The submitted workout was saved. Your newer edits are still unsaved; save again to apply them.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  function deleteWorkout() {
    if (previewMode) {
      setMessageTone('danger');
      setMessage('This is a design preview. Open your Workouts page to delete a workout.');
      return;
    }
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
  const showEditor = editorOpen && (!designDirection || clientMounted);

  return (
    <div className={designDirection ? 'study-workouts__body' : editorOpen ? 'min-w-0' : 'page-content--library workout-library'}>
      <DraftRecoveryNotice candidates={recovery.candidates} status={recovery.status} disabled={isPending} onRestore={restoreWorkout} onDiscard={recovery.discard} />
      {designDirection || !editorOpen ? <section aria-labelledby="workout-library-title" className="study-workouts__library min-w-0 space-y-5">
        <div className="space-y-3">
          <h2 id="workout-library-title" className="text-lg font-semibold text-[var(--text)]">Workout library</h2>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <p className="max-w-[44ch] text-sm leading-6 text-[var(--text-secondary)]">
              Keep reusable workouts here. They stay unscheduled until you schedule a copy.
            </p>
            {role === 'ATHLETE' ? <button type="button" className={primaryButtonClassName} onClick={() => {
              if (previewMode) {
                setMessageTone('danger');
                setMessage('Guided creation uses your account. Open your Workouts page to build a workout.');
              } else {
                setGuidedFormOpen(true);
              }
            }}>Build guided workout</button> : null}
            <button type="button" className={role === 'ATHLETE' ? secondaryButtonClassName : primaryButtonClassName} onClick={() => requestDraftAction({ kind: 'new' })}>{role === 'ATHLETE' ? 'Create manually' : 'Create workout'}</button>
          </div>
        </div>
        {role === 'ATHLETE' && guidedFormOpen ? <GuidedWorkoutForm onCancel={() => setGuidedFormOpen(false)} onGenerated={(nextDraft, info) => {
          if (editorOpen && isDirty && !window.confirm('Replace the open unsaved workout with this generated draft?')) return;
          recovery.discard();
          setRequestKey(crypto.randomUUID()); setRevision('');
          setSelectedWorkoutId(null);
          setDraft(nextDraft);
          setIsDirty(true);
          setGuidedInfo(info);
          setGuidedFormOpen(false);
          setEditorOpen(true);
          setMessage('');
        }} /> : null}
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
          <label className="block w-full max-w-[32rem] space-y-2">
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
          <p role="status" aria-live="polite" className="text-[12px] font-medium tabular-nums text-[var(--text-secondary)] sm:pb-3">
            {filterText.trim()
              ? `${visibleWorkouts.length} of ${workouts.length} workouts`
              : `${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'}`}
          </p>
        </div>
        {message ? (
          <p role={messageTone === 'danger' ? 'alert' : 'status'} className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>
            {message}
          </p>
        ) : null}
        {visibleWorkouts.length === 0 && guidedFormOpen ? null : visibleWorkouts.length === 0 ? workouts.length === 0 ? (
          <EmptyState
            title="Your workout library is empty"
            description={role === 'ATHLETE' ? 'Build a guided workout or create one manually, then schedule a copy in Calendar.' : 'Create a workout here, then add a copy to a day in Planner.'}
            action={<button type="button" className={primaryButtonClassName} onClick={() => role === 'ATHLETE' ? setGuidedFormOpen(true) : requestDraftAction({ kind: 'new' })}>{role === 'ATHLETE' ? 'Build guided workout' : 'Create workout'}</button>}
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
                    className={`w-full rounded-lg px-2 text-left ${buttonFocusClassName} focus-visible:ring-inset`}
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
                  <div className="mt-2 flex flex-wrap items-center gap-3 px-2">
                    {role === 'ATHLETE' ? (
                      <Link href={`/athlete/planner?source=workout:${workout.id}`} className={`${compactSecondaryButtonClassName} min-h-11`}>
                        Plan this
                      </Link>
                    ) : null}
                    <ShareLinkButton sourceKind="session" sourceId={workout.id} ariaLabel={`Create a share link for ${workout.title}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section> : null}

      {showEditor ? <Surface className="study-workouts__editor min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <BackControl onClick={() => requestDraftAction({ kind: 'close' })} label="Back to library" disabled={isPending} />
            <h2 className="min-w-0 text-lg font-semibold text-[var(--text)]">{selectedWorkoutId ? 'Edit workout' : 'Create workout'}</h2>
            {!selectedWorkoutId || isDirty ? <span className="inline-flex min-h-8 items-center rounded-[3px] border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-3 text-xs font-semibold text-[var(--status-warning)]" role="status">{isPending ? 'Saving…' : selectedWorkoutId ? 'Unsaved changes' : 'Unsaved draft'}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">{formatDurationExact(metrics.durationSec)}</Badge>
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

        {guidedInfo ? <div className="space-y-1 border-b border-[var(--border)] pb-4 text-sm leading-6">
          <p className="font-semibold text-[var(--text)]">{guidedInfo.source === 'ai' ? 'AI-created workout' : `Standard guided pattern: ${guidedInfo.selectedPattern}`}</p>
          <p className="text-[var(--text-secondary)]">{guidedInfo.reason}</p>
          <p className="text-[var(--text-secondary)]">{guidedInfo.context}</p>
          <p className="text-xs text-[var(--text-secondary)]">Review every block and target below. This workout has not been saved.</p>
        </div> : null}

        <WorkoutBuilder
          key={draft.id ?? 'new'}
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
          />
        <div className="sticky bottom-[var(--mobile-nav-clearance)] z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3 md:bottom-0 max-md:z-20">
          <button type="button" className={primaryButtonClassName} disabled={isPending || !draft.blocks.some((block) => !block.skipped && block.kind !== 'pause')} onClick={saveWorkout}>
            {isPending ? 'Saving…' : selectedWorkoutId ? 'Save changes' : 'Save workout'}
          </button>
          {!draft.blocks.some((block) => !block.skipped && block.kind !== 'pause') ? <span className="text-xs text-[var(--text-secondary)]">Add an active block to save.</span> : null}
        </div>
        {selectedWorkoutId ? <div className="border-t border-[var(--border)] pt-4"><button type="button" className={dangerButtonClassName} disabled={isPending} onClick={deleteWorkout}>Delete workout from library</button></div> : null}
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
