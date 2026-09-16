'use client';

import { useRef, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  createSessionEditorBlock,
  deriveSessionEditorMetrics,
  updateSessionEditorBlock,
  updateSessionEditorFields,
  updateSessionEditorSchedule,
  type SessionEditorBlock,
  type SessionEditorDraft,
} from '@/lib/session-editor';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';
import { TEMPO_ZONE_META, type TempoBlockKind, type TempoZone } from '@/lib/tempo-blocks';
import { getAvailableWorkoutTargets, type WorkoutTarget } from '@/lib/workout-targets';
import { formatResolvedWorkoutTarget, formatWorkoutTarget, missingProfileAction } from '@/lib/workout-target-resolution';
import { repeatBlockSelection } from '@/lib/workout-blocks';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { MetricText } from '@/components/tempo/MetricText';
import { buttonFocusClassName, compactDangerButtonClassName, compactPrimaryButtonClassName, compactSecondaryButtonClassName, formFieldClassName, formLabelClassName, formSelectClassName, formTextareaClassName } from '@/components/ui';

type BlockPreset = {
  id: string;
  name: string;
  description: string;
  block: Partial<SessionEditorBlock>;
};

type SuppressedPaletteClick = {
  presetId: string;
  until: number;
};

const ZONE_PRESETS: Record<TempoZone, readonly BlockPreset[]> = {
  1: [
    { id: 'z1-reset', name: 'Reset', description: 'Easy movement to settle in', block: { kind: 'recovery', zone: 1, durationSec: 300 } },
    { id: 'z1-easy', name: 'Easy', description: 'Quiet, low-load aerobic work', block: { kind: 'recovery', zone: 1, durationSec: 600 } },
    { id: 'z1-long', name: 'Long recovery', description: 'Extended reset between efforts', block: { kind: 'recovery', zone: 1, durationSec: 900 } },
    { id: 'z1-float', name: 'Float x4', description: 'Short resets between efforts', block: { kind: 'recovery', zone: 1, durationSec: 120, reps: 4 } },
    { id: 'z1-cooldown', name: 'Cool-down', description: 'Bring the session back down', block: { kind: 'cooldown', zone: 1, durationSec: 600 } },
  ],
  2: [
    { id: 'z2-start', name: 'Aerobic start', description: 'Gentle opening miles', block: { kind: 'warmup', zone: 2, durationSec: 600 } },
    { id: 'z2-endurance', name: 'Endurance', description: 'Steady conversational effort', block: { kind: 'work', zone: 2, durationSec: 1200 } },
    { id: 'z2-long', name: 'Long endurance', description: 'Unhurried time on feet', block: { kind: 'work', zone: 2, durationSec: 1800 } },
    { id: 'z2-repeat', name: 'Steady x3', description: 'Repeatable aerobic pieces', block: { kind: 'work', zone: 2, durationSec: 600, reps: 3 } },
    { id: 'z2-finish', name: 'Aerobic finish', description: 'Close with controlled volume', block: { kind: 'work', zone: 2, durationSec: 900 } },
  ],
  3: [
    { id: 'z3-build', name: 'Tempo build', description: 'Controlled rise into tempo', block: { kind: 'work', zone: 3, durationSec: 600 } },
    { id: 'z3-sustain', name: 'Sustained tempo', description: 'Comfortably hard and even', block: { kind: 'work', zone: 3, durationSec: 1200 } },
    { id: 'z3-cruise', name: 'Tempo cruise', description: 'Repeatable sustained work', block: { kind: 'work', zone: 3, durationSec: 600, reps: 3 } },
    { id: 'z3-progress', name: 'Progression', description: 'Build through the middle', block: { kind: 'work', zone: 3, durationSec: 900 } },
    { id: 'z3-finish', name: 'Tempo finish', description: 'Finish with purposeful pressure', block: { kind: 'work', zone: 3, durationSec: 1800 } },
  ],
  4: [
    { id: 'z4-primer', name: 'Threshold primer', description: 'Short controlled preparation', block: { kind: 'work', zone: 4, durationSec: 300 } },
    { id: 'z4-threshold', name: 'Threshold', description: 'Sustained work near threshold', block: { kind: 'work', zone: 4, durationSec: 600 } },
    { id: 'z4-cruise', name: 'Threshold x3', description: 'Classic repeatable intervals', block: { kind: 'work', zone: 4, durationSec: 480, reps: 3 } },
    { id: 'z4-long', name: 'Long threshold', description: 'A longer demanding effort', block: { kind: 'work', zone: 4, durationSec: 900 } },
    { id: 'z4-repeat', name: 'Threshold x4', description: 'Build density with four pieces', block: { kind: 'work', zone: 4, durationSec: 360, reps: 4 } },
  ],
  5: [
    { id: 'z5-strides', name: 'Strides x8', description: 'Short, fast, relaxed efforts', block: { kind: 'work', zone: 5, durationSec: 30, reps: 8 } },
    { id: 'z5-short', name: 'Short VO2 x6', description: 'Sharp repetitions with rhythm', block: { kind: 'work', zone: 5, durationSec: 120, reps: 6 } },
    { id: 'z5-vo2', name: 'VO2 x5', description: 'Classic high-intensity pieces', block: { kind: 'work', zone: 5, durationSec: 180, reps: 5 } },
    { id: 'z5-long', name: 'Long VO2 x4', description: 'Longer maximal aerobic work', block: { kind: 'work', zone: 5, durationSec: 240, reps: 4 } },
    { id: 'z5-max', name: 'Max effort x3', description: 'A small dose of top-end work', block: { kind: 'work', zone: 5, durationSec: 300, reps: 3 } },
  ],
};

