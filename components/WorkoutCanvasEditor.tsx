'use client';

import { Fragment, useRef, useState, type CSSProperties } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ArrowRight, Copy, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import { ValidatedNumberInput } from '@/components/ValidatedNumberInput';

import { createSessionEditorBlock, deriveSessionEditorMetrics, updateSessionEditorBlock, type SessionEditorBlock, type SessionEditorDraft } from '@/lib/session-editor';
import { formatDuration } from '@/lib/format-duration';
import { workoutCanvasDropIndex } from '@/lib/workout-canvas-drop';
import { TEMPO_ZONE_META, type TempoZone } from '@/lib/tempo-blocks';
import { getAvailableWorkoutTargets, type WorkoutTarget } from '@/lib/workout-targets';
import { formatResolvedWorkoutTarget, formatWorkoutTarget, missingProfileAction } from '@/lib/workout-target-resolution';
import type { PerformanceProfile } from '@/lib/performance-profile';
import './design/workout-canvas.css';

const zones: TempoZone[] = [1, 2, 3, 4, 5];
const names: Record<TempoZone, string> = { 1: 'Recovery', 2: 'Easy', 3: 'Steady', 4: 'Threshold', 5: 'Sprint' };
const palettePrefix = 'intensity:';
const endId = 'workout-chart-end';
const emptyId = 'workout-chart-empty';
type VisualBlock = Pick<SessionEditorBlock, 'zone' | 'durationSec' | 'reps'>;
const clone = (block: SessionEditorBlock) => createSessionEditorBlock({ ...block, clientId: '', id: null });
const effectiveSeconds = (block: SessionEditorBlock) => block.durationSec * (block.reps ?? 1);

