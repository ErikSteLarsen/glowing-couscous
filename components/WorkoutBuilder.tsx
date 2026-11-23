'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, ChevronDown, Copy, GripVertical, Minus, Plus, Redo2, Repeat2, Trash2, Undo2 } from 'lucide-react';

import {
  deriveSessionEditorMetrics,
  updateSessionEditorBlock,
  updateSessionEditorFields,
  updateSessionEditorSchedule,
  type SessionEditorBlock,
  type SessionEditorBlockPatch,
  type SessionEditorDraft,
} from '@/lib/session-editor';
import { formatDuration, formatDurationExact } from '@/lib/format-duration';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';
import { TEMPO_ZONE_META, type TempoBlockKind, type TempoZone } from '@/lib/tempo-blocks';
import { getAvailableWorkoutTargets, targetOptionReference, validateWorkoutTarget, type WorkoutTarget } from '@/lib/workout-targets';
import { formatResolvedWorkoutTarget, formatWorkoutTarget, missingProfileAction } from '@/lib/workout-target-resolution';
import { adjustWorkoutTarget } from '@/lib/workout-target-adjustment';
import { presetTarget } from '@/lib/workout-zone-intensity';
import {
  ADD_STEP_OPTIONS,
  INTERVAL_PRESETS,
  addStepToSet,
  buildBuilderRows,
  createStepBlocks,
  duplicateRow,
  insertBlocks,
  locateBlock,
  moveRow,
  moveSetStep,
  nudgeDuration,
  parseDuration,
  patchSetStep,
  removeRow,
  removeSetStep,
  repeatWithNext,
  representativeIndex,
  rowSpan,
  setRepeatCount,
  stepName,
  targetPatch,
  zonePatch,
  zoneTotals,
  type BuilderRow,
  type BuilderSetRow,
} from '@/lib/workout-builder';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { WorkoutProfile } from '@/components/WorkoutProfile';
import { buildWorkoutProfile } from '@/lib/workout-profile';
import { Menu, MenuContent, MenuGroup, MenuGroupLabel, MenuItem, MenuSeparator, MenuTrigger, OverflowMenuTrigger } from '@/components/tempo/Menu';
import {
  buttonFocusClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  formTextareaClassName,
  getSegmentedChoiceClassName,
  ghostButtonClassName,
} from '@/components/ui';

const editorButtonClassName = `${compactSecondaryButtonClassName} max-md:min-h-11`;
const iconStepButtonClassName = `${compactSecondaryButtonClassName} max-md:min-h-11 max-md:min-w-11`;
const WIDE_LAYOUT_QUERY = '(min-width: 64rem)';
const ZONES: TempoZone[] = [1, 2, 3, 4, 5];
const KIND_OPTIONS: Array<{ kind: TempoBlockKind; label: string }> = [
  { kind: 'warmup', label: 'Warm-up' },
  { kind: 'work', label: 'Work' },
  { kind: 'recovery', label: 'Recovery' },
  { kind: 'cooldown', label: 'Cool-down' },
  { kind: 'pause', label: 'Pause' },
];

/** The side panel needs desktop width; narrower screens open the editor inside the selected row. */
function useWideLayout() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(WIDE_LAYOUT_QUERY);
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia(WIDE_LAYOUT_QUERY).matches,
    () => false,
  );
}

function stepButton(clientId: string): HTMLElement | null {
  return document.querySelector(`[data-step-button="${window.CSS.escape(clientId)}"]`);
}

