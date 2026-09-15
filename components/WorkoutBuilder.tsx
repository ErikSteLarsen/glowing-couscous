'use client';

import { useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  addSessionEditorBlock,
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
import { compactDangerButtonClassName, compactPrimaryButtonClassName, compactSecondaryButtonClassName, formFieldClassName, formSelectClassName, formTextareaClassName } from '@/components/ui';

const blockKinds: readonly TempoBlockKind[] = ['warmup', 'work', 'recovery', 'cooldown'];

export function WorkoutBuilder({
  draft,
  onChange,
  showSchedule = false,
  summaryPlaceholder = 'Coach notes or session intent',
  durationUnit = 'seconds',
  performanceProfile = null,
  profileLabel = 'current profile',
}: {
  draft: SessionEditorDraft;
  onChange: (draft: SessionEditorDraft) => void;
  showSportMetrics?: boolean;
  showSchedule?: boolean;
  summaryPlaceholder?: string;
  durationUnit?: 'minutes' | 'seconds';
  performanceProfile?: PerformanceProfile | null;
  profileLabel?: string;
}) {
  const [selection, setSelection] = useState<number[]>(draft.blocks.length ? [0] : []);
  const [clipboard, setClipboard] = useState<SessionEditorBlock[]>([]);
  const [history, setHistory] = useState<SessionEditorDraft[]>([]);
  const [future, setFuture] = useState<SessionEditorDraft[]>([]);
  const lastFocused = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const metrics = deriveSessionEditorMetrics(draft);
  const selected = selection.map((index) => draft.blocks[index]).filter(Boolean);
  const selectedBlock = selected[0] ?? null;

  function commit(next: SessionEditorDraft) {
    setHistory((current) => [...current.slice(-39), draft]);
    setFuture([]);
    onChange(next);
  }

  function select(index: number, event?: React.MouseEvent | React.KeyboardEvent) {
    lastFocused.current = draft.blocks[index]?.clientId ?? null;
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

  function insert(kind: TempoBlockKind, index = draft.blocks.length) {
    const block = createSessionEditorBlock({ kind, zone: kind === 'recovery' ? 1 : kind === 'warmup' || kind === 'cooldown' ? 1 : 3 });
    commit({ ...draft, blocks: [...draft.blocks.slice(0, index), block, ...draft.blocks.slice(index)] });
    setSelection([index]);
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

  function onDragEnd(event: DragEndEvent) {
    const activeIndex = draft.blocks.findIndex((block) => block.clientId === event.active.id);
    const overIndex = draft.blocks.findIndex((block) => block.clientId === event.over?.id);
    if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return;
    const moving = selection.includes(activeIndex) ? selection : [activeIndex];
    const selectedBlocks = moving.map((index) => draft.blocks[index]);
    const remaining = draft.blocks.filter((_, index) => !moving.includes(index));
    const before = draft.blocks.slice(0, overIndex).filter((_, index) => !moving.includes(index)).length;
    commit({ ...draft, blocks: [...remaining.slice(0, before), ...selectedBlocks, ...remaining.slice(before)] });
    setSelection(selectedBlocks.map((_, index) => before + index));
  }

  function updateTarget(patch: Partial<WorkoutTarget>) {
    if (!selectedBlock) return;
    const target = selectedBlock.target ?? { metric: 'rpe' as const, mode: 'absolute' as const, reference: null, low: 6, high: 7 };
    applyBlockPatch({ target: { ...target, ...patch } });
  }

  return (
    <section className="min-w-0 space-y-5" aria-label="Visual workout builder">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-2"><span className="text-sm font-medium text-[var(--text-secondary)]">Workout title</span><input className={formFieldClassName} value={draft.title} onChange={(event) => commit(updateSessionEditorFields(draft, { title: event.target.value }))} /></label>
        <label className="block space-y-2"><span className="text-sm font-medium text-[var(--text-secondary)]">Sport</span><select className={formSelectClassName} value={draft.sport} onChange={(event) => commit(updateSessionEditorFields(draft, { sport: event.target.value }))}>{SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}</select></label>
      </div>
      <label className="block space-y-2"><span className="text-sm font-medium text-[var(--text-secondary)]">Summary</span><textarea className={formTextareaClassName} value={draft.summary} placeholder={summaryPlaceholder} onChange={(event) => commit(updateSessionEditorFields(draft, { summary: event.target.value }))} /></label>
      {showSchedule ? <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-2"><span className="text-sm font-medium text-[var(--text-secondary)]">Scheduled date</span><input className={formFieldClassName} type="date" value={draft.scheduledDate ?? ''} onChange={(event) => commit(updateSessionEditorSchedule(draft, { scheduledDate: event.target.value || null }))} /></label><label className="block space-y-2"><span className="text-sm font-medium text-[var(--text-secondary)]">Time</span><input className={formFieldClassName} type="time" value={draft.timeLabel ?? ''} onChange={(event) => commit(updateSessionEditorSchedule(draft, { timeLabel: event.target.value || null }))} /></label></div> : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(10rem,0.6fr)_minmax(0,1.45fr)_minmax(16rem,0.8fr)]">
        <aside className="space-y-3 rounded-[10px] border border-[var(--border)] bg-[var(--field-surface)] p-3" aria-label="Block palette">
          <h2 className="text-sm font-semibold text-[var(--text)]">Add blocks</h2>
          <p className="text-xs leading-5 text-[var(--text-secondary)]">Choose a phase, then tune it on the canvas.</p>
          <div className="grid gap-2">{blockKinds.map((kind) => <button key={kind} type="button" className={compactSecondaryButtonClassName} onClick={() => insert(kind)}>Add {kind}</button>)}</div>
          <button type="button" className={compactSecondaryButtonClassName} onClick={() => { insert('warmup'); insert('work'); insert('cooldown'); }}>Quick start</button>
        </aside>

        <div className="min-w-0 space-y-3" onKeyDown={(event) => { if (event.key === 'Escape') setSelection([]); if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); setSelection(draft.blocks.map((_, index) => index)); } }}>
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-base font-semibold text-[var(--text)]">Workout canvas</h2><p className="text-xs text-[var(--text-secondary)]">{selection.length ? `${selection.length} block${selection.length === 1 ? '' : 's'} selected` : 'Select a block to inspect it'}</p></div><MetricText>{formatDuration(metrics.durationSec)} · {metrics.tss} TSS</MetricText></div>
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--field-surface)] p-3"><SessionBlockBar segments={metrics.segments} /><p className="mt-2 text-xs text-[var(--text-secondary)]">Intensity timeline. Segment width follows duration; height and color show zone.</p></div>
          <div className="flex flex-wrap gap-2" aria-label="Canvas commands"><button type="button" className={compactSecondaryButtonClassName} disabled={!selection.length} onClick={() => setClipboard(selected.map((block) => ({ ...block, id: null })))}>Copy</button><button type="button" className={compactSecondaryButtonClassName} disabled={!clipboard.length} onClick={() => { const at = (selection.at(-1) ?? draft.blocks.length - 1) + 1; const copies = clipboard.map((block) => createSessionEditorBlock({ ...block, id: null })); commit({ ...draft, blocks: [...draft.blocks.slice(0, at), ...copies, ...draft.blocks.slice(at)] }); setSelection(copies.map((_, index) => at + index)); }}>Paste</button><button type="button" className={compactSecondaryButtonClassName} disabled={!selection.length} onClick={() => { const at = (selection.at(-1) ?? -1) + 1; const copies = selected.map((block) => createSessionEditorBlock({ ...block, id: null })); commit({ ...draft, blocks: [...draft.blocks.slice(0, at), ...copies, ...draft.blocks.slice(at)] }); setSelection(copies.map((_, index) => at + index)); }}>Duplicate</button><button type="button" className={compactSecondaryButtonClassName} disabled={!selection.length} onClick={() => commit({ ...draft, blocks: repeatBlockSelection(draft.blocks, selection, 1) })}>Repeat once</button><button type="button" className={compactSecondaryButtonClassName} disabled={!selection.length} onClick={() => moveSelection(-1)}>Earlier</button><button type="button" className={compactSecondaryButtonClassName} disabled={!selection.length} onClick={() => moveSelection(1)}>Later</button><button type="button" className={compactSecondaryButtonClassName} disabled={!history.length} onClick={undo}>Undo</button><button type="button" className={compactSecondaryButtonClassName} disabled={!future.length} onClick={redo}>Redo</button><button type="button" className={compactDangerButtonClassName} disabled={!selection.length} onClick={() => { commit({ ...draft, blocks: draft.blocks.filter((_, index) => !selection.includes(index)) }); setSelection([]); }}>Delete</button></div>
          <DndContext sensors={sensors} onDragEnd={onDragEnd} accessibility={{ announcements: { onDragStart: ({ active }) => `Picked up ${String(active.id)}.`, onDragOver: ({ active, over }) => `Moving ${String(active.id)} over ${over ? String(over.id) : 'the canvas'}.`, onDragEnd: ({ active, over }) => `Moved ${String(active.id)} to ${over ? String(over.id) : 'its previous position'}.`, onDragCancel: ({ active }) => `Cancelled movement for ${String(active.id)}.` } }}><SortableContext items={draft.blocks.map((block) => block.clientId)} strategy={verticalListSortingStrategy}><div className="space-y-2">{draft.blocks.map((block, index) => <SortableBlock key={block.clientId} block={block} index={index} selected={selection.includes(index)} profile={performanceProfile} profileLabel={profileLabel} onSelect={select} onInsert={() => insert('work', index)} />)}</div></SortableContext></DndContext>
        </div>

        <aside className="space-y-4 rounded-[10px] border border-[var(--border)] bg-[var(--field-surface)] p-4" aria-live="polite">
          <div><h2 className="text-base font-semibold text-[var(--text)]">{selected.length > 1 ? `Edit ${selected.length} blocks` : 'Inspector'}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{selected.length > 1 ? 'Changes apply to the selected sequence.' : 'Tune the selected block.'}</p></div>
          {selectedBlock ? <><label className="block space-y-2"><span className="text-xs text-[var(--text-secondary)]">Zone</span><select className={formSelectClassName} value={selectedBlock.zone} onChange={(event) => applyBlockPatch({ zone: Number(event.target.value) as TempoZone })}>{Object.entries(TEMPO_ZONE_META).map(([zone, meta]) => <option key={zone} value={zone}>{meta.label} {meta.name}</option>)}</select></label><label className="block space-y-2"><span className="text-xs text-[var(--text-secondary)]">Duration ({durationUnit})</span><input className={formFieldClassName} type="number" min="1" value={durationUnit === 'minutes' ? Math.round(selectedBlock.durationSec / 60) : selectedBlock.durationSec} onChange={(event) => applyBlockPatch({ durationSec: Number(event.target.value) * (durationUnit === 'minutes' ? 60 : 1) })} /></label><label className="block space-y-2"><span className="text-xs text-[var(--text-secondary)]">Occurrences</span><input className={formFieldClassName} type="number" min="1" value={selectedBlock.reps ?? ''} onChange={(event) => applyBlockPatch({ reps: event.target.value ? Number(event.target.value) : null })} /></label><TargetEditor sport={draft.sport} target={selectedBlock.target} onChange={(target) => applyBlockPatch({ target })} /><label className="block space-y-2"><span className="text-xs text-[var(--text-secondary)]">Coaching cue</span><textarea className={formTextareaClassName} value={selectedBlock.note} onChange={(event) => applyBlockPatch({ note: event.target.value })} /></label><div className="flex flex-wrap gap-2"><button type="button" className={compactSecondaryButtonClassName} onClick={() => applyBlockPatch({ target: null })}>Clear target</button><button type="button" className={compactSecondaryButtonClassName} onClick={() => applyBlockPatch({ note: '', reps: null })}>Clear notes and reps</button></div></> : <p className="text-sm text-[var(--text-secondary)]">Select a block on the canvas.</p>}
        </aside>
      </div>
    </section>
  );
}