export function WorkoutCanvasEditor({ draft, onChange, performanceProfile, profileLabel }: {
  draft: SessionEditorDraft;
  onChange: (next: SessionEditorDraft) => void;
  performanceProfile: PerformanceProfile | null;
  profileLabel: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [repeatCount, setRepeatCount] = useState(1);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [history, setHistory] = useState<SessionEditorDraft[]>([]);
  const [future, setFuture] = useState<SessionEditorDraft[]>([]);
  const [notice, setNotice] = useState('');
  const suppressPresetClick = useRef<{ zone: TempoZone; until: number } | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const blocks = draft.blocks;
  const selected = blocks.filter((block) => selectedIds.includes(block.clientId));
  const active = selected.length === 1 ? selected[0] : null;
  const activeBlocks = blocks.filter((block) => !block.skipped);
  const canMoveEarlier = selected.length > 0 && blocks.findIndex((block) => selectedIds.includes(block.clientId)) > 0;
  const canMoveLater = selected.length > 0 && blocks.findLastIndex((block) => selectedIds.includes(block.clientId)) < blocks.length - 1;
  const metrics = deriveSessionEditorMetrics(draft);
  const copiesCount = selected.length ? repeatCount - 1 : 0;
  const selectionSeconds = selected.reduce((sum, block) => sum + (block.skipped ? 0 : effectiveSeconds(block)), 0);
  const previewSeconds = metrics.durationSec + selectionSeconds * copiesCount;
  const lastSelectedIndex = selected.length ? Math.max(...selected.map((block) => blocks.findIndex((item) => item.clientId === block.clientId))) : -1;
  const chartPieces = blocks.flatMap((block, index) => {
    const real = { block, preview: false, key: block.clientId, previousSelectedZone: index > 0 && selectedIds.includes(blocks[index - 1].clientId) ? blocks[index - 1].zone : null, nextSelectedZone: index < blocks.length - 1 && selectedIds.includes(blocks[index + 1].clientId) ? blocks[index + 1].zone : null };
    if (index !== lastSelectedIndex || !copiesCount) return [real];
    const previews = Array.from({ length: copiesCount }, (_, repeat) => selected.map((part) => ({ block: part, preview: true, key: `preview-${repeat}-${part.clientId}`, previousSelectedZone: null, nextSelectedZone: null }))).flat();
    return [real, ...previews];
  });
  const draggingZone = dragId?.startsWith(palettePrefix) ? Number(dragId.slice(palettePrefix.length)) as TempoZone : null;
  const draggingBlock = dragId && !draggingZone ? blocks.find((block) => block.clientId === dragId) : null;
  const placementBlock: VisualBlock | null = draggingZone && zones.includes(draggingZone) ? { zone: draggingZone, durationSec: 600, reps: null } : null;
  const placementIndex = dropIndex ?? -1;

  function indexAtPointer() {
    const bounds = trackRef.current?.getBoundingClientRect();
    const pointer = pointerRef.current;
    if (!bounds || !pointer || pointer.x < bounds.left || pointer.x > bounds.right || pointer.y < bounds.top || pointer.y > bounds.bottom) return null;
    return workoutCanvasDropIndex(pointer.x, bounds.left, bounds.width, blocks.map(effectiveSeconds));
  }

  function commit(next: SessionEditorDraft) {
    setHistory((current) => [...current.slice(-39), draft]);
    setFuture([]);
    onChange(next);
  }
  function insert(zone: TempoZone, index = blocks.length) {
    const block = createSessionEditorBlock({ kind: zone === 1 ? 'recovery' : 'work', zone, durationSec: 600, reps: null });
    commit({ ...draft, blocks: [...blocks.slice(0, index), block, ...blocks.slice(index)] });
    setSelectedIds([block.clientId]);
    setRepeatCount(1);
    setNotice(`Zone ${zone} ${names[zone]} added at position ${index + 1}. Save the ${draft.templateId ? 'template' : 'workout'} when ready.`);
  }
  function select(id: string, additive: boolean, range: boolean) {
    const index = blocks.findIndex((block) => block.clientId === id);
    if (index < 0) return;
    setSelectedIds((current) => {
      if (range && current.length) {
        const anchor = blocks.findIndex((block) => block.clientId === current[current.length - 1]);
        return blocks.slice(Math.min(anchor, index), Math.max(anchor, index) + 1).map((block) => block.clientId);
      }
      return additive ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id] : [id];
    });
    setRepeatCount(1);
  }
  function patch(blockId: string, change: Partial<SessionEditorBlock>) {
    commit(updateSessionEditorBlock(draft, blockId, change));
    setNotice(change.skipped === true ? 'Block skipped. It no longer counts toward workout time.' : 'Block updated in the workout draft.');
  }
  function copy() {
    if (!selected.length) return;
    const end = lastSelectedIndex + 1;
    const copies = selected.map(clone);
    commit({ ...draft, blocks: [...blocks.slice(0, end), ...copies, ...blocks.slice(end)] });
    setSelectedIds(copies.map((block) => block.clientId));
    setRepeatCount(1);
    setNotice(`${copies.length} block${copies.length === 1 ? '' : 's'} copied after the selection.`);
  }
  function repeat() {
    if (!selected.length || repeatCount < 2) return;
    const end = lastSelectedIndex + 1;
    const copies = Array.from({ length: repeatCount - 1 }, () => selected.map(clone)).flat();
    commit({ ...draft, blocks: [...blocks.slice(0, end), ...copies, ...blocks.slice(end)] });
    setSelectedIds(copies.map((block) => block.clientId));
    setNotice(`Pattern repeated ${repeatCount} times. Save when ready.`);
    setRepeatCount(1);
  }
  function remove() {
    if (!selected.length) return;
    commit({ ...draft, blocks: blocks.filter((block) => !selectedIds.includes(block.clientId)) });
    setNotice(`${selected.length} block${selected.length === 1 ? '' : 's'} removed from the draft.`);
    setSelectedIds([]);
    setRepeatCount(1);
  }
  function move(direction: -1 | 1) {
    if (!selected.length) return;
    const first = blocks.findIndex((block) => selectedIds.includes(block.clientId));
    const last = blocks.findLastIndex((block) => selectedIds.includes(block.clientId));
    const neighbor = direction < 0 ? first - 1 : last + 1;
    if (neighbor < 0 || neighbor >= blocks.length || selectedIds.includes(blocks[neighbor].clientId)) return;
    const rest = blocks.filter((block) => !selectedIds.includes(block.clientId));
    const neighborIndex = rest.findIndex((block) => block.clientId === blocks[neighbor].clientId);
    rest.splice(direction < 0 ? neighborIndex : neighborIndex + 1, 0, ...selected);
    commit({ ...draft, blocks: rest });
    setRepeatCount(1);
    setNotice(`${selected.length} selected block${selected.length === 1 ? '' : 's'} moved ${direction < 0 ? 'earlier' : 'later'}.`);
  }
  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setFuture((current) => [draft, ...current]);
    onChange(previous);
    setSelectedIds([]);
    setRepeatCount(1);
    setNotice('Last draft change undone.');
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((current) => current.slice(1));
    setHistory((current) => [...current, draft]);
    onChange(next);
    setSelectedIds([]);
    setRepeatCount(1);
    setNotice('Draft change restored.');
  }
  function dragEnd(event: DragEndEvent) {
    const from = String(event.active.id);
    const to = event.over?.id ? String(event.over.id) : null;
    const pointerIndex = indexAtPointer();
    setDropIndex(null);
    setDragId(null);
    pointerRef.current = null;
    if (from.startsWith(palettePrefix)) suppressPresetClick.current = { zone: Number(from.slice(palettePrefix.length)) as TempoZone, until: Date.now() + 500 };
    if (pointerIndex === null && !to) return;
    if (from.startsWith(palettePrefix)) {
      const zone = Number(from.slice(palettePrefix.length)) as TempoZone;
      const index = pointerIndex ?? (to === endId || to === emptyId ? blocks.length : blocks.findIndex((block) => block.clientId === to));
      if (zones.includes(zone) && index >= 0) insert(zone, index);
      return;
    }
    const fromIndex = blocks.findIndex((block) => block.clientId === from);
    const toIndex = pointerIndex ?? (to === endId ? blocks.length : blocks.findIndex((block) => block.clientId === to));
    if (fromIndex < 0 || toIndex < 0) return;
    const movingIds = selectedIds.includes(from) ? selectedIds : [from];
    const moving = blocks.filter((block) => movingIds.includes(block.clientId));
    const remaining = blocks.filter((block) => !movingIds.includes(block.clientId));
    const insertion = blocks.slice(0, toIndex).filter((block) => !movingIds.includes(block.clientId)).length;
    const next = [...remaining.slice(0, insertion), ...moving, ...remaining.slice(insertion)];
    if (next.every((block, index) => block.clientId === blocks[index]?.clientId)) return;
    commit({ ...draft, blocks: next });
    setSelectedIds(moving.map((block) => block.clientId));
    setRepeatCount(1);
    setNotice(`${moving.length} block${moving.length === 1 ? '' : 's'} moved in the workout draft.`);
  }

  return <div className="canvas-preview canvas-preview--production">
    <DndContext sensors={sensors} collisionDetection={(args) => { if (!args.pointerCoordinates) return closestCenter(args); const bounds = trackRef.current?.getBoundingClientRect(); const { x, y } = args.pointerCoordinates; pointerRef.current = { x, y }; if (!bounds || x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return []; const collisions = pointerWithin(args); return collisions.length ? collisions : closestCenter(args); }} onDragStart={(event: DragStartEvent) => { pointerRef.current = null; setDropIndex(null); setDragId(String(event.active.id)); }} onDragMove={() => setDropIndex(indexAtPointer())} onDragCancel={() => { pointerRef.current = null; setDropIndex(null); setDragId(null); }} onDragEnd={dragEnd}>
      <div className="canvas-preview__workspace">
        <aside className="canvas-preview__palette" aria-label="Intensity blocks"><h2>Intensity blocks</h2><p>Click to add at the end, or drag into the chart. Each block starts at 10 min.</p><div>{zones.map((zone) => <IntensityPreset key={zone} zone={zone} onAdd={() => { const suppression = suppressPresetClick.current; if (suppression?.zone === zone && suppression.until > Date.now()) { suppressPresetClick.current = null; return; } insert(zone); }} />)}</div></aside>
        <section className="canvas-preview__session canvas-preview__session--score" aria-label="Editable workout session">
          <div className="canvas-preview__session-head"><div><h2>Workout chart</h2><p>{formatDuration(metrics.durationSec)} · {activeBlocks.length} active block{activeBlocks.length === 1 ? '' : 's'}{blocks.length !== activeBlocks.length ? ` · ${blocks.length - activeBlocks.length} skipped` : ''}{copiesCount ? <span role="status"> · preview {formatDuration(previewSeconds)}</span> : null}</p></div><span>Unsaved draft</span></div>
          <div className="canvas-preview__legend"><span>Width shows block time · Height shows effort{activeBlocks.length !== blocks.length ? ' · Skipped blocks are excluded from the total' : ''}</span></div>
          <SortableContext items={blocks.map((block) => block.clientId)} strategy={rectSortingStrategy}>
            <div className="canvas-preview__track" ref={trackRef} aria-label="Workout chart">
              {blocks.length ? <>{chartPieces.map(({ block, preview, key, previousSelectedZone, nextSelectedZone }) => <Fragment key={key}>{!preview && placementBlock && placementIndex === blocks.findIndex((item) => item.clientId === block.clientId) ? <ChartPlacement block={placementBlock} /> : null}{preview ? <ChartGhost block={block} /> : <ChartBar block={block} index={blocks.findIndex((item) => item.clientId === block.clientId)} selected={selectedIds.includes(block.clientId)} previousSelectedZone={previousSelectedZone} nextSelectedZone={nextSelectedZone} onSelect={(id, additive, range) => select(id, additive || multiSelect, range)} />}</Fragment>)}{placementBlock && placementIndex === blocks.length ? <ChartPlacement block={placementBlock} /> : null}</> : <>{placementBlock && placementIndex === 0 ? <ChartPlacement block={placementBlock} /> : null}<EmptyChartDrop /></>}
              <EndDrop active={dropIndex === blocks.length} />
            </div>
          </SortableContext>
          <div className="canvas-preview__ruler"><span>Start</span><span>{formatDuration(previewSeconds)} · Finish</span></div>
          <div className="canvas-preview__selection-toolbar">
            <span>{selected.length ? `${selected.length} block${selected.length === 1 ? '' : 's'} selected` : 'Select a bar to edit it; select several to build a pattern.'}</span>
            <div className="canvas-preview__actions" aria-label="Selected block actions">
              <button type="button" aria-pressed={multiSelect} className={multiSelect ? 'is-active' : ''} onClick={() => setMultiSelect(!multiSelect)}>Select multiple</button>
              {selected.length ? <>
                <button type="button" disabled={!canMoveEarlier} onClick={() => move(-1)}><ArrowLeft size={14} /> Earlier</button>
                <button type="button" disabled={!canMoveLater} onClick={() => move(1)}>Later <ArrowRight size={14} /></button>
                <button type="button" onClick={copy}><Copy size={14} /> Duplicate selected</button>
                <button type="button" className="is-danger" onClick={remove}><Trash2 size={14} /> Remove selected</button>
              </> : null}
            </div>
          </div>
          {active ? <BlockInspector className="canvas-preview__inspector--inline" active={active} sport={draft.sport} onPatch={patch} performanceProfile={performanceProfile} profileLabel={profileLabel} allowSkip={draft.mode !== 'create' || Boolean(draft.id) || active.skipped} /> : null}
          {selected.length ? <>
            <div className="canvas-preview__repeat"><div><strong>Repeat selected pattern</strong><span>{copiesCount ? `${repeatCount} times · ${formatDuration(previewSeconds)} preview` : 'Copies the selected bars after this pattern'}</span></div><label><span className="sr-only">Repeat count</span><input type="range" min="1" max="10" step="1" value={repeatCount} onChange={(event) => setRepeatCount(Number(event.target.value))} /><output>{repeatCount}×</output></label><button type="button" disabled={!copiesCount} onClick={repeat}>Apply repeats</button></div>
          </> : null}
          {history.length || future.length ? <div className="canvas-preview__draft-tools"><button type="button" disabled={!history.length} onClick={undo}><Undo2 size={14} /> Undo block edit</button><button type="button" disabled={!future.length} onClick={redo}><Redo2 size={14} /> Redo block edit</button></div> : null}
          {notice ? <p className="canvas-preview__notice" role="status">{notice}</p> : null}
        </section>
        {active ? <BlockInspector className="canvas-preview__inspector--desktop" active={active} sport={draft.sport} onPatch={patch} performanceProfile={performanceProfile} profileLabel={profileLabel} allowSkip={draft.mode !== 'create' || Boolean(draft.id) || active.skipped} /> : null}
      </div>
      <DragOverlay dropAnimation={null}>{draggingZone && zones.includes(draggingZone) ? <div className={`canvas-preview__drag-tile ${dropIndex !== null ? 'is-over-chart' : ''}`}><PresetContent zone={draggingZone} /></div> : draggingBlock ? <div className="canvas-preview__drag-chart" style={{ '--zone': `var(--color-zone-${draggingBlock.zone})`, '--effort-height': `${24 + draggingBlock.zone * 15}%` } as CSSProperties}><span /></div> : null}</DragOverlay>
    </DndContext>
  </div>;
}