function isTextEntry(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** "55% FTP" or the zone when there is no target; the resolved value is shown separately. */
function targetSummary(block: SessionEditorBlock, sport: string) {
  if (block.kind === 'pause') return null;
  return block.target ? formatWorkoutTarget(block.target, sport) : TEMPO_ZONE_META[block.zone].label;
}

function resolvedTarget(block: SessionEditorBlock, sport: string, profile: PerformanceProfile | null) {
  return block.target?.mode === 'relative' ? formatResolvedWorkoutTarget(block.target, profile, sport) : null;
}

function stepDuration(block: SessionEditorBlock) {
  return `${formatDurationExact(block.durationSec)}${block.reps && block.reps > 1 ? ` × ${block.reps}` : ''}`;
}

export function WorkoutBuilder({
  draft,
  onChange,
  showSchedule = false,
  summaryPlaceholder = 'Coach notes or session intent',
  performanceProfile = null,
  titleLabel = 'Workout name',
  summaryLabel = 'Workout summary',
  headerActions = null,
}: {
  draft: SessionEditorDraft;
  onChange: (draft: SessionEditorDraft) => void;
  showSchedule?: boolean;
  summaryPlaceholder?: string;
  performanceProfile?: PerformanceProfile | null;
  titleLabel?: string;
  summaryLabel?: string;
  /** Status and page actions from the host, shown at the end of the title row. */
  headerActions?: ReactNode;
}) {
  const uid = useId();
  const editorId = `${uid}-step-editor`;
  const wide = useWideLayout();
  const [selectedId, setSelectedId] = useState<string | null>(draft.blocks[0]?.clientId ?? null);
  const [profileStep, setProfileStep] = useState<number | null>(null);
  const [history, setHistory] = useState<SessionEditorDraft[]>([]);
  const [future, setFuture] = useState<SessionEditorDraft[]>([]);
  const [basicsOpen, setBasicsOpen] = useState(() => !draft.title.trim());
  const [startsNew] = useState(() => !draft.title.trim());
  const [zonesOpen, setZonesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // Focus after a menu action is handed to the menu (it restores focus on close); other actions use the effect.
  const menuFocus = useRef<string | null>(null);
  const effectFocus = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sport = draft.sport;
  const profile = performanceProfile;
  const rows = buildBuilderRows(draft.blocks);
  const metrics = deriveSessionEditorMetrics(draft, profile?.cycling.ftpWatts);
  const model = buildWorkoutProfile(
    draft.blocks.map((block) => ({
      id: block.clientId,
      kind: block.kind,
      zone: block.zone,
      durationSec: block.durationSec,
      reps: block.reps,
      target: block.target,
      skipped: block.skipped,
      note: block.note || null,
      targetLabel: [targetSummary(block, sport), resolvedTarget(block, sport, profile)].filter(Boolean).join(' · ') || null,
    })),
    { sport, profile, ftpWatts: profile?.cycling.ftpWatts },
  );
  const selectedIndex = selectedId ? draft.blocks.findIndex((block) => block.clientId === selectedId) : -1;
  const selectedBlock = selectedIndex >= 0 ? draft.blocks[selectedIndex] : null;
  const selectedLocation = selectedIndex >= 0 ? locateBlock(rows, selectedIndex) : null;
  const selectedSet = selectedLocation?.row.type === 'set' ? selectedLocation.row : null;
  const profileSelection = selectedProfileStep();
  const profileHint = draft.blocks
    .map((block) => block.target && !formatResolvedWorkoutTarget(block.target, profile, sport) ? missingProfileAction(block.target) : null)
    .find(Boolean) ?? null;
  const basicsReady = Boolean(draft.title.trim() && draft.sport);
  const itemNoun = titleLabel === 'Template name' ? 'template' : 'workout';

  /** The clicked bar while it still belongs to the selected step, otherwise the step's first bar. */
  function selectedProfileStep(): number | null {
    if (selectedIndex < 0) return null;
    const clicked = profileStep === null ? null : model.steps[profileStep];
    if (clicked && representativeIndex(rows, clicked.blockIndex) === selectedIndex) return profileStep;
    const first = model.steps.findIndex((step) => step.blockIndex === selectedIndex);
    return first < 0 ? null : first;
  }

  useEffect(() => {
    const id = effectFocus.current;
    if (!id) return;
    effectFocus.current = null;
    stepButton(id)?.focus();
  });

  function commit(next: SessionEditorDraft, message?: string) {
    setHistory((current) => [...current.slice(-39), draft]);
    setFuture([]);
    onChange(next);
    if (message) setAnnouncement(`${message} Not saved yet.`);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setFuture((current) => [draft, ...current]);
    onChange(previous);
    setAnnouncement('Change undone.');
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((current) => current.slice(1));
    setHistory((current) => [...current, draft]);
    onChange(next);
    setAnnouncement('Change redone.');
  }

  function select(clientId: string | null) {
    setSelectedId(clientId);
    setProfileStep(null);
  }

  function selectFromProfile(stepIndex: number) {
    const step = model.steps[stepIndex];
    if (!step) return;
    const block = draft.blocks[representativeIndex(rows, step.blockIndex)];
    setSelectedId(block.clientId);
    setProfileStep(stepIndex);
    // Keep focus on the profile for arrow keys; bring the row into view.
    requestAnimationFrame(() => stepButton(block.clientId)?.scrollIntoView({ block: 'nearest' }));
  }

  /** Commit and move selection plus focus to a block that the new draft contains. */
  function commitAndFocus(next: SessionEditorDraft, focusId: string | null, message: string, fromMenu: boolean) {
    if (fromMenu) {
      menuFocus.current = focusId;
      // The menu restores focus as it closes, so the new row must already be in the DOM.
      flushSync(() => { commit(next, message); select(focusId); });
    } else {
      effectFocus.current = focusId;
      commit(next, message);
      select(focusId);
    }
  }

  const takeMenuFocus = () => {
    const id = menuFocus.current;
    menuFocus.current = null;
    return id ? stepButton(id) : null;
  };

  function insertionIndex() {
    if (!selectedLocation) return draft.blocks.length;
    return rowSpan(selectedLocation.row).end;
  }

  function addStep(optionId: string, label: string, fromMenu: boolean) {
    const blocks = createStepBlocks(optionId, sport, profile);
    if (!blocks.length) return;
    const at = insertionIndex();
    commitAndFocus(insertBlocks(draft, at, blocks), blocks[0].clientId, `${label} added.`, fromMenu);
  }

  function patchSelected(patch: SessionEditorBlockPatch) {
    if (!selectedLocation || selectedIndex < 0) return;
    commit(selectedLocation.row.type === 'set'
      ? patchSetStep(draft, selectedLocation.row, selectedLocation.offset, patch)
      : updateSessionEditorBlock(draft, selectedIndex, patch));
  }

  function neighbourAfterRemoval(rowIndex: number) {
    const neighbour = rows[rowIndex + 1] ?? rows[rowIndex - 1];
    return neighbour ? draft.blocks[rowSpan(neighbour).start].clientId : null;
  }

  function moveRowBy(rowIndex: number, direction: -1 | 1) {
    const target = rowIndex + direction;
    if (target < 0 || target >= rows.length) return;
    commit(moveRow(draft, rows, rowIndex, target), `Moved to position ${target + 1}.`);
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLButtonElement>, rowIndex: number, setOffset: number | null) {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const direction = event.key === 'ArrowUp' ? -1 : 1;
    const row = rows[rowIndex];
    if (row.type === 'set' && setOffset !== null) {
      if (setOffset + direction < 0 || setOffset + direction >= row.width) return;
      commit(moveSetStep(draft, row, setOffset, direction), `Moved within the set.`);
    } else {
      moveRowBy(rowIndex, direction);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const from = rows.findIndex((row) => row.id === event.active.id);
    const to = rows.findIndex((row) => row.id === event.over?.id);
    if (from < 0 || to < 0 || from === to) return;
    commit(moveRow(draft, rows, from, to), `Moved to position ${to + 1}.`);
  }

  function onBuilderKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (isTextEntry(event.target) || !(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
    if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo(); }
  }

  const rowActions = (row: BuilderRow, rowIndex: number) => ({
    duplicate: () => {
      const { draft: next, firstId } = duplicateRow(draft, row);
      commitAndFocus(next, firstId, row.type === 'set' ? 'Set duplicated.' : 'Step duplicated.', true);
    },
    moveEarlier: rowIndex > 0 ? () => moveRowBy(rowIndex, -1) : null,
    moveLater: rowIndex < rows.length - 1 ? () => moveRowBy(rowIndex, 1) : null,
    remove: () => commitAndFocus(removeRow(draft, row), neighbourAfterRemoval(rowIndex), row.type === 'set' ? 'Set removed.' : 'Step removed.', true),
  });

  const editor = selectedBlock ? (
    <StepEditor
      key={selectedBlock.clientId}
      id={editorId}
      block={selectedBlock}
      sport={sport}
      profile={profile}
      set={selectedSet}
      moreOpen={moreOpen}
      onMoreOpenChange={setMoreOpen}
      onPatch={patchSelected}
    />
  ) : null;

  const stepRow = (block: SessionEditorBlock, rowIndex: number, setOffset: number | null, menu: ReactNode, handle?: ReactNode) => (
    <StepRowLine
      block={block}
      sport={sport}
      profile={profile}
      selected={block.clientId === selectedId}
      handle={handle}
      menu={menu}
      editorId={editorId}
      onSelect={() => select(block.clientId === selectedId ? null : block.clientId)}
      onKeyDown={(event) => onRowKeyDown(event, rowIndex, setOffset)}
    >
      {!wide && block.clientId === selectedId ? editor : null}
    </StepRowLine>
  );

  const tools = (
    <div className="flex items-center gap-1.5">
      <AddStepMenu finalFocus={takeMenuFocus} onAdd={(id, label) => addStep(id, label, true)} />
      <button type="button" className={iconStepButtonClassName} aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!history.length} onClick={undo}><Undo2 aria-hidden="true" size={15} /></button>
      <button type="button" className={iconStepButtonClassName} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo}><Redo2 aria-hidden="true" size={15} /></button>
    </div>
  );

  const summary = (
    <div className="flex items-center gap-1">
      <span className="data whitespace-nowrap text-[13px] text-[var(--text)]">{formatDurationExact(metrics.durationSec)} · {metrics.tss}&nbsp;TSS</span>
      <button type="button" className={`${ghostButtonClassName('compact')} max-md:min-h-11`} aria-expanded={zonesOpen} aria-controls={`${uid}-zones`} onClick={() => setZonesOpen((open) => !open)}>
        Time by zone<ChevronDown aria-hidden="true" size={14} className={zonesOpen ? 'rotate-180' : ''} />
      </button>
    </div>
  );

  return (
    <section className="min-w-0 space-y-3" aria-label="Workout builder" onKeyDown={onBuilderKeyDown}>
      {basicsOpen || !basicsReady ? (
        <div className="space-y-3 rounded-lg border border-[var(--field-selected-border)] bg-[var(--brand-tint)] p-3" aria-labelledby={`${uid}-basics`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id={`${uid}-basics`} className="text-base font-semibold text-[var(--text)]">{startsNew ? 'Start with the basics' : 'Edit basics'}</h2>
              {startsNew ? <p className="mt-1 text-sm text-[var(--text-secondary)]">Name this {itemNoun} and choose its sport.</p> : null}
            </div>
            {headerActions ? <div className="flex items-center gap-2">{headerActions}</div> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.65fr)]">
            <label className="block">
              <span className={formLabelClassName}>{titleLabel}</span>
              <input
                autoFocus
                className={formFieldClassName}
                value={draft.title}
                onChange={(event) => commit(updateSessionEditorFields(draft, { title: event.target.value }))}
                placeholder={titleLabel === 'Template name' ? 'e.g. Base week' : 'e.g. Tuesday threshold'}
              />
            </label>
            <label className="block">
              <span className={formLabelClassName}>Sport</span>
              <select className={formSelectClassName} value={draft.sport} onChange={(event) => commit(updateSessionEditorFields(draft, { sport: event.target.value }))}>
                {SPORT_OPTIONS.map((option) => <option key={option} value={option}>{getSportLabel(option)}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={formLabelClassName}>{summaryLabel}</span>
            <textarea rows={2} className={formTextareaClassName} value={draft.summary} placeholder={summaryPlaceholder} onChange={(event) => commit(updateSessionEditorFields(draft, { summary: event.target.value }))} />
          </label>
          {showSchedule ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className={formLabelClassName}>Scheduled date</span><input className={formFieldClassName} type="date" value={draft.scheduledDate ?? ''} onChange={(event) => commit(updateSessionEditorSchedule(draft, { scheduledDate: event.target.value || null }))} /></label>
              <label className="block"><span className={formLabelClassName}>Time</span><input className={formFieldClassName} type="time" value={draft.timeLabel ?? ''} onChange={(event) => commit(updateSessionEditorSchedule(draft, { timeLabel: event.target.value || null }))} /></label>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <button type="button" className={`${compactPrimaryButtonClassName} max-md:min-h-11`} disabled={!basicsReady} onClick={() => setBasicsOpen(false)}>Done</button>
            {!basicsReady ? <span className="text-xs text-[var(--text-secondary)]">Add a name to continue.</span> : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Workout basics and tools">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 max-lg:contents">
            <h2 className="min-w-0 break-words text-base font-semibold text-[var(--text)]">{draft.title}</h2>
            <span className="text-sm text-[var(--text-secondary)]">
              {[getSportLabel(draft.sport), showSchedule ? [draft.scheduledDate, draft.timeLabel].filter(Boolean).join(' ') : null, draft.summary.trim() ? 'Notes added' : null].filter(Boolean).join(' · ')}
            </span>
            <button type="button" className={`${ghostButtonClassName('compact')} max-md:min-h-11`} onClick={() => setBasicsOpen(true)}>Edit basics</button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 max-lg:order-last max-lg:w-full lg:ml-auto">
            {tools}
            {summary}
          </div>
          {headerActions ? <div className="flex items-center gap-2 max-lg:ml-auto">{headerActions}</div> : null}
        </div>
      )}
      {basicsOpen || !basicsReady ? (
        <div className="flex flex-wrap items-center justify-between gap-2" aria-label="Builder tools">
          {tools}
          {summary}
        </div>
      ) : null}
      {zonesOpen ? <ZoneSummary id={`${uid}-zones`} blocks={draft.blocks} /> : null}

      {model.steps.length ? (
        <div className="space-y-1.5">
          <WorkoutProfile
            model={model}
            label="Workout profile. Select a step to edit it"
            chartHeight="short"
            ftpWatts={profile?.cycling.ftpWatts ?? null}
            selectedStep={profileSelection}
            onSelectStep={selectFromProfile}
            controlsId={selectedBlock ? editorId : undefined}
          />
          {profileHint ? (
            <p className="text-xs text-[var(--text-secondary)]">
              {profileHint} <Link href="/profile" className="rounded-sm font-medium text-[var(--brand)] underline-offset-4 control-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">Open Profile</Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {rows.length ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{ announcements: {
              onDragStart: () => 'Picked up. Use the arrow keys to choose a position.',
              onDragOver: ({ over }) => over ? `Position ${rows.findIndex((row) => row.id === over.id) + 1} of ${rows.length}.` : 'Outside the list. Release to cancel.',
              onDragEnd: ({ over }) => over ? 'Order updated. Not saved yet.' : 'Move cancelled.',
              onDragCancel: () => 'Move cancelled. Order unchanged.',
            } }}
          >
            <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
              <ol className="min-w-0 space-y-1 lg:max-h-[max(16rem,calc(100dvh-36rem))] lg:overflow-y-auto lg:p-0.5" aria-label="Workout steps. Alt plus arrow keys move the focused step">
                {rows.map((row, rowIndex) => {
                  const actions = rowActions(row, rowIndex);
                  if (row.type === 'step') {
                    const block = draft.blocks[row.index];
                    const next = rows[rowIndex + 1];
                    return (
                      <SortableRow key={row.id} id={row.id} label={stepName(block)}>
                        {(handle) => stepRow(block, rowIndex, null, (
                          <RowMenu label={stepName(block)} noun="step" finalFocus={takeMenuFocus} onDuplicate={actions.duplicate} onMoveEarlier={actions.moveEarlier} onMoveLater={actions.moveLater} onRemove={actions.remove}
                            onRepeat={next?.type === 'step' && block.kind !== 'pause' && draft.blocks[next.index].kind !== 'pause'
                              ? () => commitAndFocus(repeatWithNext(draft, row.index), block.clientId, 'Repeated with the next step as a set of 2.', true)
                              : null}
                          />
                        ), handle)}
                      </SortableRow>
                    );
                  }
                  return (
                    <SortableRow key={row.id} id={row.id} label="set">
                      {(handle) => (
                        <SetRowGroup
                          row={row}
                          blocks={draft.blocks}
                          handle={handle}
                          onRepeats={(repeats) => commit(setRepeatCount(draft, row, repeats), `Set repeats ${repeats} times.`)}
                          menu={<RowMenu label="set" noun="set" finalFocus={takeMenuFocus} onDuplicate={actions.duplicate} onMoveEarlier={actions.moveEarlier} onMoveLater={actions.moveLater} onRemove={actions.remove}
                            onAddToSet={() => {
                              const [recovery] = createStepBlocks('recovery', sport, profile);
                              commitAndFocus(addStepToSet(draft, row, recovery), recovery.clientId, 'Recovery added to every repeat.', true);
                            }}
                          />}
                        >
                          {Array.from({ length: row.width }, (_, offset) => {
                            const block = draft.blocks[row.start + offset];
                            return (
                              <li key={block.clientId}>
                                {stepRow(block, rowIndex, offset, (
                                  <SetStepMenu
                                    label={stepName(block)}
                                    finalFocus={takeMenuFocus}
                                    onMoveEarlier={offset > 0 ? () => commit(moveSetStep(draft, row, offset, -1), 'Moved within the set.') : null}
                                    onMoveLater={offset < row.width - 1 ? () => commit(moveSetStep(draft, row, offset, 1), 'Moved within the set.') : null}
                                    onRemove={() => {
                                      const next = removeSetStep(draft, row, offset);
                                      commitAndFocus(next, next.blocks[row.start]?.clientId ?? null, 'Step removed from every repeat.', true);
                                    }}
                                  />
                                ))}
                              </li>
                            );
                          })}
                        </SetRowGroup>
                      )}
                    </SortableRow>
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="tile-empty rounded-xl px-4 py-6 text-center">
            <p className="text-sm font-medium text-[var(--text)]">No steps yet</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Start with a warm-up, then add steady work or an interval set.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {ADD_STEP_OPTIONS.map((option) => (
                <button key={option.id} type="button" className={editorButtonClassName} onClick={() => addStep(option.id, option.label, false)}>
                  <Plus aria-hidden="true" size={14} />{option.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {wide ? (
          <aside className="rounded-lg border border-[var(--border)] bg-[var(--field-surface)] p-3 lg:sticky lg:top-4" aria-label="Step details">
            {editor ?? <p className="text-sm text-[var(--text-secondary)]">{rows.length ? 'Select a step in the profile or list to edit it.' : 'Added steps can be edited here.'}</p>}
          </aside>
        ) : null}
      </div>
      <p role="status" className="sr-only">{announcement}</p>
    </section>
  );
}

function AddStepMenu({ onAdd, finalFocus }: { onAdd: (id: string, label: string) => void; finalFocus: () => HTMLElement | null }) {
  return (
    <Menu>
      <MenuTrigger className={`${compactPrimaryButtonClassName} max-md:min-h-11`}>
        <Plus aria-hidden="true" size={15} strokeWidth={2} />Add step<ChevronDown aria-hidden="true" size={14} />
      </MenuTrigger>
      <MenuContent align="start" finalFocus={finalFocus} className="max-w-[min(20rem,calc(100vw-2rem))]">
        {ADD_STEP_OPTIONS.map((option) => (
          <MenuItem key={option.id} onSelect={() => onAdd(option.id, option.label)} className="justify-between gap-4">
            <span>{option.label}</span><span className="data text-xs text-[var(--text-muted)]">{option.detail}</span>
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>Interval presets</MenuGroupLabel>
          {INTERVAL_PRESETS.map((option) => (
            <MenuItem key={option.id} onSelect={() => onAdd(option.id, `${option.label} set`)} className="justify-between gap-4">
              <span>{option.label}</span><span className="data text-xs text-[var(--text-muted)]">{option.detail}</span>
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}

function RowMenu({ label, noun, finalFocus, onDuplicate, onMoveEarlier, onMoveLater, onRemove, onRepeat = null, onAddToSet }: {
  label: string;
  noun: 'step' | 'set';
  finalFocus: () => HTMLElement | null;
  onDuplicate: () => void;
  onMoveEarlier: (() => void) | null;
  onMoveLater: (() => void) | null;
  onRemove: () => void;
  onRepeat?: (() => void) | null;
  onAddToSet?: () => void;
}) {
  return (
    <Menu>
      <OverflowMenuTrigger compact aria-label={`More actions for ${label}`} />
      <MenuContent align="end" finalFocus={finalFocus}>
        <MenuItem onSelect={onDuplicate}><Copy aria-hidden="true" size={16} strokeWidth={1.8} />Duplicate</MenuItem>
        {onRepeat ? <MenuItem onSelect={onRepeat}><Repeat2 aria-hidden="true" size={16} strokeWidth={1.8} />Repeat with next step</MenuItem> : null}
        {onAddToSet ? <MenuItem onSelect={onAddToSet}><Plus aria-hidden="true" size={16} strokeWidth={1.8} />Add recovery to each repeat</MenuItem> : null}
        <MenuItem disabled={!onMoveEarlier} onSelect={() => onMoveEarlier?.()}><ArrowUp aria-hidden="true" size={16} strokeWidth={1.8} />Move earlier</MenuItem>
        <MenuItem disabled={!onMoveLater} onSelect={() => onMoveLater?.()}><ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} />Move later</MenuItem>
        <MenuSeparator />
        <MenuItem destructive onSelect={onRemove}><Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />Remove {noun}</MenuItem>
      </MenuContent>
    </Menu>
  );
}

function SetStepMenu({ label, finalFocus, onMoveEarlier, onMoveLater, onRemove }: { label: string; finalFocus: () => HTMLElement | null; onMoveEarlier: (() => void) | null; onMoveLater: (() => void) | null; onRemove: () => void }) {
  return (
    <Menu>
      <OverflowMenuTrigger compact aria-label={`More actions for ${label} in this set`} />
      <MenuContent align="end" finalFocus={finalFocus}>
        <MenuItem disabled={!onMoveEarlier} onSelect={() => onMoveEarlier?.()}><ArrowUp aria-hidden="true" size={16} strokeWidth={1.8} />Move earlier in set</MenuItem>
        <MenuItem disabled={!onMoveLater} onSelect={() => onMoveLater?.()}><ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} />Move later in set</MenuItem>
        <MenuSeparator />
        <MenuItem destructive onSelect={onRemove}><Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />Remove from set</MenuItem>
      </MenuContent>
    </Menu>
  );
}

function SortableRow({ id, label, children }: { id: string; label: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      aria-label={`Reorder ${label}`}
      title="Drag to reorder"
      className={`inline-flex min-h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-[var(--text-muted)] control-hover:bg-[var(--raised)] control-hover:text-[var(--text)] active:cursor-grabbing max-md:min-h-11 max-md:w-8 ${buttonFocusClassName}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical aria-hidden="true" size={15} />
    </button>
  );
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, position: 'relative', zIndex: isDragging ? 1 : undefined }}>
      {children(handle)}
    </li>
  );
}

function StepRowLine({ block, sport, profile, selected, handle, menu, editorId, onSelect, onKeyDown, children }: {
  block: SessionEditorBlock;
  sport: string;
  profile: PerformanceProfile | null;
  selected: boolean;
  handle?: ReactNode;
  menu: ReactNode;
  editorId: string;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
}) {
  const name = stepName(block);
  const target = targetSummary(block, sport);
  const resolved = resolvedTarget(block, sport, profile);
  return (
    <div className={`rounded-lg border ${selected ? 'border-[var(--field-selected-border)] bg-[var(--brand-tint)]' : 'border-transparent'}`}>
      <div className="flex min-w-0 items-center gap-1 pr-1">
        {handle ?? <span className="w-1 shrink-0" aria-hidden="true" />}
        <button
          type="button"
          data-step-button={block.clientId}
          aria-pressed={selected}
          aria-controls={selected ? editorId : undefined}
          aria-label={[name, stepDuration(block), target, resolved, block.skipped ? 'skipped' : null].filter(Boolean).join(', ')}
          onClick={onSelect}
          onKeyDown={onKeyDown}
          className={`@container flex min-h-8 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 text-left text-[13px] control-hover:bg-[var(--raised)] max-md:min-h-11 ${buttonFocusClassName}`}
        >
          <span aria-hidden="true" className={`h-4 w-1.5 shrink-0 rounded-sm ${block.kind === 'pause' ? 'bg-[var(--text-muted)]' : `ink-zone-${block.zone}`}`} />
          <span className={`min-w-0 flex-1 truncate font-medium ${block.skipped ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}`}>{name}</span>
          <span className="data shrink-0 text-[var(--text)]">{stepDuration(block)}</span>
          <span className="data hidden min-w-0 truncate text-right text-[var(--text-secondary)] @[11rem]:block @lg:w-40 @lg:shrink-0">{target}{target && resolved ? <span className="max-sm:hidden"> · {resolved}</span> : null}</span>
        </button>
        {menu}
      </div>
      {children ? <div className="border-t border-[var(--field-selected-border)] p-3">{children}</div> : null}
    </div>
  );
}

function SetRowGroup({ row, blocks, handle, menu, onRepeats, children }: { row: BuilderSetRow; blocks: SessionEditorBlock[]; handle: ReactNode; menu: ReactNode; onRepeats: (repeats: number) => void; children: ReactNode }) {
  const totalSec = blocks.slice(row.start, row.end).reduce((sum, block) => sum + block.durationSec * (block.reps ?? 1), 0);
  const labelId = useId();
  return (
    <div className="rounded-lg border border-[var(--border)]">
      <div className="flex min-w-0 items-center gap-1 pr-1">
        {handle}
        <span id={labelId} className="min-w-0 flex-1 truncate px-2 text-[13px] font-medium text-[var(--text)]">
          Set <span className="data font-normal text-[var(--text-secondary)]">· {formatDurationExact(totalSec)}{row.dropsLastStep ? ' · no recovery after the last' : ''}</span>
        </span>
        <div role="group" aria-labelledby={labelId} className="flex items-center gap-1">
          <button type="button" className={iconStepButtonClassName} aria-label="Fewer repeats" disabled={row.repeats <= 1} onClick={() => onRepeats(row.repeats - 1)}><Minus aria-hidden="true" size={14} /></button>
          <output aria-live="polite" aria-label={`${row.repeats} repeats`} className="data min-w-9 text-center text-[13px] font-medium text-[var(--text)]">× {row.repeats}</output>
          <button type="button" className={iconStepButtonClassName} aria-label="More repeats" disabled={row.repeats >= 50} onClick={() => onRepeats(row.repeats + 1)}><Plus aria-hidden="true" size={14} /></button>
        </div>
        {menu}
      </div>
      <ul className="ml-4 space-y-1 border-l border-[var(--border-strong)] pb-1 pl-1.5" aria-label={`Steps repeated ${row.repeats} times`}>{children}</ul>
    </div>
  );
}

function ZoneSummary({ id, blocks }: { id: string; blocks: SessionEditorBlock[] }) {
  const totals = zoneTotals(blocks);
  const total = totals.reduce((sum, item) => sum + item.durationSec, 0);
  const text = totals.map((item) => `${TEMPO_ZONE_META[item.zone].label} ${formatDuration(item.durationSec)}`).join(', ');
  return (
    <div id={id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
      <div role="img" aria-label={`Time by zone: ${text}`} className="flex h-2 overflow-hidden rounded-full bg-[var(--sunken)]">
        {total ? totals.filter((item) => item.durationSec).map((item) => <span key={item.zone} className={`ink-zone-${item.zone}`} style={{ flexGrow: item.durationSec }} />) : null}
      </div>
      <ul aria-hidden="true" className="data flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
        {totals.map((item) => (
          <li key={item.zone} className="flex items-center gap-1.5"><span className={`size-2 rounded-sm ink-zone-${item.zone}`} />{TEMPO_ZONE_META[item.zone].label} {TEMPO_ZONE_META[item.zone].name} <span className="text-[var(--text)]">{formatDuration(item.durationSec)}</span></li>
        ))}
      </ul>
    </div>
  );
}

function StepEditor({ id, block, sport, profile, set, moreOpen, onMoreOpenChange, onPatch }: {
  id: string;
  block: SessionEditorBlock;
  sport: string;
  profile: PerformanceProfile | null;
  set: BuilderSetRow | null;
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  onPatch: (patch: SessionEditorBlockPatch) => void;
}) {
  const uid = useId();
  const pause = block.kind === 'pause';
  const resolved = resolvedTarget(block, sport, profile);
  const lower = block.target ? adjustWorkoutTarget(block.target, -1) : null;
  const higher = block.target ? adjustWorkoutTarget(block.target, 1) : null;
  return (
    <div id={id} className="space-y-3" aria-label={`Edit ${stepName(block)}`} role="group">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">{stepName(block)}</h3>
        {set ? <span className="text-xs text-[var(--text-secondary)]">Applies to all {set.repeats} repeats</span> : null}
      </div>
      <DurationField id={`${uid}-duration`} value={block.durationSec} onChange={(durationSec) => onPatch({ durationSec })} />
      {pause ? null : (
        <fieldset className="min-w-0">
          <legend className={formLabelClassName}>Intensity</legend>
          <div className="flex gap-1" role="group" aria-label="Zone">
            {ZONES.map((zone) => (
              <button key={zone} type="button" aria-pressed={block.zone === zone} title={`${TEMPO_ZONE_META[zone].label} ${TEMPO_ZONE_META[zone].name}`} className={`${getSegmentedChoiceClassName(block.zone === zone, 'compact')} max-md:min-h-11 gap-1.5`} onClick={() => onPatch(zonePatch(block, zone, sport, profile))}>
                <span aria-hidden="true" className={`size-2 rounded-sm ink-zone-${zone}`} />{TEMPO_ZONE_META[zone].label}
              </button>
            ))}
          </div>
          {block.target ? (
            <div className="mt-2 flex items-center gap-1.5" role="group" aria-label="Target">
              <button type="button" className={iconStepButtonClassName} aria-label="Lower target" disabled={!lower} onClick={() => lower && onPatch(targetPatch(lower, block.zone, sport, profile))}><Minus aria-hidden="true" size={14} /></button>
              <span className="data min-w-0 flex-1 truncate text-center text-[13px] text-[var(--text)]" aria-live="polite">{formatWorkoutTarget(block.target, sport)}{resolved ? <span className="text-[var(--text-secondary)]"> · {resolved}</span> : null}</span>
              <button type="button" className={iconStepButtonClassName} aria-label="Raise target" disabled={!higher} onClick={() => higher && onPatch(targetPatch(higher, block.zone, sport, profile))}><Plus aria-hidden="true" size={14} /></button>
            </div>
          ) : null}
        </fieldset>
      )}
      <details open={moreOpen} onToggle={(event) => onMoreOpenChange(event.currentTarget.open)} className="group">
        <summary className={`inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-md text-[13px] font-medium text-[var(--text-secondary)] control-hover:text-[var(--text)] max-md:min-h-11 [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
          More options<ChevronDown aria-hidden="true" size={14} className="group-open:rotate-180" />
        </summary>
        <div className="mt-2 space-y-3">
          <label className="block">
            <span className={formLabelClassName}>Step type</span>
            <select className={formSelectClassName} value={block.kind} onChange={(event) => {
              const kind = event.target.value as TempoBlockKind;
              onPatch(kind === 'pause' ? { kind, target: null, reps: null } : { kind });
            }}>
              {KIND_OPTIONS.map((option) => <option key={option.kind} value={option.kind}>{option.label}</option>)}
            </select>
          </label>
          {pause ? null : <TargetFields sport={sport} block={block} profile={profile} onPatch={onPatch} />}
          {pause || set ? null : (
            <label className="block">
              <span className={formLabelClassName}>Repeat this step</span>
              <DraftNumberInput min={1} step={1} integer value={block.reps ?? 1} onCommit={(reps) => onPatch({ reps: reps > 1 ? reps : null })} />
            </label>
          )}
          <label className="block">
            <span className={formLabelClassName}>Coaching note</span>
            <textarea rows={2} className={formTextareaClassName} value={block.note} placeholder="Cue, cadence or focus, e.g. 90–95 rpm, seated" onChange={(event) => onPatch({ note: event.target.value })} />
          </label>
        </div>
      </details>
    </div>
  );
}

function DurationField({ id, value, onChange }: { id: string; value: number; onChange: (seconds: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const invalid = text !== null && parseDuration(text) === null;
  return (
    <div>
      <label htmlFor={id} className={formLabelClassName}>Duration</label>
      <input
        id={id}
        className={formFieldClassName}
        inputMode="text"
        autoComplete="off"
        value={text ?? formatDurationExact(value)}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        onFocus={(event) => { setText(formatDurationExact(value)); event.currentTarget.select(); }}
        onBlur={() => setText(null)}
        onChange={(event) => {
          setText(event.target.value);
          const seconds = parseDuration(event.target.value);
          if (seconds) onChange(seconds);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const next = nudgeDuration(value, event.key === 'ArrowUp' ? 1 : -1, event.shiftKey);
          onChange(next);
          setText(formatDurationExact(next));
        }}
      />
      <p id={`${id}-hint`} className={`mt-1 text-xs ${invalid ? 'text-[var(--status-danger)]' : 'text-[var(--text-muted)]'}`}>
        {invalid ? 'Use minutes or a time, e.g. 10, 90s or 1:30.' : 'e.g. 10, 90s or 1:30. Arrow keys adjust.'}
      </p>
    </div>
  );
}

function targetUnit(target: WorkoutTarget, sport: string) {
  if (target.metric === 'rpe') return '';
  if (target.mode === 'relative') return '%';
  if (target.metric === 'power') return 'W';
  if (target.metric === 'hr') return 'bpm';
  return sport === 'SWIMMING' ? 's/100 m' : 's/km';
}

function TargetFields({ sport, block, profile, onPatch }: { sport: string; block: SessionEditorBlock; profile: PerformanceProfile | null; onPatch: (patch: SessionEditorBlockPatch) => void }) {
  const uid = useId();
  const target = block.target;
  const options = getAvailableWorkoutTargets(sport);
  const value = target ? `${target.metric}:${target.mode}:${targetOptionReference(target.reference) ?? ''}` : '';
  const error = target ? validateWorkoutTarget(target, sport) : null;
  const unit = target ? targetUnit(target, sport) : '';
  const ramp = target && target.low !== target.high && (block.kind === 'warmup' || block.kind === 'cooldown') && target.metric === 'power';
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={formLabelClassName}>Target type</span>
        <select className={formSelectClassName} value={value} onChange={(event) => {
          const option = options.find((item) => `${item.metric}:${item.mode}:${item.reference ?? ''}` === event.target.value);
          onPatch({ target: option ? presetTarget(sport, block.zone, profile, option.metric, option.mode, option.reference) : null });
        }}>
          <option value="">No target (zone only)</option>
          {options.map((option) => <option key={`${option.metric}-${option.mode}-${option.reference}`} value={`${option.metric}:${option.mode}:${option.reference ?? ''}`}>{option.label}</option>)}
        </select>
      </label>
      {target ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={formLabelClassName}>Low{unit ? ` (${unit})` : ''}</span>
              <DraftNumberInput min={0} step={0.01} value={target.low} describedBy={error ? `${uid}-error` : undefined} onCommit={(low) => onPatch({ target: { ...target, low } })} />
            </label>
            <label className="block">
              <span className={formLabelClassName}>High{unit ? ` (${unit})` : ''}</span>
              <DraftNumberInput min={0} step={0.01} value={target.high} describedBy={error ? `${uid}-error` : undefined} onCommit={(high) => onPatch({ target: { ...target, high } })} />
            </label>
          </div>
          {error ? <p id={`${uid}-error`} className="text-xs text-[var(--status-danger)]">{error}</p> : null}
          {ramp ? <p className="text-xs text-[var(--text-secondary)]">{block.kind === 'warmup' ? 'Ramps up from low to high.' : 'Ramps down from high to low.'}</p> : null}
        </>
      ) : null}
    </div>
  );
}

/** A number field that keeps what is typed and commits only valid values, so clearing it never writes 0. */
function DraftNumberInput({ value, min, step, integer = false, describedBy, onCommit }: { value: number; min: number; step: number; integer?: boolean; describedBy?: string; onCommit: (value: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      className={formFieldClassName}
      type="number"
      min={min}
      step={step}
      value={text ?? String(value)}
      aria-describedby={describedBy}
      onFocus={() => setText(String(value))}
      onBlur={() => setText(null)}
      onChange={(event) => {
        setText(event.target.value);
        const next = Number(event.target.value);
        if (event.target.value.trim() && Number.isFinite(next) && next >= min && (!integer || Number.isInteger(next))) onCommit(next);
      }}
    />
  );
}