const ZONES: TempoZone[] = [1, 2, 3, 4, 5];
const PALETTE_DRAG_PREFIX = 'palette:';

export function WorkoutBuilder({
  draft,
  onChange,
  showSchedule = false,
  summaryPlaceholder = 'Coach notes or session intent',
  durationUnit = 'seconds',
  performanceProfile = null,
  profileLabel = 'current profile',
  titleLabel = 'Workout name',
  summaryLabel = 'Workout summary',
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
}) {
  const [selection, setSelection] = useState<number[]>(draft.blocks.length ? [0] : []);
  const [clipboard, setClipboard] = useState<SessionEditorBlock[]>([]);
  const [history, setHistory] = useState<SessionEditorDraft[]>([]);
  const [future, setFuture] = useState<SessionEditorDraft[]>([]);
  const [paletteZone, setPaletteZone] = useState<TempoZone>(2);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [basicsDismissed, setBasicsDismissed] = useState(() => Boolean(draft.title.trim()));
  const [notesOpen, setNotesOpen] = useState(() => Boolean(draft.summary));
  const suppressPaletteClick = useRef<SuppressedPaletteClick | null>(null);
  const lastFocused = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const metrics = deriveSessionEditorMetrics(draft);
  const selected = selection.map((index) => draft.blocks[index]).filter(Boolean);
  const selectedBlock = selected[0] ?? null;
  const activePreset = activePresetId ? findPreset(activePresetId) : null;
  const basicsReady = Boolean(draft.title.trim() && draft.sport);
  const basicsOpen = !basicsDismissed || !draft.title.trim();
  const itemNoun = titleLabel === 'Template name' ? 'template' : 'workout';

  function commit(next: SessionEditorDraft) {
    setHistory((current) => [...current.slice(-39), draft]);
    setFuture([]);
    onChange(next);
  }

  function select(index: number, event?: React.MouseEvent | React.KeyboardEvent) {
    lastFocused.current = draft.blocks[index]?.clientId ?? null;
    const block = draft.blocks[index];
    if (block) setPaletteZone(block.zone);
    if (event?.shiftKey && selection.length) {
      const start = selection[selection.length - 1];
      setSelection(Array.from({ length: Math.abs(index - start) + 1 }, (_, offset) => Math.min(start, index) + offset));
    } else if (event?.metaKey || event?.ctrlKey || (event as React.KeyboardEvent | undefined)?.code === 'Space') {
      setSelection((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort((a, b) => a - b));
    } else {
      setSelection([index]);
    }
  }

  function applyBlockPatch(patch: Partial<SessionEditorBlock>) {
    if (!selection.length) return;
    let next = draft;
    for (const index of selection) next = updateSessionEditorBlock(next, index, patch);
    commit(next);
  }

  function removeSelection() {
    if (!selection.length) return;
    commit({ ...draft, blocks: draft.blocks.filter((_, index) => !selection.includes(index)) });
    setSelection([]);
  }

  function insertPreset(preset: BlockPreset, index = draft.blocks.length) {
    const block = createSessionEditorBlock(preset.block);
    commit({ ...draft, blocks: [...draft.blocks.slice(0, index), block, ...draft.blocks.slice(index)] });
    setSelection([index]);
    setPaletteZone(block.zone);
  }

  function moveSelection(direction: -1 | 1) {
    if (!selection.length) return;
    const ordered = [...selection].sort((a, b) => a - b);
    const target = direction < 0 ? ordered[0] - 1 : ordered[ordered.length - 1] + 1;
    if (target < 0 || target >= draft.blocks.length) return;
    const moving = ordered.map((index) => draft.blocks[index]);
    const rest = draft.blocks.filter((_, index) => !ordered.includes(index));
    const insertion = direction < 0 ? target : target - moving.length + 1;
    const next = [...rest.slice(0, insertion), ...moving, ...rest.slice(insertion)];
    commit({ ...draft, blocks: next });
    setSelection(moving.map((_, offset) => insertion + offset));
  }

  function undo() { const previous = history.at(-1); if (previous) { setHistory((current) => current.slice(0, -1)); setFuture((current) => [draft, ...current]); onChange(previous); } }
  function redo() { const next = future[0]; if (next) { setFuture((current) => current.slice(1)); setHistory((current) => [...current, draft]); onChange(next); } }

  function closeBasicsOnBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (basicsReady && !event.currentTarget.contains(event.relatedTarget as Node | null)) setBasicsDismissed(true);
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith(PALETTE_DRAG_PREFIX)) setActivePresetId(id.slice(PALETTE_DRAG_PREFIX.length));
  }

  function onDragCancel() {
    setActivePresetId(null);
    suppressPaletteClick.current = null;
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
      const preset = findPreset(activeId.slice(PALETTE_DRAG_PREFIX.length));
      const overId = event.over?.id;
      const overIndex = draft.blocks.findIndex((block) => block.clientId === overId);
      if (preset && (overId === 'workout-canvas' || overIndex >= 0)) {
        insertPreset(preset, overIndex >= 0 ? overIndex : draft.blocks.length);
      }
      setActivePresetId(null);
      suppressPaletteClick.current = { presetId: activeId.slice(PALETTE_DRAG_PREFIX.length), until: Date.now() + 500 };
      return;
    }

    const activeIndex = draft.blocks.findIndex((block) => block.clientId === event.active.id);
    const overIndex = event.over?.id === 'workout-canvas'
      ? draft.blocks.length
      : draft.blocks.findIndex((block) => block.clientId === event.over?.id);
    if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
      setActivePresetId(null);
      return;
    }
    const moving = selection.includes(activeIndex) ? selection : [activeIndex];
    const selectedBlocks = moving.map((index) => draft.blocks[index]);
    const remaining = draft.blocks.filter((_, index) => !moving.includes(index));
    const before = draft.blocks.slice(0, overIndex).filter((_, index) => !moving.includes(index)).length;
    const nextBlocks = [...remaining.slice(0, before), ...selectedBlocks, ...remaining.slice(before)];
    if (nextBlocks.every((block, index) => block.clientId === draft.blocks[index]?.clientId)) {
      setSelection(moving);
      setActivePresetId(null);
      return;
    }
    commit({ ...draft, blocks: nextBlocks });
    setSelection(selectedBlocks.map((_, index) => before + index));
    setActivePresetId(null);
  }

  return (
    <section className="min-w-0 space-y-4" aria-label="Visual workout builder">
      {basicsOpen || !basicsReady ? (
        <div
          className="space-y-3 rounded-[3px] border border-[var(--field-selected-border)] bg-[var(--brand-tint)] p-3"
          onBlur={closeBasicsOnBlur}
          aria-labelledby="workout-basics-heading"
        >
          <div>
            <h2 id="workout-basics-heading" className="text-base font-semibold text-[var(--text)]">Start with the basics</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Name this {itemNoun} and choose its sport. Then build the sequence.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.65fr)]">
            <label className="block space-y-2">
              <span className={formLabelClassName}>{titleLabel}</span>
              <input
                autoFocus={!draft.title.trim()}
                className={formFieldClassName}
                value={draft.title}
                onChange={(event) => {
                  const title = event.target.value;
                  if (!title.trim()) setBasicsDismissed(false);
                  commit(updateSessionEditorFields(draft, { title }));
                }}
                placeholder={titleLabel === 'Template name' ? 'e.g. Base week' : 'e.g. Tuesday threshold'}
              />
            </label>
            <label className="block space-y-2">
              <span className={formLabelClassName}>Sport</span>
              <select className={formSelectClassName} value={draft.sport} onChange={(event) => commit(updateSessionEditorFields(draft, { sport: event.target.value }))}>
                {SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}
              </select>
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3" aria-label="Workout basics">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="min-w-0 break-words text-base font-semibold text-[var(--text)]">{draft.title}</h2>
            <span className="text-sm text-[var(--text-secondary)]">{getSportLabel(draft.sport)}</span>
          </div>
          <button type="button" className={compactSecondaryButtonClassName} onClick={() => setBasicsDismissed(false)}>Edit basics</button>
        </div>
      )}
      <details open={notesOpen || Boolean(draft.summary)} onToggle={(event) => setNotesOpen(event.currentTarget.open)}>
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center text-sm font-medium text-[var(--text-secondary)] underline decoration-[var(--border)] underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
          {summaryLabel}
        </summary>
        <label className="mt-3 block space-y-2">
          <span className="sr-only">{summaryLabel}</span>
          <textarea className={formTextareaClassName} value={draft.summary} placeholder={summaryPlaceholder} onChange={(event) => commit(updateSessionEditorFields(draft, { summary: event.target.value }))} />
        </label>
      </details>
      {showSchedule ? <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-2"><span className={formLabelClassName}>Scheduled date</span><input className={formFieldClassName} type="date" value={draft.scheduledDate ?? ''} onChange={(event) => commit(updateSessionEditorSchedule(draft, { scheduledDate: event.target.value || null }))} /></label><label className="block space-y-2"><span className={formLabelClassName}>Time</span><input className={formFieldClassName} type="time" value={draft.timeLabel ?? ''} onChange={(event) => commit(updateSessionEditorSchedule(draft, { timeLabel: event.target.value || null }))} /></label></div> : null}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: { onDragStart: ({ active }) => `Picked up ${String(active.id)}.`, onDragOver: ({ active, over }) => `Moving ${String(active.id)} over ${over ? String(over.id) : 'the canvas'}.`, onDragEnd: ({ active, over }) => `Moved ${String(active.id)} to ${over ? String(over.id) : 'its previous position'}.`, onDragCancel: ({ active }) => `Cancelled movement for ${String(active.id)}.` } }}
      >
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(13rem,0.72fr)_minmax(0,1.45fr)_minmax(15rem,0.8fr)]">
          <aside className="space-y-4 rounded-[3px] border border-[var(--border)] bg-[var(--field-surface)] p-4" aria-label="Block preset palette">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Block library</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Drag a preset into the sequence, or click to add it.</p>
            </div>
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Intensity zones">
              {ZONES.map((zone) => {
                const meta = TEMPO_ZONE_META[zone];
                const selectedZone = paletteZone === zone;
                return (
                  <button
                    key={zone}
                    type="button"
                    aria-pressed={selectedZone}
                    aria-label={`${meta.label} ${meta.name}`}
                    title={`${meta.label} ${meta.name}`}
                    className={`min-h-11 min-w-0 rounded-[3px] border px-1 py-1.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${selectedZone ? 'border-[var(--field-selected-border)] bg-[var(--brand-tint)] text-[var(--field-selected-text)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--field-focus)]'}`}
                    onClick={() => setPaletteZone(zone)}
                  >
                    <span className={`mx-auto mb-1 block h-1.5 w-7 ink-zone-${zone}`} aria-hidden="true" />
                    <span className="block text-[11px] font-semibold leading-none">{meta.label}</span>
                    <span className="mt-1 block truncate text-[10px] leading-none">{meta.name}</span>
                  </button>
                );
              })}
            </div>
            <div id="zone-preset-list" role="group" aria-label={`${TEMPO_ZONE_META[paletteZone].label} ${TEMPO_ZONE_META[paletteZone].name} block presets`} className="space-y-2">
              {ZONE_PRESETS[paletteZone].map((preset) => <PalettePreset key={preset.id} preset={preset} onAdd={() => {
                const suppression = suppressPaletteClick.current;
                if (suppression?.presetId === preset.id && suppression.until > Date.now()) {
                  suppressPaletteClick.current = null;
                  return;
                }
                if (suppression && suppression.until <= Date.now()) suppressPaletteClick.current = null;
                insertPreset(preset);
              }} />)}
            </div>
          </aside>

          <div className="min-w-0 space-y-3" onKeyDown={(event) => { if (event.key === 'Escape') setSelection([]); if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); setSelection(draft.blocks.map((_, index) => index)); } }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-base font-semibold text-[var(--text)]">Workout sequence</h2><p className="text-xs text-[var(--text-secondary)]">{selection.length ? `${selection.length} block${selection.length === 1 ? '' : 's'} selected` : 'Drop a preset here to start'}</p></div>
              <MetricText>{formatDuration(metrics.durationSec)} / {metrics.tss} TSS</MetricText>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(10rem,0.65fr)]">
              <div className="rounded-[3px] border border-[var(--border)] bg-[var(--field-surface)] p-3"><SessionBlockBar segments={metrics.segments} /><p className="mt-2 text-xs text-[var(--text-secondary)]">Timeline: width is time, height is zone.</p></div>
              <IntensityZoneChart segments={metrics.segments} />
            </div>
            <div className="flex flex-wrap items-center gap-2" aria-label="Canvas commands">
              <button type="button" className={compactSecondaryButtonClassName} disabled={!selection.length} onClick={() => moveSelection(-1)}>Earlier</button>
              <button type="button" className={compactSecondaryButtonClassName} disabled={!selection.length} onClick={() => moveSelection(1)}>Later</button>
              <details className="basis-full">
                <summary className={`${compactSecondaryButtonClassName} inline-flex cursor-pointer list-none`}>More tools</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={compactSecondaryButtonClassName} disabled={!selection.length} onClick={() => setClipboard(selected.map((block) => ({ ...block, id: null })))}>Copy</button>
                  <button type="button" className={compactSecondaryButtonClassName} disabled={!clipboard.length} onClick={() => { const at = (selection.at(-1) ?? draft.blocks.length - 1) + 1; const copies = clipboard.map((block) => createSessionEditorBlock({ ...block, id: null })); commit({ ...draft, blocks: [...draft.blocks.slice(0, at), ...copies, ...draft.blocks.slice(at)] }); setSelection(copies.map((_, index) => at + index)); }}>Paste</button>
                  <button type="button" className={compactSecondaryButtonClassName} disabled={!selection.length} onClick={() => { const at = (selection.at(-1) ?? -1) + 1; const copies = selected.map((block) => createSessionEditorBlock({ ...block, id: null })); commit({ ...draft, blocks: [...draft.blocks.slice(0, at), ...copies, ...draft.blocks.slice(at)] }); setSelection(copies.map((_, index) => at + index)); }}>Duplicate</button>
                  <button type="button" className={compactSecondaryButtonClassName} disabled={!selection.length} onClick={() => commit({ ...draft, blocks: repeatBlockSelection(draft.blocks, selection, 1) })}>Repeat once</button>
                  <button type="button" className={compactSecondaryButtonClassName} disabled={!history.length} onClick={undo}>Undo</button>
                  <button type="button" className={compactSecondaryButtonClassName} disabled={!future.length} onClick={redo}>Redo</button>
                  <button type="button" className={compactDangerButtonClassName} disabled={!selection.length} onClick={removeSelection}>Delete</button>
                </div>
              </details>
            </div>
            <CanvasDropZone>
              <SortableContext items={draft.blocks.map((block) => block.clientId)} strategy={verticalListSortingStrategy}>
                {draft.blocks.length ? <div className="space-y-2">{draft.blocks.map((block, index) => <SortableBlock key={block.clientId} block={block} index={index} selected={selection.includes(index)} profile={performanceProfile} profileLabel={profileLabel} onSelect={select} />)}</div> : <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Choose a preset in the block library to start the sequence.</p>}
              </SortableContext>
            </CanvasDropZone>
          </div>

          <aside className="ink-form-inspector space-y-4 rounded-[3px] border border-[var(--border)] bg-[var(--field-surface)] p-4" aria-live="polite">
            <div><h2 className="text-base font-semibold text-[var(--text)]">{selected.length > 1 ? `Edit ${selected.length} blocks` : 'Block details'}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{selected.length > 1 ? 'Changes apply to the selected sequence.' : 'Edit the selected block.'}</p></div>
            {selectedBlock ? <><label className="block space-y-2"><span className="text-xs text-[var(--text-secondary)]">Training zone</span><select className={formSelectClassName} value={selectedBlock.zone} onChange={(event) => applyBlockPatch({ zone: Number(event.target.value) as TempoZone })}>{Object.entries(TEMPO_ZONE_META).map(([zone, meta]) => <option key={zone} value={zone}>{meta.label} {meta.name}</option>)}</select></label><label className="block space-y-2"><span className="text-xs text-[var(--text-secondary)]">Duration ({durationUnit})</span><input className={formFieldClassName} type="number" min="1" value={durationUnit === 'minutes' ? Math.round(selectedBlock.durationSec / 60) : selectedBlock.durationSec} onChange={(event) => applyBlockPatch({ durationSec: Number(event.target.value) * (durationUnit === 'minutes' ? 60 : 1) })} /></label><label className="block space-y-2"><span className="text-xs text-[var(--text-secondary)]">Repeats</span><input className={formFieldClassName} type="number" min="1" value={selectedBlock.reps ?? ''} onChange={(event) => applyBlockPatch({ reps: event.target.value ? Number(event.target.value) : null })} /></label><TargetEditor sport={draft.sport} target={selectedBlock.target} onChange={(target) => applyBlockPatch({ target })} /><label className="block space-y-2"><span className="text-xs text-[var(--text-secondary)]">Coaching note</span><textarea className={formTextareaClassName} value={selectedBlock.note} onChange={(event) => applyBlockPatch({ note: event.target.value })} /></label><div className="flex flex-wrap gap-2"><button type="button" className={compactSecondaryButtonClassName} onClick={() => applyBlockPatch({ target: null })}>Clear target</button><button type="button" className={compactSecondaryButtonClassName} onClick={() => applyBlockPatch({ note: '', reps: null })}>Clear note and repeats</button><button type="button" className={compactDangerButtonClassName} onClick={removeSelection}>{selected.length > 1 ? 'Remove blocks' : 'Remove block'}</button></div></> : <p className="text-sm text-[var(--text-secondary)]">Select a block in the workout sequence.</p>}
          </aside>
        </div>
        {activePreset ? <DragOverlay dropAnimation={null}><PresetDragPreview preset={activePreset} /></DragOverlay> : null}
      </DndContext>
    </section>
  );
}