function BlockInspector({ className, active, sport, onPatch, performanceProfile, profileLabel, allowSkip }: {
  className: string;
  active: SessionEditorBlock | null;
  sport: string;
  onPatch: (id: string, patch: Partial<SessionEditorBlock>) => void;
  performanceProfile: PerformanceProfile | null;
  profileLabel: string;
  allowSkip: boolean;
}) {
  return <aside className={`canvas-preview__inspector ${className}`} aria-label="Block details">
    <h2>Block details</h2>
    <p>Select a bar to edit its effort, time, and targets.</p>
    {active ? <BlockDetails key={active.clientId} block={active} sport={sport} onPatch={onPatch} performanceProfile={performanceProfile} profileLabel={profileLabel} allowSkip={allowSkip} /> : <p className="canvas-preview__hint">Click one bar in the chart to edit it.</p>}
  </aside>;
}

function IntensityPreset({ zone, onAdd }: { zone: TempoZone; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `${palettePrefix}${zone}` });
  return <div className="canvas-preview__preset" ref={setNodeRef}><button type="button" className="canvas-preview__preset-button" {...attributes} {...listeners} aria-label={`Zone ${zone} ${names[zone]}, 10 min. Click to add or drag into the chart.`} onClick={onAdd}><PresetContent zone={zone} /></button></div>;
}