function SortableBlock({ block, index, selected, profile, profileLabel, onSelect, onInsert }: { block: SessionEditorBlock; index: number; selected: boolean; profile: PerformanceProfile | null; profileLabel: string; onSelect: (index: number, event?: React.MouseEvent | React.KeyboardEvent) => void; onInsert: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.clientId });
  const target = block.target ? formatWorkoutTarget(block.target) : 'No target';
  const preview = block.target ? formatResolvedWorkoutTarget(block.target, profile) : null;
  const missing = block.target ? missingProfileAction(block.target) : null;
  const zone = TEMPO_ZONE_META[block.zone];
  return <div className="space-y-1"><button type="button" className="w-full text-left text-xs text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]" onClick={onInsert}>Insert block here</button><article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }} className={`rounded-[10px] border p-3 ${selected ? 'border-[var(--brand)] bg-[var(--brand-tint)]' : 'border-[var(--border)] bg-[var(--surface)]'}`}><div className="flex items-start gap-3"><button type="button" className="mt-1 cursor-grab text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]" aria-label={`Drag block ${index + 1}`} {...attributes} {...listeners}>Drag</button><button type="button" className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]" aria-pressed={selected} onClick={(event) => onSelect(index, event)} onKeyDown={(event) => { if (event.code === 'Space') { event.preventDefault(); onSelect(index, event); } }}><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold capitalize text-[var(--text)]">{index + 1}. {block.kind}</span><span className="text-xs font-semibold" style={{ color: zone.solid }}>{zone.label} {zone.name}</span></div><p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDuration(block.durationSec)}{block.reps && block.reps > 1 ? ` × ${block.reps}` : ''} · {target}</p>{preview ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{preview} using {profileLabel}</p> : missing ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{missing}</p> : null}{block.note ? <p className="mt-2 text-xs text-[var(--text-secondary)]">Cue: {block.note}</p> : null}</button></div></article></div>;
}

