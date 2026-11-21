'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarPlus, ChevronDown, Ellipsis, Link2, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  BackButton,
  Badge,
  buttonFocusClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  EmptyState,
  ghostButtonClassName,
  iconButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  dangerButtonClassName,
  successTextClassName,
  dangerTextClassName,
  Surface,
} from '@/components/ui';
import { WorkoutBuilder } from '@/components/WorkoutBuilder';
import { GuidedWorkoutForm, type GuidedWorkoutInfo } from '@/components/GuidedWorkoutForm';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { ShareLinkResult, useShareLink } from '@/components/ShareLinkButton';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempo/Menu';
import { formatDuration, formatDurationExact } from '@/lib/format-duration';
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
import { getCalendarPlacementHref } from '@/lib/calendar-navigation';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { useDraftRecovery } from '@/components/useDraftRecovery';
import { DraftRecoveryStatus } from '@/components/DraftRecoveryNotice';
import { DraftsPopover } from '@/components/DraftsPopover';
import { CollectionSearch, CollectionSummary, CollectionToolbar } from '@/components/library/CollectionToolbar';
import { WorkoutCard, WorkoutCardFooter, WorkoutCardGrid, WorkoutCardHeader, WorkoutCardMeta, WorkoutCardProfile, WorkoutCardSummary } from '@/components/library/WorkoutCard';
import { describeWorkoutDraft, isWorkoutDraftRedundant, parseWorkoutRecovery } from '@/lib/workout-recovery';
import { athleteWorkoutsHref, type WorkoutTab } from '@/lib/athlete-workouts-navigation';
import { formatDraftAge, recoveryKey, type RecoveryDraft } from '@/lib/draft-recovery';

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
  initialCustomization = null,
  collections = null,
  previewMode = false,
  designDirection = null,
  ownerId = null,
  listIntro = null,
}: {
  role: 'COACH' | 'ATHLETE';
  workouts: WorkoutRecord[];
  endpoint: string;
  performanceProfile?: PerformanceProfile | null;
  initialWorkoutId?: number | null;
  initialCustomization?: { slug: string; draft: SessionEditorDraft } | null;
  collections?: {
    tab: WorkoutTab;
    onBrowse: () => void;
    otherPanels: { id: Exclude<WorkoutTab, 'mine'>; content: ReactNode }[];
  } | null;
  previewMode?: boolean;
  designDirection?: 'nocturne' | null;
  ownerId?: number | null;
  /** Page header shown with the list; the editor replaces it while open. A function places the unsaved-drafts control. */
  listIntro?: ReactNode | ((slots: { drafts: ReactNode }) => ReactNode);
}) {
  const router = useRouter();
  const initialWorkout = initialWorkoutId === null ? null : workouts.find((workout) => workout.id === initialWorkoutId) ?? null;
  const [isPending, startTransition] = useTransition();
  const [filterText, setFilterText] = useState('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(() => initialWorkout?.id ?? null);
  const entry = initialCustomization ? `customize:${initialCustomization.slug}` : initialWorkout ? `edit:${initialWorkout.id}` : null;
  const [editorEntry, setEditorEntry] = useState(entry);
  const [catalogName, setCatalogName] = useState(initialCustomization?.draft.title ?? null);
  const [editorOpen, setEditorOpen] = useState(() => entry !== null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingDraftAction, setPendingDraftAction] = useState<PendingDraftAction | null>(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [draft, setDraft] = useState(() => initialCustomization?.draft ?? draftForWorkout(initialWorkout));
  const [guidedFormOpen, setGuidedFormOpen] = useState(false);
  const [guidedInfo, setGuidedInfo] = useState<GuidedWorkoutInfo | null>(null);
  const clientMounted = useSyncExternalStore(subscribeToNothing, clientSnapshot, serverSnapshot);
  const [requestKey, setRequestKey] = useState('');
  const [revision, setRevision] = useState(() => initialWorkout?.updatedAt ? new Date(initialWorkout.updatedAt).toISOString() : '');
  const editorResource = selectedWorkoutId === null ? 'new' : String(selectedWorkoutId);
  const recovery = useDraftRecovery({
    userId: previewMode ? null : ownerId, surface: 'workout', resource: editorResource, baseline: revision,
    payload: JSON.stringify({ draft, requestKey }), dirty: editorOpen && isDirty,
    isRedundant: (record) => isWorkoutDraftRedundant(record, workouts),
  });
  const draftEntries = recovery.candidates.map((record) => ({ key: recoveryKey(record), savedAt: record.savedAt, ...describeWorkoutDraft(record, workouts) }));
  const draftResources = new Set(recovery.candidates.map((record) => record.resource));
  const editorRecovery = editorOpen ? recovery.candidates.find((record) => record.resource === editorResource) ?? null : null;
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  // The editor replaces the list, so remember where the list was and return there on Back.
  const listScroll = useRef<{ top: number; workoutId: number | null } | null>(null);
  const wasEditorOpen = useRef(editorOpen);
  useLayoutEffect(() => {
    if (wasEditorOpen.current === editorOpen) return;
    wasEditorOpen.current = editorOpen;
    if (editorOpen) {
      window.scrollTo({ top: 0 });
      return;
    }
    const saved = listScroll.current;
    listScroll.current = null;
    window.scrollTo({ top: saved?.top ?? 0 });
    if (saved?.workoutId != null) document.querySelector<HTMLElement>(`[data-workout-row="${saved.workoutId}"]`)?.focus({ preventScroll: true });
  }, [editorOpen]);

  // A link or browser Back can change the server entry while this page stays mounted.
  if (editorEntry !== entry) {
    setEditorEntry(entry);
    if (initialCustomization || (initialWorkout && (!editorOpen || selectedWorkoutId !== initialWorkout.id)) || (!entry && editorOpen)) {
      setSelectedWorkoutId(initialWorkout?.id ?? null);
      setCatalogName(initialCustomization?.draft.title ?? null);
      setDraft(initialCustomization?.draft ?? draftForWorkout(initialWorkout));
      setRevision(initialWorkout?.updatedAt ? new Date(initialWorkout.updatedAt).toISOString() : '');
      setRequestKey('');
      setIsDirty(false);
      setPendingDraftAction(null);
      setGuidedInfo(null);
      setGuidedFormOpen(false);
      setEditorOpen(entry !== null);
      setMessage('');
    }
  }

  function rememberListPosition(workoutId: number | null) {
    if (!editorOpen) listScroll.current = { top: window.scrollY, workoutId };
  }

  function restoreWorkout(record: RecoveryDraft) {
    const recovered = parseWorkoutRecovery(record.payload);
    if (!recovered) { setMessageTone('danger'); setMessage('This draft cannot be read. Discard it and start again.'); return; }
    if (editorOpen && isDirty && !window.confirm('Replace the open draft with this recovered draft?')) return;
    const original = record.resource === 'new' ? null : workouts.find((workout) => String(workout.id) === record.resource);
    const currentRevision = original?.updatedAt ? new Date(original.updatedAt).toISOString() : '';
    const asCopy = record.resource !== 'new' && (!original || currentRevision !== record.baseline);
    recovery.discard();
    setCatalogName(null);
    setSelectedWorkoutId(original && !asCopy ? original.id : null);
    setRevision(original && !asCopy ? currentRevision : '');
    setDraft({ ...recovered.draft, id: original && !asCopy ? original.id : null, mode: 'create', scheduledDate: null, planWeekday: null });
    setRequestKey(asCopy || !recovered.requestKey ? crypto.randomUUID() : recovered.requestKey);
    rememberListPosition(null);
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
    setCatalogName(null);
    setGuidedInfo(null);
    setGuidedFormOpen(false);
    if (action.kind !== 'close') rememberListPosition(action.kind === 'workout' ? action.workout.id : null);
    if (action.kind === 'new') {
      setSelectedWorkoutId(null);
      setDraft(createNewDraft());
      setEditorOpen(true);
    } else if (action.kind === 'workout') {
      setSelectedWorkoutId(action.workout.id);
      setDraft(draftForWorkout(action.workout));
      setEditorOpen(true);
      if (initialWorkoutId !== null) router.replace(`/athlete/workouts?edit=${action.workout.id}`, { scroll: false });
    } else {
      setSelectedWorkoutId(null);
      setDraft(createNewDraft());
      setEditorOpen(false);
      if (entry) {
        const params = new URLSearchParams(window.location.search);
        params.delete('edit');
        params.delete('customize');
        if (initialCustomization) params.set('tab', 'library');
        router.replace(athleteWorkoutsHref(params), { scroll: false });
      }
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
    const saveKey = selectedWorkoutId === null ? requestKey || crypto.randomUUID() : '';
    if (saveKey && !requestKey) setRequestKey(saveKey);
    startTransition(async () => {
      try {
        const payload = {
          ...serializeSessionEditorDraft(draft),
          scheduledDate: null,
          planWeekday: null,
          source: role === 'COACH' ? 'coach-library' : 'athlete-library',
          ...(selectedWorkoutId && revision ? { expectedUpdatedAt: revision } : {}),
          ...(saveKey ? { requestKey: saveKey } : {}),
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
          if (!initialCustomization && untouched) setEditorOpen(false);
        }
        if (initialCustomization && payloadResponse.sessionId) {
          setCatalogName(null);
          const params = new URLSearchParams(window.location.search);
          params.delete('customize');
          params.set('edit', String(payloadResponse.sessionId));
          params.set('tab', 'library');
          router.replace(athleteWorkoutsHref(params), { scroll: false });
        } else {
          router.refresh();
        }
        if (!untouched) setMessage('The submitted workout was saved. Your newer edits are still unsaved; save again to apply them.');
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  function deleteWorkout(workoutId = selectedWorkoutId, title = draft.title) {
    if (previewMode) {
      setMessageTone('danger');
      setMessage('This is a design preview. Open your Workouts page to delete a workout.');
      return;
    }
    if (!workoutId) return;
    const workoutName = title.trim() || 'this workout';
    if (!window.confirm(`Delete "${workoutName}" from your workout library? This cannot be undone. Scheduled copies are not affected.`)) return;
    startTransition(async () => {
      try {
        const response = await fetch(`${endpoint}/${workoutId}`, { method: 'DELETE' });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) {
          setMessageTone('danger');
          setMessage(payload.error ?? 'Could not delete this workout. Try again.');
          return;
        }
        if (workoutId === selectedWorkoutId) applyDraftAction({ kind: 'close' });
        setMessageTone('success');
        setMessage('Workout removed from your library.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  function openGuidedForm() {
    if (previewMode) {
      setMessageTone('danger');
      setMessage('Guided creation uses your account. Open your Workouts page to build a workout.');
    } else {
      setGuidedFormOpen(true);
    }
  }

  const findCandidate = (key: string) => recovery.candidates.find((record) => recoveryKey(record) === key);
  const draftsControl = <DraftsPopover
    drafts={draftEntries}
    now={recovery.checkedAt}
    disabled={isPending}
    onRestore={(key) => { const record = findCandidate(key); if (record) restoreWorkout(record); }}
    onDiscard={(key) => { const record = findCandidate(key); if (record) recovery.discard(record); }}
  />;

  const newWorkoutAction = role === 'ATHLETE'
    ? <NewWorkoutMenu onGuided={openGuidedForm} onScratch={() => requestDraftAction({ kind: 'new' })} onBrowse={collections?.onBrowse} />
    : <button type="button" className={primaryButtonClassName} onClick={() => requestDraftAction({ kind: 'new' })}>Create workout</button>;

  const metrics = deriveSessionEditorMetrics(draft, performanceProfile?.cycling.ftpWatts);
  const showEditor = editorOpen && (!designDirection || clientMounted);
  const showMine = !collections || collections.tab === 'mine';
  const EditorHeading = listIntro ? 'h1' : 'h2';

  return (
    <>
    {editorOpen ? null : typeof listIntro === 'function' ? listIntro({ drafts: draftsControl }) : listIntro}
    <div className={designDirection ? 'study-workouts__body' : editorOpen ? 'min-w-0' : 'page-content--library workout-library'}>
      {!editorOpen && collections?.otherPanels.map(({ id, content }) => (
        <div key={id} role="tabpanel" id={`workout-panel-${id}`} aria-labelledby={`workout-tab-${id}`} hidden={collections.tab !== id}>
          {collections.tab === id ? content : null}
        </div>
      ))}
      {!editorOpen && !showMine ? <div role="tabpanel" id="workout-panel-mine" aria-labelledby="workout-tab-mine" hidden /> : null}
      {!editorOpen && showMine ? <section
        role={collections ? 'tabpanel' : undefined}
        id={collections ? 'workout-panel-mine' : undefined}
        aria-labelledby={collections ? 'workout-tab-mine' : 'workout-library-title'}
        className="@container flex min-w-0 flex-col gap-5"
      >
        {collections ? null : <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="workout-library-title" className="text-lg font-semibold text-[var(--text)]">Workout library</h2>
          {typeof listIntro === 'function' ? null : draftsControl}
        </div>}
        <CollectionToolbar search={<CollectionSearch value={filterText} onChange={setFilterText} label="Search by name or notes" placeholder="Search workouts" />}>
          {newWorkoutAction}
        </CollectionToolbar>
        {role === 'ATHLETE' && guidedFormOpen ? <GuidedWorkoutForm onCancel={() => setGuidedFormOpen(false)} onGenerated={(nextDraft, info) => {
          if (editorOpen && isDirty && !window.confirm('Replace the open unsaved workout with this generated draft?')) return;
          recovery.discard();
          rememberListPosition(null);
          setRequestKey(crypto.randomUUID()); setRevision('');
          setSelectedWorkoutId(null);
          setDraft(nextDraft);
          setIsDirty(true);
          setGuidedInfo(info);
          setGuidedFormOpen(false);
          setEditorOpen(true);
          setMessage('');
        }} /> : null}
        <CollectionSummary action={filterText.trim() && visibleWorkouts.length > 0 ? (
          <button type="button" className={`${ghostButtonClassName('compact')} max-md:min-h-11`} onClick={() => setFilterText('')}>
            <X aria-hidden="true" size={14} strokeWidth={1.7} />Clear search
          </button>
        ) : null}>
          {filterText.trim()
            ? `${visibleWorkouts.length} of ${workouts.length} workouts`
            : `${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'}`}
        </CollectionSummary>
        {message ? (
          <p role={messageTone === 'danger' ? 'alert' : 'status'} className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>
            {message}
          </p>
        ) : null}
        {visibleWorkouts.length === 0 && guidedFormOpen ? null : visibleWorkouts.length === 0 ? workouts.length === 0 ? (
          <EmptyState
            title="You have no saved workouts yet"
            description={collections
              ? 'Workouts you build or customize land here. Use New workout, or start from the public library.'
              : role === 'ATHLETE'
                ? 'Build one with guidance or from scratch, then schedule a copy in Calendar.'
                : 'Create a workout here, then add a copy to a day in Planner.'}
            action={collections
              ? <button type="button" className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={collections.onBrowse}>Browse public library</button>
              : newWorkoutAction}
          />
        ) : (
          <EmptyState
            title="No matching workouts"
            description="Try a different name or note, or clear your search."
            action={<button type="button" className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => setFilterText('')}>Clear search</button>}
          />
        ) : (
          <WorkoutCardGrid>
            {visibleWorkouts.map((workout) => {
              const workoutMetrics = deriveSessionEditorMetrics(draftForWorkout(workout), performanceProfile?.cycling.ftpWatts);
              return (
                <li key={workout.id} className="min-w-0">
                  <MyWorkoutCard
                    workout={workout}
                    metrics={workoutMetrics}
                    hasDraft={draftResources.has(String(workout.id))}
                    canSchedule={role === 'ATHLETE'}
                    disabled={isPending}
                    onEdit={() => requestDraftAction({ kind: 'workout', workout })}
                    onDelete={() => deleteWorkout(workout.id, workout.title)}
                  />
                </li>
              );
            })}
          </WorkoutCardGrid>
        )}
      </section> : null}

      {showEditor ? <div className="page-back -mb-4"><BackButton destination="Workouts" onClick={() => requestDraftAction({ kind: 'close' })} disabled={isPending} /></div> : null}
      {showEditor ? <Surface className="study-workouts__editor min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--border)] pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <EditorHeading className="min-w-0 text-lg font-semibold text-[var(--text)]">{selectedWorkoutId ? 'Edit workout' : 'Create workout'}</EditorHeading>
            {!selectedWorkoutId || isDirty ? (
              <span role="status">
                <Badge tone="warning">{isPending ? 'Saving…' : selectedWorkoutId ? 'Unsaved changes' : 'Unsaved draft'}</Badge>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">{formatDurationExact(metrics.durationSec)}</Badge>
            {selectedWorkoutId ? (
              <Menu>
                <MenuTrigger
                  disabled={isPending}
                  aria-label="More workout actions"
                  className={`inline-flex size-10 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)] max-md:size-11 disabled:opacity-50 ${buttonFocusClassName}`}
                >
                  <Ellipsis aria-hidden="true" size={16} strokeWidth={1.8} />
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuItem destructive onSelect={() => deleteWorkout()}>
                    <Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />
                    Delete from library…
                  </MenuItem>
                </MenuContent>
              </Menu>
            ) : null}
          </div>
        </div>

        {editorRecovery ? (
          <section aria-label="Unsaved changes on this browser" className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-4 py-3">
            <p className="min-w-0 text-sm text-[var(--text)]">
              Restore unsaved changes saved <time dateTime={new Date(editorRecovery.savedAt).toISOString()} title={new Date(editorRecovery.savedAt).toLocaleString()}>{formatDraftAge(editorRecovery.savedAt, recovery.checkedAt)}</time>?
              <span className="block text-[12px] text-[var(--text-secondary)]">Kept on this browser only.</span>
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={isPending} className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => restoreWorkout(editorRecovery)}>Restore</button>
              <button type="button" disabled={isPending} className={`${ghostButtonClassName('compact')} max-md:min-h-11`} onClick={() => recovery.discard(editorRecovery)}>Discard</button>
            </div>
          </section>
        ) : null}
        <DraftRecoveryStatus status={recovery.status} />

        {pendingDraftAction ? (
          <div role="alert" className="space-y-3 rounded-[10px] border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Discard unsaved changes?</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Your changes to this workout will be lost.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={`${secondaryButtonClassName} max-md:min-h-11`} onClick={() => setPendingDraftAction(null)}>
                Keep editing
              </button>
              <button type="button" className={`${dangerButtonClassName} max-md:min-h-11`} onClick={() => applyDraftAction(pendingDraftAction)}>
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

        {catalogName ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Starting from <strong className="font-semibold text-[var(--text)]">{catalogName}</strong> in the public library. Saving creates your own workout and leaves the public version unchanged.
          </p>
        ) : null}

        {guidedInfo ? <div className="space-y-1 border-b border-[var(--border)] pb-4 text-sm leading-6">
          <p className="font-semibold text-[var(--text)]">{guidedInfo.source === 'ai' ? 'AI-created workout' : `Standard guided pattern: ${guidedInfo.selectedPattern}`}</p>
          <p className="text-[var(--text-secondary)]">{guidedInfo.reason}</p>
          <p className="text-[var(--text-secondary)]">{guidedInfo.context}</p>
          <p className="text-xs text-[var(--text-secondary)]">Review every block and target below. This workout has not been saved.</p>
        </div> : null}

        <WorkoutBuilder
          key={draft.id ?? initialCustomization?.slug ?? 'new'}
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
          <button type="button" className={`${primaryButtonClassName} max-md:min-h-11`} disabled={isPending || !draft.blocks.some((block) => !block.skipped && block.kind !== 'pause')} onClick={saveWorkout}>
            {isPending ? 'Saving…' : selectedWorkoutId ? 'Save changes' : 'Save workout'}
          </button>
          {!draft.blocks.some((block) => !block.skipped && block.kind !== 'pause') ? <span className="text-xs text-[var(--text-secondary)]">Add an active block to save.</span> : null}
        </div>
      </Surface> : null}
    </div>
    </>
  );
}

function NewWorkoutMenu({ onGuided, onScratch, onBrowse }: { onGuided: () => void; onScratch: () => void; onBrowse?: () => void }) {
  return (
    <Menu>
      <MenuTrigger className={`${primaryButtonClassName} max-md:min-h-11`}>
        <Plus aria-hidden="true" size={16} strokeWidth={2} />
        New workout
        <ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} />
      </MenuTrigger>
      <MenuContent align="start" className="max-w-[min(22rem,calc(100vw-2rem))]">
        <MenuItem onSelect={onGuided} className="flex-col items-start gap-0.5 py-2">
          <span className="font-medium">Build with guidance</span>
          <span className="text-xs text-[var(--text-secondary)]">Describe the session and review a suggested workout.</span>
        </MenuItem>
        <MenuItem onSelect={onScratch} className="flex-col items-start gap-0.5 py-2">
          <span className="font-medium">Build from scratch</span>
          <span className="text-xs text-[var(--text-secondary)]">Choose a name and sport, then add blocks yourself.</span>
        </MenuItem>
        {onBrowse ? <MenuItem onSelect={onBrowse}>Start from public library</MenuItem> : null}
      </MenuContent>
    </Menu>
  );
}

/** My workouts card: the name opens the editor; Schedule and More options sit in the footer. */
function MyWorkoutCard({ workout, metrics, hasDraft, canSchedule, disabled, onEdit, onDelete }: {
  workout: WorkoutRecord; metrics: ReturnType<typeof deriveSessionEditorMetrics>; hasDraft: boolean;
  canSchedule: boolean; disabled: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const share = useShareLink('session', workout.id);
  return (
    <WorkoutCard>
      <WorkoutCardProfile>
        {metrics.segments.length
          ? <SessionBlockBar segments={metrics.segments} size="tile" />
          : <div aria-hidden="true" className="h-14 border-b border-dashed border-[var(--border)]" />}
      </WorkoutCardProfile>
      <WorkoutCardHeader
        data-workout-row={workout.id}
        aria-label={`Edit workout: ${workout.title}`}
        aria-describedby={`workout-sport-${workout.id} workout-metrics-${workout.id}`}
        onClick={onEdit}
        aside={formatDuration(metrics.durationSec)}
      >
        {workout.title}
      </WorkoutCardHeader>
      <WorkoutCardMeta id={`workout-sport-${workout.id}`}>
        {getSportLabel(workout.sport)}{hasDraft ? <span className="text-[var(--status-warning)]"> · Unsaved draft</span> : null}
      </WorkoutCardMeta>
      {workout.summary ? <WorkoutCardSummary>{workout.summary}</WorkoutCardSummary> : null}
      <WorkoutCardFooter
        id={`workout-metrics-${workout.id}`}
        metrics={[{ label: 'TSS', value: metrics.tss }, { label: 'Blocks', value: workout.blocks.length }]}
        actions={<>
          {canSchedule ? (
            <Link href={getCalendarPlacementHref(`workout:${workout.id}`)} aria-label={`Schedule ${workout.title}`} className={`${compactSecondaryButtonClassName} max-md:min-h-11`}>
              <CalendarPlus aria-hidden="true" size={15} strokeWidth={1.6} />Schedule
            </Link>
          ) : null}
          <Menu>
            <MenuTrigger disabled={share.isPending || disabled} aria-label={`More options for ${workout.title}`} className={iconButtonClassName}>
              <Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={share.createLink}>
                <Link2 aria-hidden="true" size={16} strokeWidth={1.8} />Create share link
              </MenuItem>
              <MenuItem destructive onSelect={onDelete}>
                <Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />Delete from library…
              </MenuItem>
            </MenuContent>
          </Menu>
        </>}
      />
      {share.message || share.shareUrl ? <div className="relative z-10 mt-3 space-y-2"><ShareLinkResult share={share} showAudience /></div> : null}
    </WorkoutCard>
  );
}

function draftForWorkout(workout: WorkoutRecord | null) {
  return workout
    ? createSessionEditorDraftFromPersisted('create', { ...workout, date: null, scheduledDate: null })
    : createNewDraft();
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