function PresetContent({ zone }: { zone: TempoZone }) {
  return <><span className="canvas-preview__preset-swatch" style={{ background: `var(--color-zone-${zone})` }} aria-hidden="true" /><span className="canvas-preview__preset-copy"><strong>{names[zone]}</strong><small>Z{zone} · 10 min</small><span className="canvas-preview__preset-level" aria-hidden="true">{zones.map((step) => <i key={step} style={{ background: step <= zone ? `var(--color-zone-${zone})` : undefined }} />)}</span></span><Plus size={15} aria-hidden="true" /></>;
}

function ChartBar({ block, index, selected, previousSelectedZone, nextSelectedZone, onSelect }: { block: SessionEditorBlock; index: number; selected: boolean; previousSelectedZone: TempoZone | null; nextSelectedZone: TempoZone | null; onSelect: (id: string, additive: boolean, range: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.clientId });
  return <div ref={setNodeRef} className={`canvas-preview__block ${selected ? 'is-selected' : ''} ${block.skipped ? 'is-skipped' : ''} ${selected && previousSelectedZone === null ? 'is-selection-start' : ''} ${selected && nextSelectedZone === null ? 'is-selection-end' : ''} ${selected && previousSelectedZone !== null ? 'is-selection-continuation' : ''}`} style={{ '--zone': `var(--color-zone-${block.zone})`, '--effort-height': `${24 + block.zone * 15}%`, '--previous-effort-height': previousSelectedZone === null ? '0%' : `${24 + previousSelectedZone * 15}%`, flexGrow: effectiveSeconds(block), transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .15 : 1 } as CSSProperties}><button type="button" className="canvas-preview__bar" {...attributes} {...listeners} aria-pressed={selected} aria-label={`${selected ? 'Selected, ' : ''}${block.skipped ? 'Skipped, excluded from workout time, ' : ''}${TEMPO_ZONE_META[block.zone].label} ${formatBlockKind(block.kind)}, ${formatDuration(effectiveSeconds(block))}. Block ${index + 1}. Click to inspect; drag to move.`} onClick={(event) => onSelect(block.clientId, event.ctrlKey || event.metaKey, event.shiftKey)}><span className="sr-only">{block.skipped ? 'Skipped ' : ''}{TEMPO_ZONE_META[block.zone].label} block</span>{block.skipped ? <span className="canvas-preview__skipped-label" aria-hidden="true">Skipped</span> : null}</button></div>;
}

