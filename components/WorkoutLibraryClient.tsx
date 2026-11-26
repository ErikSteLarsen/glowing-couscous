'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import { ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  noticeBoxClassNames,
  sectionHeadingClassName,
  BackButton,
  Badge,
  compactSecondaryButtonClassName,
  EmptyState,
  ghostButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  dangerButtonClassName,
  successTextClassName,
  dangerTextClassName,
  Surface,
} from '@/components/ui';
import { WorkoutBuilder } from '@/components/WorkoutBuilder';
import { GuidedWorkoutForm, type GuidedWorkoutInfo } from '@/components/GuidedWorkoutForm';
import { ShareLinkResult, useShareLink } from '@/components/ShareLinkButton';
import { Menu, MenuContent, MenuItem, MenuTrigger, OverflowMenuTrigger } from '@/components/wattonaut/Menu';
import { CatalogProfile } from '@/components/library/CatalogProfile';
import { ActiveFilterChips, FilterChipGroup, FiltersButton, FiltersDialog, SortSelect } from '@/components/library/CollectionFilters';
import { MyWorkoutMenu } from '@/components/library/MyWorkoutActions';
import { formatDuration } from '@/lib/format-duration';
import {
  createEmptySessionEditorDraft,
  createSessionEditorDraftFromPersisted,
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
  type SessionEditorDraft,
  type PersistedSessionBlock,
} from '@/lib/session-editor';
import { getSportLabel } from '@/lib/sport';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { useDraftRecovery } from '@/components/useDraftRecovery';
import { DraftRecoveryStatus } from '@/components/DraftRecoveryNotice';
import { DraftsPopover } from '@/components/DraftsPopover';
import { SearchField } from '@/components/wattonaut/SearchField';
import { CollectionSummary, CollectionToolbar } from '@/components/library/CollectionToolbar';
import { WorkoutCard, WorkoutCardFooter, WorkoutCardGrid, WorkoutCardHeader, WorkoutCardMeta, WorkoutCardProfile, WorkoutCardSummary } from '@/components/library/WorkoutCard';
import { describeWorkoutDraft, isWorkoutDraftRedundant, parseWorkoutRecovery } from '@/lib/workout-recovery';
import { athleteWorkoutsHref, type WorkoutTab } from '@/lib/athlete-workouts-navigation';
import { formatDraftAge, recoveryKey, type RecoveryDraft } from '@/lib/draft-recovery';
import { summarizeOwnedWorkout, type OwnedWorkoutSummary } from '@/lib/owned-workout-summary';
import { getTempoZoneMeta } from '@/lib/tempo-blocks';
import { CATALOG_SORTS, DURATION_BUCKETS, type CatalogSort, type DurationBucket } from '@/lib/workout-catalog/query';