function PalettePreset({ preset, onAdd }: { preset: BlockPreset; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${PALETTE_DRAG_PREFIX}${preset.id}` });
  const duration = preset.block.durationSec ?? 0;
  const reps = preset.block.reps && preset.block.reps > 1 ? ` x ${preset.block.reps}` : '';

  return (
    <button
      ref={setNodeRef}
      type="button"
      className="flex min-h-16 w-full cursor-grab items-start gap-2 rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left transition hover:border-[var(--field-focus)] hover:bg-[var(--brand-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] active:cursor-grabbing"
      style={{ opacity: isDragging ? 0.35 : 1 }}
      onClick={onAdd}
      {...attributes}
      {...listeners}
    >
      <span className={`mt-1 h-8 w-1 shrink-0 ink-zone-${preset.block.zone ?? 1}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{preset.name}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-[var(--text-secondary)]">{preset.description}</span>
      </span>
      <span className="metric-text shrink-0 text-[11px] text-[var(--text-secondary)]">{formatDuration(duration)}{reps}</span>
    </button>
  );
}

function PresetDragPreview({ preset }: { preset: BlockPreset }) {
  return (
    <div className="flex w-56 items-center gap-2 rounded-[3px] border border-[var(--field-selected-border)] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-overlay)]">
      <span className={`h-8 w-1 shrink-0 ink-zone-${preset.block.zone ?? 1}`} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{preset.name}</span>
        <span className="block text-[11px] text-[var(--text-secondary)]">Drop into the sequence</span>
      </span>
    </div>
  );
}

function CanvasDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'workout-canvas' });

  return <div ref={setNodeRef} className={`min-h-24 rounded-[3px] border border-dashed p-3 transition-colors ${isOver ? 'border-[var(--brand)] bg-[var(--brand-tint)]' : 'border-[var(--border)] bg-[var(--field-surface)]'}`}>{children}</div>;
}

function IntensityZoneChart({ segments }: { segments: Array<{ zone: number; durationSec: number }> }) {
  const totals = ZONES.map((zone) => ({
    zone,
    durationSec: segments.filter((segment) => segment.zone === zone).reduce((total, segment) => total + segment.durationSec, 0),
  }));
  const maxDuration = Math.max(...totals.map((item) => item.durationSec), 1);
  const totalDuration = totals.reduce((total, item) => total + item.durationSec, 0);
  const summary = totals.map((item) => `${TEMPO_ZONE_META[item.zone].label} ${formatDuration(item.durationSec)}`).join(', ');

  return (
    <div role="img" aria-label={`Time by intensity zone: ${summary}`} className="rounded-[3px] border border-[var(--border)] bg-[var(--field-surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">Time by zone</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{formatDuration(totalDuration)} total</p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Bar chart</span>
      </div>
      <div className="mt-4 flex h-28 items-end gap-1.5 border-b border-[var(--border)]" aria-hidden="true">
        {totals.map(({ zone, durationSec }) => (
          <div key={zone} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="metric-text text-[10px] text-[var(--text-secondary)]">{formatDuration(durationSec)}</span>
            <div className="flex h-16 w-full items-end rounded-[2px] bg-[var(--sunken)]">
              <span className={`block w-full ${durationSec ? `ink-zone-${zone}` : 'bg-[var(--border)]'}`} style={{ height: `${durationSec ? Math.max((durationSec / maxDuration) * 100, 8) : 3}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{TEMPO_ZONE_META[zone].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function findPreset(id: string) {
  for (const zone of ZONES) {
    const preset = ZONE_PRESETS[zone].find((item) => item.id === id);
    if (preset) return preset;
  }
  return null;
}

function SortableBlock({ block, index, selected, profile, profileLabel, onSelect }: { block: SessionEditorBlock; index: number; selected: boolean; profile: PerformanceProfile | null; profileLabel: string; onSelect: (index: number, event?: React.MouseEvent | React.KeyboardEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.clientId });
  const target = block.target ? formatWorkoutTarget(block.target) : 'No target';
  const preview = block.target ? formatResolvedWorkoutTarget(block.target, profile) : null;
  const missing = block.target ? missingProfileAction(block.target) : null;
  const zone = TEMPO_ZONE_META[block.zone];
  return (
    <div className="space-y-1">
      <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }} className={`rounded-[3px] border p-3 ${selected ? 'border-[var(--brand)] bg-[var(--brand-tint)]' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
        <div className="flex items-start gap-3">
          <button type="button" className={`mt-1 min-h-11 shrink-0 cursor-grab rounded-[3px] px-2 text-xs text-[var(--text-muted)] ${buttonFocusClassName}`} aria-label={`Drag block ${index + 1}`} {...attributes} {...listeners}>Drag</button>
          <button type="button" className={`min-h-11 min-w-0 flex-1 rounded-[3px] text-left ${buttonFocusClassName}`} aria-pressed={selected} onClick={(event) => onSelect(index, event)} onKeyDown={(event) => { if (event.code === 'Space') { event.preventDefault(); onSelect(index, event); } }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold capitalize text-[var(--text)]">{index + 1}. {formatBlockKind(block.kind)}</span>
              <span className="flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]"><span className={`h-2 w-2 ink-zone-${block.zone}`} aria-hidden="true" />{zone.label} {zone.name}</span>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDuration(block.durationSec)}{block.reps && block.reps > 1 ? ` x ${block.reps}` : ''} / {target}</p>
            {preview ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{preview} using {profileLabel}</p> : missing ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{missing}</p> : null}
            {block.note ? <p className="mt-2 text-xs text-[var(--text-secondary)]">Cue: {block.note}</p> : null}
          </button>
        </div>
      </article>
    </div>
  );
}

function TargetEditor({ sport, target, onChange }: { sport: string; target: WorkoutTarget | null; onChange: (target: WorkoutTarget | null) => void }) {
  const options = getAvailableWorkoutTargets(sport);
  const value = target ? `${target.metric}:${target.mode}:${target.reference ?? ''}` : '';
  return <div className="space-y-2"><label className="block space-y-2"><span className="text-xs text-[var(--text-secondary)]">Training target</span><select className={formSelectClassName} value={value} onChange={(event) => { const [metric, mode, reference] = event.target.value.split(':'); onChange(event.target.value ? { metric: metric as WorkoutTarget['metric'], mode: mode as WorkoutTarget['mode'], reference: (reference || null) as WorkoutTarget['reference'], low: target?.low ?? (metric === 'rpe' ? 6 : 0), high: target?.high ?? (metric === 'rpe' ? 7 : 0) } : null); }}><option value="">No target set</option>{options.map((option) => <option key={`${option.metric}-${option.mode}-${option.reference}`} value={`${option.metric}:${option.mode}:${option.reference ?? ''}`}>{option.label}</option>)}</select></label>{target ? <div className="grid grid-cols-2 gap-2"><label className="block space-y-1"><span className="text-xs text-[var(--text-secondary)]">Low</span><input className={formFieldClassName} type="number" step="0.01" value={target.low} onChange={(event) => onChange({ ...target, low: Number(event.target.value) })} /></label><label className="block space-y-1"><span className="text-xs text-[var(--text-secondary)]">High</span><input className={formFieldClassName} type="number" step="0.01" value={target.high} onChange={(event) => onChange({ ...target, high: Number(event.target.value) })} /></label></div> : null}</div>;
}

function formatBlockKind(kind: TempoBlockKind) {
  if (kind === 'warmup') return 'Warm-up';
  if (kind === 'cooldown') return 'Cooldown';
  if (kind === 'recovery') return 'Recovery';
  return 'Work';
}