function ChartPlacement({ block }: { block: VisualBlock }) {
  return <div className="canvas-preview__block is-placement" style={{ '--zone': `var(--color-zone-${block.zone})`, '--effort-height': `${24 + block.zone * 15}%`, flexGrow: block.durationSec * (block.reps ?? 1) } as CSSProperties} aria-hidden="true"><span className="canvas-preview__bar" /></div>;
}

function ChartGhost({ block }: { block: SessionEditorBlock }) {
  return <div className="canvas-preview__block is-preview" style={{ '--zone': `var(--color-zone-${block.zone})`, '--effort-height': `${24 + block.zone * 15}%`, flexGrow: effectiveSeconds(block) } as CSSProperties} aria-hidden="true"><span className="canvas-preview__bar" /></div>;
}

function EmptyChartDrop() {
  const { setNodeRef, isOver } = useDroppable({ id: emptyId });
  return <div ref={setNodeRef} className={`canvas-preview__empty-chart ${isOver ? 'is-over' : ''}`}>Click a zone to add it, or drag one here to choose its position.</div>;
}

function EndDrop({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: endId });
  return <div ref={setNodeRef} className={`canvas-preview__end ${active || isOver ? 'is-over' : ''}`} aria-hidden="true" />;
}

function BlockDetails({ block, sport, onPatch, performanceProfile, profileLabel, allowSkip }: { block: SessionEditorBlock; sport: string; onPatch: (id: string, patch: Partial<SessionEditorBlock>) => void; performanceProfile: PerformanceProfile | null; profileLabel: string; allowSkip: boolean }) {
  const minutes = block.durationSec / 60;
  const targetSummary = block.target ? formatWorkoutTarget(block.target) : 'No target';
  const resolved = block.target ? formatResolvedWorkoutTarget(block.target, performanceProfile) : null;
  const missing = block.target ? missingProfileAction(block.target) : null;
  return <div className="canvas-preview__details">
    <div className="canvas-preview__inline">
      <strong>Edit {TEMPO_ZONE_META[block.zone].label} {formatBlockKind(block.kind)}</strong>
      <label>Block type<select value={block.kind} onChange={(event) => onPatch(block.clientId, { kind: event.target.value as SessionEditorBlock['kind'] })}><option value="work">Work</option><option value="recovery">Recovery</option><option value="warmup">Warm-up</option><option value="cooldown">Cool-down</option></select></label>
      <label>Effort<select value={block.zone} onChange={(event) => onPatch(block.clientId, { zone: Number(event.target.value) as TempoZone })}>{zones.map((zone) => <option key={zone} value={zone}>Zone {zone} · {names[zone]}</option>)}</select></label>
      <label className="canvas-preview__duration"><span>Duration <output>{formatDuration(block.durationSec)}</output></span><input type="range" aria-label="Duration in minutes" min="1" max="30" step="1" value={Math.min(30, Math.max(1, Math.round(minutes)))} onChange={(event) => onPatch(block.clientId, { durationSec: Number(event.target.value) * 60 })} /><span className="canvas-preview__slider-ends"><span>1 min</span><span>30 min</span></span></label>
    </div>
    {minutes > 30 ? <p className="canvas-preview__legacy-note">This existing block is longer than 30 min. Move the slider to set a shorter duration, or copy blocks to build a longer effort.</p> : null}
    <details className="canvas-preview__advanced"><summary>More block details</summary><div>
      <label>Exact duration (seconds)<ValidatedNumberInput min={1} max={1800} value={block.durationSec} onChange={(durationSec) => onPatch(block.clientId, { durationSec })} /></label>
      <label>Repetitions within this block<ValidatedNumberInput min={1} value={block.reps ?? 1} onChange={(reps) => onPatch(block.clientId, { reps })} /></label>
      {allowSkip ? <label className="canvas-preview__skip"><input type="checkbox" checked={block.skipped} onChange={(event) => onPatch(block.clientId, { skipped: event.target.checked })} /> Skip this block (excluded from workout time)</label> : null}
      <TargetFields sport={sport} target={block.target} onChange={(target) => onPatch(block.clientId, { target })} />
      <label>Block note<textarea value={block.note} onChange={(event) => onPatch(block.clientId, { note: event.target.value })} /></label>
      <p>Target: {targetSummary}{resolved ? ` · ${resolved} using ${profileLabel}` : missing ? ` · ${missing}` : ''}</p>
    </div></details>
  </div>;
}