function TargetEditor({ sport, target, onChange }: { sport: string; target: WorkoutTarget | null; onChange: (target: WorkoutTarget | null) => void }) {
  const options = getAvailableWorkoutTargets(sport);
  const value = target ? `${target.metric}:${target.mode}:${target.reference ?? ''}` : '';
  return <div className="space-y-2"><label className="block space-y-2"><span className="text-xs text-[var(--text-secondary)]">Prescription</span><select className={formSelectClassName} value={value} onChange={(event) => { const [metric, mode, reference] = event.target.value.split(':'); onChange(event.target.value ? { metric: metric as WorkoutTarget['metric'], mode: mode as WorkoutTarget['mode'], reference: (reference || null) as WorkoutTarget['reference'], low: target?.low ?? (metric === 'rpe' ? 6 : 0), high: target?.high ?? (metric === 'rpe' ? 7 : 0) } : null); }}><option value="">No target</option>{options.map((option) => <option key={`${option.metric}-${option.mode}-${option.reference}`} value={`${option.metric}:${option.mode}:${option.reference ?? ''}`}>{option.label}</option>)}</select></label>{target ? <div className="grid grid-cols-2 gap-2"><label className="block space-y-1"><span className="text-xs text-[var(--text-secondary)]">Low</span><input className={formFieldClassName} type="number" step="0.01" value={target.low} onChange={(event) => onChange({ ...target, low: Number(event.target.value) })} /></label><label className="block space-y-1"><span className="text-xs text-[var(--text-secondary)]">High</span><input className={formFieldClassName} type="number" step="0.01" value={target.high} onChange={(event) => onChange({ ...target, high: Number(event.target.value) })} /></label></div> : null}</div>;
}