type WorkoutRecord = {
  id: number;
  templateId: number | null;
  sport: string;
  title: string;
  summary: string | null;
  sportMetricsJson: string | null;
  date?: string | Date | null;
  updatedAt?: string | Date;
  catalogWorkoutSlug?: string | null;
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
  workoutHref = null,
}: {
  role: 'COACH' | 'ATHLETE';
  workouts: WorkoutRecord[];
  endpoint: string;
  performanceProfile?: PerformanceProfile | null;
  initialWorkoutId?: number | null;
  initialCustomization?: { slug: string; name: string; draft: SessionEditorDraft } | null;
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
  /** Detail page of a saved workout. With it, cards open that page (as public workouts do) and Edit opens the editor. */
  workoutHref?: ((id: number) => string) | null;
}) {
  const router = useRouter();
  const initialWorkout = initialWorkoutId === null ? null : workouts.find((workout) => workout.id === initialWorkoutId) ?? null;
  const [isPending, startTransition] = useTransition();
  const [filterText, setFilterText] = useState('');
  const [sportFilter, setSportFilter] = useState<string[]>([]);
  const [lengthFilter, setLengthFilter] = useState<DurationBucket[]>([]);
  const [sort, setSort] = useState<CatalogSort>('name');
  const filtersDialog = useRef<HTMLDialogElement>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(() => initialWorkout?.id ?? null);
  const entry = initialCustomization ? `customize:${initialCustomization.slug}` : initialWorkout ? `edit:${initialWorkout.id}` : null;
  const [editorEntry, setEditorEntry] = useState(entry);
  const [catalogSource, setCatalogSource] = useState(() => catalogSourceOf(initialCustomization));
  const [editorOpen, setEditorOpen] = useState(() => entry !== null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingDraftAction, setPendingDraftAction] = useState<PendingDraftAction | null>(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [draft, setDraft] = useState(() => initialCustomization?.draft ?? draftForWorkout(initialWorkout, role));
  const [guidedFormOpen, setGuidedFormOpen] = useState(false);
  const [guidedInfo, setGuidedInfo] = useState<GuidedWorkoutInfo | null>(null);
  const clientMounted = useSyncExternalStore(subscribeToNothing, clientSnapshot, serverSnapshot);
  const [requestKey, setRequestKey] = useState('');
  const [revision, setRevision] = useState(() => initialWorkout?.updatedAt ? new Date(initialWorkout.updatedAt).toISOString() : '');
  const editorResource = selectedWorkoutId === null ? 'new' : String(selectedWorkoutId);
  const recovery = useDraftRecovery({
    userId: previewMode ? null : ownerId, surface: 'workout', resource: editorResource, baseline: revision,
    payload: JSON.stringify({ draft, requestKey, catalogSource }), dirty: editorOpen && isDirty,
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
      setCatalogSource(catalogSourceOf(initialCustomization));
      setDraft(initialCustomization?.draft ?? draftForWorkout(initialWorkout, role));
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
    if (!recovered) { setMessageTone('danger'); setMessage('These changes can’t be opened. Discard them and start again.'); return; }
    if (editorOpen && isDirty && !window.confirm('Replace the workout you’re editing with these restored changes?')) return;
    const original = record.resource === 'new' ? null : workouts.find((workout) => String(workout.id) === record.resource);
    const currentRevision = original?.updatedAt ? new Date(original.updatedAt).toISOString() : '';
    const asCopy = record.resource !== 'new' && (!original || currentRevision !== record.baseline);
    recovery.discard();
    // Opening as a copy creates a new workout, so it keeps the saved one's public source.
    setCatalogSource(record.resource === 'new' ? recovered.catalogSource
      : asCopy && original?.catalogWorkoutSlug ? { slug: original.catalogWorkoutSlug, name: original.title } : null);
    setSelectedWorkoutId(original && !asCopy ? original.id : null);
    setRevision(original && !asCopy ? currentRevision : '');
    setDraft({ ...recovered.draft, id: original && !asCopy ? original.id : null, mode: 'create', scheduledDate: null, planWeekday: null });
    setRequestKey(asCopy || !recovered.requestKey ? crypto.randomUUID() : recovered.requestKey);
    rememberListPosition(null);
    setIsDirty(true); setEditorOpen(true);
    recovery.restored(record);
    setMessageTone('success');
    setMessage(asCopy ? 'This workout was changed or deleted since then, so your changes open as a new workout. The saved version stays as it is.' : 'Changes restored. Check them, then save.');
  }

  const summaries = useMemo(() => new Map(workouts.map((workout) => [workout.id, summarizeOwnedWorkout(workout, performanceProfile)])), [workouts, performanceProfile]);
  const sportOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const workout of workouts) counts.set(workout.sport, (counts.get(workout.sport) ?? 0) + 1);
    return [...counts].map(([id, count]) => ({ id, label: getSportLabel(id), count })).sort((a, b) => a.label.localeCompare(b.label));
  }, [workouts]);
  const activeFilters = [
    ...sportFilter.map((id) => ({ key: `sport:${id}`, label: getSportLabel(id), onRemove: () => setSportFilter((current) => current.filter((value) => value !== id)) })),
    ...lengthFilter.map((id) => ({ key: `length:${id}`, label: DURATION_BUCKETS.find((bucket) => bucket.id === id)?.label ?? id, onRemove: () => setLengthFilter((current) => current.filter((value) => value !== id)) })),
  ];
  const filtered = Boolean(filterText.trim()) || activeFilters.length > 0;
  const clearSearchAndFilters = () => { setFilterText(''); setSportFilter([]); setLengthFilter([]); };
  const toggle = <T extends string>(values: T[], value: T) => values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

  const visibleWorkouts = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    const matches = workouts.filter((workout) => {
      const summary = summaries.get(workout.id);
      return (!query || workout.title.toLowerCase().includes(query) || (workout.summary ?? '').toLowerCase().includes(query))
        && (sportFilter.length === 0 || sportFilter.includes(workout.sport))
        && (lengthFilter.length === 0 || (summary !== undefined && lengthFilter.includes(summary.bucket)));
    });
    if (sort === 'name') return matches;
    const value = (workout: WorkoutRecord) => {
      const summary = summaries.get(workout.id);
      return sort.startsWith('duration') ? summary?.durationSec ?? 0 : summary?.tss ?? 0;
    };
    const direction = sort.endsWith('desc') ? -1 : 1;
    return [...matches].sort((a, b) => (value(a) - value(b)) * direction || a.title.localeCompare(b.title));
  }, [filterText, workouts, summaries, sportFilter, lengthFilter, sort]);

  function applyDraftAction(action: PendingDraftAction) {
    recovery.discard();
    setRequestKey(crypto.randomUUID());
    setRevision(action.kind === 'workout' && action.workout.updatedAt ? new Date(action.workout.updatedAt).toISOString() : '');
    setCatalogSource(null);
    setGuidedInfo(null);
    setGuidedFormOpen(false);
    if (action.kind !== 'close') rememberListPosition(action.kind === 'workout' ? action.workout.id : null);
    if (action.kind === 'new') {
      setSelectedWorkoutId(null);
      setDraft(createNewDraft(role));
      setEditorOpen(true);
    } else if (action.kind === 'workout') {
      setSelectedWorkoutId(action.workout.id);
      setDraft(draftForWorkout(action.workout, role));
      setEditorOpen(true);
      if (initialWorkoutId !== null) router.replace(`/athlete/workouts?edit=${action.workout.id}`, { scroll: false });
    } else {
      setSelectedWorkoutId(null);
      setDraft(createNewDraft(role));
      setEditorOpen(false);
      const returnToDetail = initialWorkout && workoutHref && new URLSearchParams(window.location.search).get('from') === 'detail';
      if (returnToDetail) {
        router.replace(workoutHref(initialWorkout.id), { scroll: false });
      } else if (entry) {
        const params = new URLSearchParams(window.location.search);
        params.delete('from');
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
      setMessage('Add at least one training block before saving. Pauses don’t count.');
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
          ...(selectedWorkoutId === null && catalogSource ? { catalogWorkoutSlug: catalogSource.slug } : {}),
        };
        const response = await fetch(selectedWorkoutId ? `${endpoint}/${selectedWorkoutId}` : endpoint, {
          method: selectedWorkoutId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const payloadResponse = await response.json().catch(() => ({})) as { error?: string; sessionId?: number; updatedAt?: string };
        if (!response.ok) {
          setMessageTone('danger');
          setMessage(payloadResponse.error ?? 'Could not save this workout. Check the details and try again.');
          return;
        }
        setMessageTone('success');
        const untouched = JSON.stringify(draftRef.current) === submittedSnapshot;
        if (untouched) recovery.discard();
        if (payloadResponse.updatedAt) setRevision(payloadResponse.updatedAt);
        setMessage(selectedWorkoutId ? 'Workout saved.' : 'Workout saved to My workouts. You can now add it to your Calendar.');
        setIsDirty(!untouched);
        if (!selectedWorkoutId && payloadResponse.sessionId) {
          setSelectedWorkoutId(payloadResponse.sessionId);
          setCatalogSource(null);
          setDraft((current) => ({ ...current, id: payloadResponse.sessionId! }));
          if (!initialCustomization && untouched) setEditorOpen(false);
        }
        if (initialCustomization && payloadResponse.sessionId) {
          setCatalogSource(null);
          const params = new URLSearchParams(window.location.search);
          params.delete('customize');
          params.set('edit', String(payloadResponse.sessionId));
          params.set('tab', 'library');
          router.replace(athleteWorkoutsHref(params), { scroll: false });
        } else {
          router.refresh();
        }
        if (!untouched) setMessage('Workout saved, but you made more changes while it was saving. Save again to keep them.');
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach Wattonaut. Check your connection and try again.');
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
    if (!window.confirm(`Delete "${workoutName}" from My workouts? This can’t be undone. Workouts already on your Calendar stay.`)) return;
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
        setMessage('Workout deleted.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach Wattonaut. Check your connection and try again.');
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
          <h2 id="workout-library-title" className={sectionHeadingClassName}>Workout library</h2>
          {typeof listIntro === 'function' ? null : draftsControl}
        </div>}
        <div role="search" aria-label="Filter workouts" className="flex flex-col gap-3">
          <CollectionToolbar search={<SearchField value={filterText} onChange={(event) => setFilterText(event.target.value)} label="Search by name or notes" placeholder="Search workouts" labelClassName="min-w-48 flex-1 max-sm:basis-full @2xl:max-w-md" className="max-md:min-h-11" maxLength={80} autoComplete="off" />}>
            {workouts.length ? <FiltersButton activeCount={activeFilters.length} onOpen={() => filtersDialog.current?.showModal()} /> : null}
            {newWorkoutAction}
          </CollectionToolbar>
          <ActiveFilterChips chips={activeFilters} />
        </div>
        <FiltersDialog
          dialogRef={filtersDialog}
          titleId="my-workouts-filters-title"
          resultCount={visibleWorkouts.length}
          clearDisabled={activeFilters.length === 0}
          onClear={() => { setSportFilter([]); setLengthFilter([]); }}
        >
          {sportOptions.length > 1 ? <FilterChipGroup legend="Sport" options={sportOptions} selected={sportFilter} onToggle={(id) => setSportFilter((current) => toggle(current, id))} /> : null}
          <FilterChipGroup legend="Length" options={DURATION_BUCKETS} selected={lengthFilter} onToggle={(id) => setLengthFilter((current) => toggle(current, id))} />
          <SortSelect value={sort} options={CATALOG_SORTS} onChange={setSort} />
        </FiltersDialog>
        {role === 'ATHLETE' && guidedFormOpen ? <GuidedWorkoutForm onCancel={() => setGuidedFormOpen(false)} onGenerated={(nextDraft, info) => {
          if (editorOpen && isDirty && !window.confirm('Replace the workout you’re editing with this new one? Your unsaved changes will be lost.')) return;
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
        <CollectionSummary action={filtered && visibleWorkouts.length > 0 ? (
          <button type="button" className={`${ghostButtonClassName('compact')} max-md:min-h-11`} onClick={clearSearchAndFilters}>
            <X aria-hidden="true" size={14} strokeWidth={1.7} />{activeFilters.length ? 'Clear search and filters' : 'Clear search'}
          </button>
        ) : null}>
          {visibleWorkouts.length === workouts.length
            ? `${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'}`
            : `${visibleWorkouts.length} of ${workouts.length} workouts`}
          {sort === 'name' ? null : `\u00A0– ${CATALOG_SORTS.find((entry) => entry.id === sort)?.label ?? ''}`}
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
                ? 'Build one with guidance or from scratch, then add it to your Calendar.'
                : 'Create a workout here, then add it to a day in the planner.'}
            action={collections
              ? <button type="button" className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={collections.onBrowse}>Browse public library</button>
              : newWorkoutAction}
          />
        ) : (
          <EmptyState
            title="No workouts match"
            description="Try a different search or adjust your filters."
            action={<button type="button" className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={clearSearchAndFilters}>Clear search and filters</button>}
          />
        ) : (
          <WorkoutCardGrid>
            {visibleWorkouts.map((workout) => {
              const summary = summaries.get(workout.id) ?? summarizeOwnedWorkout(workout, performanceProfile);
              return (
                <li key={workout.id} className="min-w-0">
                  <MyWorkoutCard
                    workout={workout}
                    summary={summary}
                    href={workoutHref ? workoutHref(workout.id) : null}
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
        {/* The builder's title row carries the visible name, status and actions. */}
        <EditorHeading className="sr-only">{selectedWorkoutId ? 'Edit workout' : 'Create workout'}</EditorHeading>

        {editorRecovery ? (
          <section aria-label="Unsaved changes" className={`flex flex-wrap items-center justify-between gap-3 ${noticeBoxClassNames.warning}`}>
            <p className="min-w-0 text-sm text-[var(--text)]">
              You have unsaved changes from <time dateTime={new Date(editorRecovery.savedAt).toISOString()} title={new Date(editorRecovery.savedAt).toLocaleString()}>{formatDraftAge(editorRecovery.savedAt, recovery.checkedAt)}</time>. Restore them?
              <span className="block text-[12px] text-[var(--text-secondary)]">They’re only on this device.</span>
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={isPending} className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => restoreWorkout(editorRecovery)}>Restore</button>
              <button type="button" disabled={isPending} className={`${ghostButtonClassName('compact')} max-md:min-h-11`} onClick={() => recovery.discard(editorRecovery)}>Discard</button>
            </div>
          </section>
        ) : null}
        <DraftRecoveryStatus status={recovery.status} />

        {pendingDraftAction ? (
          <div role="alert" className={`space-y-3 ${noticeBoxClassNames.warning}`}>
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

        {catalogSource ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Based on <strong className="font-semibold text-[var(--text)]">{catalogSource.name}</strong> from the public library. Saving adds your version to My workouts. The original stays as it is.
          </p>
        ) : null}

        {guidedInfo ? <div className="space-y-1 border-b border-[var(--border)] pb-4 text-sm leading-6">
          <p className="font-semibold text-[var(--text)]">{guidedInfo.source === 'ai' ? 'AI-created workout' : `Guided workout: ${guidedInfo.selectedPattern}`}</p>
          <p className="text-[var(--text-secondary)]">{guidedInfo.reason}</p>
          <p className="text-[var(--text-secondary)]">{guidedInfo.context}</p>
          <p className="text-xs text-[var(--text-secondary)]">Check each block and target below. This workout isn’t saved yet.</p>
        </div> : null}

        <WorkoutBuilder
          key={draft.id ?? initialCustomization?.slug ?? 'new'}
          draft={draft}
          onChange={(next) => {
            setDraft((current) => ({ ...next, scheduledDate: null, planWeekday: null, mode: 'create', id: current.id }));
            setIsDirty(true);
          }}
          summaryLabel="Notes (optional)"
          summaryPlaceholder="What is this workout for?"
          performanceProfile={performanceProfile}
          headerActions={<>
            {!selectedWorkoutId || isDirty ? (
              <span role="status">
                <Badge tone="warning">{isPending ? 'Saving…' : selectedWorkoutId ? 'Unsaved changes' : 'Not saved yet'}</Badge>
              </span>
            ) : null}
            {selectedWorkoutId ? (
              <Menu>
                <OverflowMenuTrigger
                  disabled={isPending}
                  aria-label="More workout actions" />
                <MenuContent align="end">
                  <MenuItem destructive onSelect={() => deleteWorkout()}>
                    <Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />
                    Delete workout…
                  </MenuItem>
                </MenuContent>
              </Menu>
            ) : null}
          </>}
          />
        <div className="sticky bottom-[var(--mobile-nav-clearance)] z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3 md:bottom-0 max-md:z-20">
          <button type="button" className={`${primaryButtonClassName} max-md:min-h-11`} disabled={isPending || !draft.blocks.some((block) => !block.skipped && block.kind !== 'pause')} onClick={saveWorkout}>
            {isPending ? 'Saving…' : selectedWorkoutId ? 'Save changes' : 'Save workout'}
          </button>
          {!draft.blocks.some((block) => !block.skipped && block.kind !== 'pause') ? <span className="text-xs text-[var(--text-secondary)]">Add a training block to save.</span> : null}
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
          <span className="text-xs text-[var(--text-secondary)]">Pick a sport, length and effort. Wattonaut suggests a workout you can edit.</span>
        </MenuItem>
        <MenuItem onSelect={onScratch} className="flex-col items-start gap-0.5 py-2">
          <span className="font-medium">Build from scratch</span>
          <span className="text-xs text-[var(--text-secondary)]">Choose a name and sport, then add the blocks yourself.</span>
        </MenuItem>
        {onBrowse ? <MenuItem onSelect={onBrowse}>Start from public library</MenuItem> : null}
      </MenuContent>
    </Menu>
  );
}

/**
 * My workouts card, built like the public `LibraryCard`: %FTP profile, name and
 * duration, sport and hardest zone, notes, TSS and IF, and one ⋯ menu. With a
 * detail page the name opens it; otherwise (coach) it opens the editor.
 */
function MyWorkoutCard({ workout, summary, href, hasDraft, canSchedule, disabled, onEdit, onDelete }: {
  workout: WorkoutRecord; summary: OwnedWorkoutSummary; href: string | null; hasDraft: boolean;
  canSchedule: boolean; disabled: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const share = useShareLink('session', workout.id);
  const peakZone = summary.peakZone ? getTempoZoneMeta(summary.peakZone).name : null;
  const describedBy = `workout-meta-${workout.id} workout-metrics-${workout.id}`;
  const profileLabel = `${workout.title} intensity profile, ${formatDuration(summary.durationSec)}${summary.axis === 'power' ? `, peak ${Math.round(summary.maxPct)}% FTP` : ''}`;
  return (
    <WorkoutCard>
      <WorkoutCardProfile>
        {summary.profile.steps.length
          ? <CatalogProfile steps={summary.profile.steps} idPrefix={`mine-${workout.id}`} label={profileLabel} className="h-14" />
          : <div aria-hidden="true" className="h-14 border-b border-dashed border-[var(--border)]" />}
      </WorkoutCardProfile>
      {href ? (
        <WorkoutCardHeader href={href} data-workout-row={workout.id} aria-describedby={describedBy} aside={formatDuration(summary.durationSec)}>
          {workout.title}
        </WorkoutCardHeader>
      ) : (
        <WorkoutCardHeader data-workout-row={workout.id} aria-label={`Edit workout: ${workout.title}`} aria-describedby={describedBy} onClick={onEdit} aside={formatDuration(summary.durationSec)}>
          {workout.title}
        </WorkoutCardHeader>
      )}
      <WorkoutCardMeta id={`workout-meta-${workout.id}`}>
        <span>{getSportLabel(workout.sport)}</span>{peakZone ? <>{' '}<span>{peakZone}</span></> : null}{hasDraft ? <>{' '}<span className="text-[var(--status-warning)]">Unsaved changes</span></> : null}
      </WorkoutCardMeta>
      {summary.lead ? <WorkoutCardSummary>{summary.lead}</WorkoutCardSummary> : null}
      <WorkoutCardFooter
        id={`workout-metrics-${workout.id}`}
        metrics={[
          { label: 'TSS', value: summary.tss },
          ...(summary.intensityFactor === null ? [] : [{ label: 'IF', value: summary.intensityFactor.toFixed(2) }]),
        ]}
        actions={<MyWorkoutMenu id={workout.id} name={workout.title} share={share} disabled={disabled} onEdit={onEdit} onDelete={onDelete} showSchedule={canSchedule} />}
      />
      {share.message || share.shareUrl ? <div className="relative z-10 mt-3 space-y-2"><ShareLinkResult share={share} showAudience /></div> : null}
    </WorkoutCard>
  );
}

function catalogSourceOf(customization: { slug: string; name: string } | null) {
  return customization ? { slug: customization.slug, name: customization.name } : null;
}

function draftForWorkout(workout: WorkoutRecord | null, role: 'COACH' | 'ATHLETE') {
  return workout
    ? createSessionEditorDraftFromPersisted('create', { ...workout, date: null, scheduledDate: null })
    : createNewDraft(role);
}

/** Athletes start on the bike, Wattonaut's default sport; the coach editor keeps its own default. */
function createNewDraft(role: 'COACH' | 'ATHLETE') {
  return createEmptySessionEditorDraft({
    mode: 'create',
    scheduledDate: null,
    planWeekday: null,
    ...(role === 'ATHLETE' ? { sport: 'BIKING' } : {}),
    blocks: [],
  });
}