function TargetFields({ sport, target, onChange }: { sport: string; target: WorkoutTarget | null; onChange: (target: WorkoutTarget | null) => void }) {
  const options = getAvailableWorkoutTargets(sport);
  const value = target ? `${target.metric}:${target.mode}:${target.reference ?? ''}` : '';
  return <div className="canvas-preview__target-fields"><label>Training target<select value={value} onChange={(event) => { const [metric, mode, reference] = event.target.value.split(':'); onChange(event.target.value ? { metric: metric as WorkoutTarget['metric'], mode: mode as WorkoutTarget['mode'], reference: (reference || null) as WorkoutTarget['reference'], low: target?.low ?? (metric === 'rpe' ? 6 : 0), high: target?.high ?? (metric === 'rpe' ? 7 : 0) } : null); }}><option value="">No target set</option>{options.map((option) => <option key={`${option.metric}-${option.mode}-${option.reference}`} value={`${option.metric}:${option.mode}:${option.reference ?? ''}`}>{option.label}</option>)}</select></label>{target ? <div><label>Low<ValidatedNumberInput min={0} step="0.01" value={target.low} onChange={(low) => onChange({ ...target, low })} /></label><label>High<ValidatedNumberInput min={0} step="0.01" value={target.high} onChange={(high) => onChange({ ...target, high })} /></label></div> : null}</div>;
}

function formatBlockKind(kind: SessionEditorBlock['kind']) {
  if (kind === 'warmup') return 'warm-up';
  if (kind === 'cooldown') return 'cool-down';
  if (kind === 'recovery') return 'recovery';
  return 'work';
}
