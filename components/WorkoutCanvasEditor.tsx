'use client';

import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Copy, Minus, Plus, Redo2, Trash2, Undo2, X } from 'lucide-react';
import { ValidatedNumberInput } from '@/components/ValidatedNumberInput';

import { createSessionEditorBlock, deriveSessionEditorMetrics, updateSessionEditorBlock, type SessionEditorBlock, type SessionEditorDraft } from '@/lib/session-editor';
import { formatDuration, formatDurationExact } from '@/lib/format-duration';
import { workoutCanvasDropIndex } from '@/lib/workout-canvas-drop';
import { TEMPO_ZONE_META, type TempoZone } from '@/lib/tempo-blocks';
import { getAvailableWorkoutTargets, type WorkoutTarget } from '@/lib/workout-targets';
import { isProfilePaceZoneReference, targetOptionReference } from '@/lib/workout-targets';
import { adjustWorkoutTarget, targetAdjustmentLabel } from '@/lib/workout-target-adjustment';
import { ZONE_BANDS, chartHeightPercent, chartIntensityFraction, defaultTargetMetric, presetTarget, referenceValue, reanchorProfilePaceTarget, zoneForTarget } from '@/lib/workout-zone-intensity';
import { intensityColor } from '@/lib/intensity-color';
import { formatResolvedWorkoutTarget, formatWorkoutTarget, missingProfileAction } from '@/lib/workout-target-resolution';
import { calculateOlympiatoppenHeartRateZones, formatPaceSecondsPerKm, getRunningPaceZones, hasCompleteRunningPaceZones, OLYMPIATOPPEN_HEART_RATE_PERCENT_BANDS } from '@/lib/profile-training-zones';
import { insertPauseAfterSelection, insertPauseBeforeSelection, repeatPatternWithPauses } from '@/lib/workout-pattern';
import type { PerformanceProfile } from '@/lib/performance-profile';
import './design/workout-canvas.css';

const zones: TempoZone[] = [1, 2, 3, 4, 5];
const names: Record<TempoZone, string> = { 1: 'Recovery', 2: 'Easy', 3: 'Steady', 4: 'Threshold', 5: 'Sprint' };
const palettePrefix = 'intensity:';
const endId = 'workout-chart-end';
const emptyId = 'workout-chart-empty';
type VisualBlock = Pick<SessionEditorBlock, 'zone' | 'durationSec' | 'reps' | 'target'>;
const clone = (block: SessionEditorBlock) => createSessionEditorBlock({ ...block, clientId: '', id: null });
const effectiveSeconds = (block: SessionEditorBlock) => block.durationSec * (block.reps ?? 1);

export function WorkoutCanvasEditor({ draft, onChange, performanceProfile, profileLabel, showDraftStatus = true, targetDialogRequest = 0 }: {
  draft: SessionEditorDraft;
  onChange: (next: SessionEditorDraft) => void;
  performanceProfile: PerformanceProfile | null;
  profileLabel: string;
  showDraftStatus?: boolean;
  targetDialogRequest?: number;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPhoneLayout, setIsPhoneLayout] = useState(false);
  const [advancedControlsOpen, setAdvancedControlsOpen] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [repeatCount, setRepeatCount] = useState(1);
  const [pauseSeconds, setPauseSeconds] = useState(30);
  const [pauseBetweenRepeats, setPauseBetweenRepeats] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [history, setHistory] = useState<SessionEditorDraft[]>([]);
  const [future, setFuture] = useState<SessionEditorDraft[]>([]);
  const [notice, setNotice] = useState('');
  const [sessionTargetChoice, setSessionTargetChoice] = useState('');
  const [targetDialogNotice, setTargetDialogNotice] = useState('');
  const [blockTargetNotice, setBlockTargetNotice] = useState('');
  const targetDialogRef = useRef<HTMLDialogElement | null>(null);
  const blockTargetDialogRef = useRef<HTMLDialogElement | null>(null);
  const [blockTargetId, setBlockTargetId] = useState<string | null>(null);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsPhoneLayout(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);
  useEffect(() => { if (targetDialogRequest > 0 && !targetDialogRef.current?.open) { setTargetDialogNotice(''); targetDialogRef.current?.showModal(); } }, [targetDialogRequest]);
  useEffect(() => { if (blockTargetId && !blockTargetDialogRef.current?.open) blockTargetDialogRef.current?.showModal(); }, [blockTargetId]);
  const suppressPresetClick = useRef<TempoZone | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const blocks = draft.blocks;
  const blockTarget = blockTargetId ? blocks.find((block) => block.clientId === blockTargetId) ?? null : null;
  const selected = blocks.filter((block) => selectedIds.includes(block.clientId));
  const active = selected.length === 1 ? selected[0] : null;
  const activeBlocks = blocks.filter((block) => !block.skipped && block.kind !== 'pause');
  const targetedBlocks = activeBlocks.filter((block) => block.target);
  const targetedSelection = selected.filter((block) => !block.skipped && block.kind !== 'pause' && block.target);
  const targetOptions = getAvailableWorkoutTargets(draft.sport).filter((option) => isTargetOptionAvailable(draft.sport, option, performanceProfile));
  const defaultTarget = activeBlocks.find((block) => block.target)?.target ?? presetTarget(draft.sport, 2, performanceProfile);
  const defaultChoice = targetOptionKey(defaultTarget);
  const fallbackTarget = presetTarget(draft.sport, 2, performanceProfile);
  const fallbackChoice = targetOptionKey(fallbackTarget);
  const candidateChoice = sessionTargetChoice || defaultChoice;
  const choiceValue = targetOptions.some((option) => targetOptionKey(option) === candidateChoice) ? candidateChoice : fallbackChoice;
  const chosenTarget = targetOptions.find((option) => targetOptionKey(option) === choiceValue);
  const sessionMetric = chosenTarget?.metric ?? activeBlocks.find((block) => block.target)?.target?.metric ?? defaultTargetMetric(draft.sport);
  const canMoveEarlier = selected.length > 0 && blocks.findIndex((block) => selectedIds.includes(block.clientId)) > 0;
  const canMoveLater = selected.length > 0 && blocks.findLastIndex((block) => selectedIds.includes(block.clientId)) < blocks.length - 1;
  const metrics = deriveSessionEditorMetrics(draft);
  const copiesCount = selected.some((block) => block.kind !== 'pause') ? repeatCount - 1 : 0;
  const selectionSeconds = selected.reduce((sum, block) => sum + (block.skipped ? 0 : effectiveSeconds(block)), 0);
  const repeatPauseSeconds = pauseBetweenRepeats ? pauseSeconds : 0;
  const previewSeconds = metrics.durationSec + (selectionSeconds + repeatPauseSeconds) * copiesCount;
  const lastSelectedIndex = selected.length ? Math.max(...selected.map((block) => blocks.findIndex((item) => item.clientId === block.clientId))) : -1;
  const firstSelectedIndex = selected.length ? Math.min(...selected.map((block) => blocks.findIndex((item) => item.clientId === block.clientId))) : -1;
  const canAddPauseBefore = firstSelectedIndex > 0 && blocks[firstSelectedIndex - 1].kind !== 'pause' && blocks[firstSelectedIndex].kind !== 'pause';
  const canAddPause = lastSelectedIndex >= 0 && lastSelectedIndex < blocks.length - 1 && blocks[lastSelectedIndex].kind !== 'pause' && blocks[lastSelectedIndex + 1].kind !== 'pause';
  const chartPieces = blocks.flatMap((block, index) => {
    const real = { block, preview: false, key: block.clientId, previousSelectedHeight: index > 0 && selectedIds.includes(blocks[index - 1].clientId) ? chartHeightPercent(blocks[index - 1].target, blocks[index - 1].zone, draft.sport, performanceProfile, blocks[index - 1].kind === 'pause') : null, nextSelectedZone: index < blocks.length - 1 && selectedIds.includes(blocks[index + 1].clientId) ? blocks[index + 1].zone : null };
    if (index !== lastSelectedIndex || !copiesCount) return [real];
    const previews = Array.from({ length: copiesCount }, (_, repeat) => [
      ...(repeatPauseSeconds ? [{ block: { ...selected[0], clientId: `preview-pause-${repeat}`, kind: 'pause' as const, zone: 1 as const, durationSec: repeatPauseSeconds, reps: null, target: null }, preview: true, key: `preview-pause-${repeat}`, previousSelectedHeight: null, nextSelectedZone: null }] : []),
      ...selected.map((part) => ({ block: part, preview: true, key: `preview-${repeat}-${part.clientId}`, previousSelectedHeight: null, nextSelectedZone: null })),
    ]).flat();
    return [real, ...previews];
  });
  const draggingZone = dragId?.startsWith(palettePrefix) ? Number(dragId.slice(palettePrefix.length)) as TempoZone : null;
  const draggingBlock = dragId && !draggingZone ? blocks.find((block) => block.clientId === dragId) : null;
  const placementBlock: VisualBlock | null = draggingZone && zones.includes(draggingZone) ? { zone: draggingZone, durationSec: 600, reps: null, target: presetTarget(draft.sport, draggingZone, performanceProfile, sessionMetric, chosenTarget?.mode, chosenTarget?.reference) } : null;
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
    const inheritedTarget = activeBlocks.find((item) => item.target)?.target;
    const metric = chosenTarget?.metric ?? inheritedTarget?.metric ?? defaultTargetMetric(draft.sport);
    const mode = chosenTarget?.mode ?? inheritedTarget?.mode;
    const targetReference = chosenTarget ? chosenTarget.reference : inheritedTarget?.reference;
    const block = createSessionEditorBlock({ kind: zone === 1 ? 'recovery' : 'work', zone, durationSec: 600, reps: null, target: presetTarget(draft.sport, zone, performanceProfile, metric, mode, targetReference) });
    commit({ ...draft, blocks: [...blocks.slice(0, index), block, ...blocks.slice(index)] });
    setSelectedIds([block.clientId]);
    setRepeatCount(1);
    setNotice(`Zone ${zone} ${names[zone]} added at position ${index + 1}. Save the workout when ready.`);
  }
  function select(id: string, additive: boolean, range: boolean) {
    const index = blocks.findIndex((block) => block.clientId === id);
    if (index < 0) return;
    setSelectedIds((current) => {
      if (range && current.length) {
        const anchor = blocks.findIndex((block) => block.clientId === current[current.length - 1]);
        return blocks.slice(Math.min(anchor, index), Math.max(anchor, index) + 1).map((block) => block.clientId);
      }
      if (current.includes(id)) return current.filter((item) => item !== id);
      return additive ? [...current, id] : [id];
    });
    setRepeatCount(1);
  }
  function patch(blockId: string, change: Partial<SessionEditorBlock>) {
    const current = blocks.find((item) => item.clientId === blockId);
    if (current && current.kind !== 'pause') {
      if (change.zone !== undefined && change.zone !== current.zone) change = { ...change, target: presetTarget(draft.sport, change.zone, performanceProfile, current.target?.metric ?? sessionMetric, current.target?.mode, current.target?.reference) };
      else if (change.target) {
        const zone = zoneForTarget(change.target, draft.sport, performanceProfile) ?? current.zone;
        change = { ...change, target: reanchorProfilePaceTarget(change.target, performanceProfile, zone), zone };
      }
    }
    commit(updateSessionEditorBlock(draft, blockId, change));
    setNotice(change.skipped === true ? 'Block skipped. It no longer counts toward workout time.' : 'Block updated in the workout draft.');
  }
  function openBlockTargetDialog(blockId: string) {
    setBlockTargetNotice('');
    setBlockTargetId(blockId);
  }
  function adjustTargets(scope: 'selection' | 'session', direction: -1 | 1) {
    const eligible = scope === 'selection' ? targetedSelection : targetedBlocks;
    const ids = new Set(eligible.map((block) => block.clientId));
    let changed = 0;
    const nextBlocks = blocks.map((block) => {
      if (!ids.has(block.clientId) || !block.target) return block;
      const target = adjustWorkoutTarget(block.target, direction);
      if (!target) return block;
      changed += 1;
      const zone = zoneForTarget(target, draft.sport, performanceProfile) ?? block.zone;
      return { ...block, target: reanchorProfilePaceTarget(target, performanceProfile, zone), zone };
    });
    if (!changed) return;
    commit({ ...draft, blocks: nextBlocks });
    setNotice(`${direction > 0 ? 'Increased' : 'Decreased'} intensity for ${changed} ${scope === 'session' ? 'session' : 'selected'} block${changed === 1 ? '' : 's'}. Save when ready.`);
    if (scope === 'session') setTargetDialogNotice(`${changed} target${changed === 1 ? '' : 's'} ${direction > 0 ? 'increased' : 'decreased'} in the draft.`);
  }
  function applySessionTargets() {
    if (!chosenTarget) return;
    if (!blocks.some((block) => block.kind !== 'pause')) { targetDialogRef.current?.close(); return; }
    const nextBlocks = blocks.map((block) => block.kind === 'pause' ? block : { ...block, target: presetTarget(draft.sport, block.zone, performanceProfile, chosenTarget.metric, chosenTarget.mode, chosenTarget.reference) });
    commit({ ...draft, blocks: nextBlocks });
    setNotice(`${chosenTarget.label} zone presets applied to ${nextBlocks.filter((block) => block.kind !== 'pause').length} block${nextBlocks.filter((block) => block.kind !== 'pause').length === 1 ? '' : 's'}. Save when ready.`);
    targetDialogRef.current?.close();
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
    if (!copiesCount) return;
    const nextBlocks = repeatPatternWithPauses(blocks, selectedIds, repeatCount, repeatPauseSeconds);
    commit({ ...draft, blocks: nextBlocks });
    setSelectedIds(nextBlocks.slice(lastSelectedIndex + 1, lastSelectedIndex + 1 + (selected.length + (repeatPauseSeconds ? 1 : 0)) * (repeatCount - 1)).map((block) => block.clientId));
    setNotice(`Pattern repeated ${repeatCount} times${repeatPauseSeconds ? ` with ${repeatPauseSeconds}-second pauses` : ''}. Save when ready.`);
    setRepeatCount(1);
  }
  function addPause(position: 'before' | 'after') {
    const nextBlocks = position === 'before' ? insertPauseBeforeSelection(blocks, selectedIds, pauseSeconds) : insertPauseAfterSelection(blocks, selectedIds, pauseSeconds);
    if (nextBlocks === blocks) return;
    commit({ ...draft, blocks: nextBlocks });
    setSelectedIds([nextBlocks[position === 'before' ? firstSelectedIndex : lastSelectedIndex + 1].clientId]);
    setRepeatCount(1);
    setNotice(`${pauseSeconds}-second pause added ${position} the selection. Save when ready.`);
  }
  function remove() {
    if (!selected.length) return;
    commit({ ...draft, blocks: blocks.filter((block) => !selectedIds.includes(block.clientId)) });
    setNotice(`${selected.length} block${selected.length === 1 ? '' : 's'} removed from the draft.`);
    setSelectedIds([]);
    setRepeatCount(1);
  }
  function selectOnlyBlock(blockId: string) {
    setSelectedIds([blockId]);
    setRepeatCount(1);
  }
  function moveBlock(blockId: string, direction: -1 | 1) {
    const index = blocks.findIndex((block) => block.clientId === blockId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) return;
    const nextBlocks = [...blocks];
    [nextBlocks[index], nextBlocks[nextIndex]] = [nextBlocks[nextIndex], nextBlocks[index]];
    commit({ ...draft, blocks: nextBlocks });
    setSelectedIds([blockId]);
    setRepeatCount(1);
    setNotice(`Block moved ${direction < 0 ? 'up' : 'down'} to position ${nextIndex + 1}.`);
  }
  function duplicateBlock(blockId: string) {
    const index = blocks.findIndex((block) => block.clientId === blockId);
    if (index < 0) return;
    const duplicate = clone(blocks[index]);
    commit({ ...draft, blocks: [...blocks.slice(0, index + 1), duplicate, ...blocks.slice(index + 1)] });
    setSelectedIds([duplicate.clientId]);
    setRepeatCount(1);
    setNotice(`Block copied to position ${index + 2}.`);
  }
  function removeBlock(blockId: string) {
    const index = blocks.findIndex((block) => block.clientId === blockId);
    if (index < 0) return;
    const nextBlocks = blocks.filter((block) => block.clientId !== blockId);
    commit({ ...draft, blocks: nextBlocks });
    setSelectedIds([]);
    setRepeatCount(1);
    setNotice(`${formatBlockKind(blocks[index].kind)} block removed from the draft.`);
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
    if (from.startsWith(palettePrefix)) {
      const zone = Number(from.slice(palettePrefix.length)) as TempoZone;
      suppressPresetClick.current = zone;
      window.setTimeout(() => { if (suppressPresetClick.current === zone) suppressPresetClick.current = null; }, 500);
    }
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
        <aside className="canvas-preview__palette" aria-label="Add workout blocks"><h2><span className="canvas-preview__palette-title--desktop">Intensity blocks</span><span className="canvas-preview__palette-title--mobile">Add a block</span></h2><p className="canvas-preview__palette-help--desktop">Click an effort level to add a 10-minute block with a suggested target, or drag it into position.</p><p className="canvas-preview__palette-help--mobile">Tap an effort level to add a 10-minute block with a suggested target.</p><div>{zones.map((zone) => <IntensityPreset key={zone} zone={zone} onAdd={() => { if (suppressPresetClick.current === zone) { suppressPresetClick.current = null; return; } insert(zone); }} />)}</div></aside>
        <section className="canvas-preview__session canvas-preview__session--score" aria-label="Editable workout session">
          <div className="canvas-preview__session-head">
            <div className="canvas-preview__session-title"><h2><span className="canvas-preview__chart-title--desktop">Workout chart</span><span className="canvas-preview__chart-title--mobile">Workout blocks</span></h2><p>{formatDurationExact(metrics.durationSec)} · {activeBlocks.length} active block{activeBlocks.length === 1 ? '' : 's'}{blocks.filter((block) => block.kind === 'pause').length ? ` · ${blocks.filter((block) => block.kind === 'pause').length} pause${blocks.filter((block) => block.kind === 'pause').length === 1 ? '' : 's'}` : ''}{blocks.some((block) => block.skipped) ? ` · ${blocks.filter((block) => block.skipped).length} skipped` : ''}{copiesCount ? <span role="status"> · preview {formatDurationExact(previewSeconds)}</span> : null}</p></div>
            <div className="canvas-preview__editor-tools">
              {showDraftStatus ? <span className="canvas-preview__draft-label">Unsaved draft</span> : null}
              {history.length || future.length ? <div className="canvas-preview__draft-tools" aria-label="Block edit history"><button type="button" aria-label="Undo block edit" title="Undo" disabled={!history.length} onClick={undo}><Undo2 size={16} /></button><button type="button" aria-label="Redo block edit" title="Redo" disabled={!future.length} onClick={redo}><Redo2 size={16} /></button></div> : null}
              <div className="canvas-preview__editor-selection" aria-label="Block selection">
                <span className="canvas-preview__selected-count" aria-live="polite" aria-label={`${selected.length} blocks selected`} title={`${selected.length} blocks selected`}>{selected.length}</span>
                <button type="button" aria-label="Select multiple blocks" title="Select multiple blocks" aria-pressed={multiSelect} className={`canvas-preview__multi-select ${multiSelect ? 'is-active' : ''}`} onClick={() => setMultiSelect(!multiSelect)}>Multi-select</button>
              </div>
              {selected.length ? <div className="canvas-preview__actions" aria-label="Selected block actions">
                <button type="button" aria-label="Move selected blocks earlier" title="Move earlier" disabled={!canMoveEarlier} onClick={() => move(-1)}><ArrowLeft size={16} /></button>
                <button type="button" aria-label="Move selected blocks later" title="Move later" disabled={!canMoveLater} onClick={() => move(1)}><ArrowRight size={16} /></button>
                <button type="button" aria-label="Duplicate selected blocks" title="Duplicate" onClick={copy}><Copy size={16} /></button>
                <button type="button" aria-label="Remove selected blocks" title="Remove" className="is-danger" onClick={remove}><Trash2 size={16} /></button>
              </div> : null}
            </div>
          </div>
          <div className="canvas-preview__legend"><span>Width shows block time · Height shows intensity within each zone · Pauses remain visible above the baseline{blocks.some((block) => block.skipped) ? ' · Skipped blocks are excluded from the total' : ''}</span></div>
          <SortableContext items={blocks.map((block) => block.clientId)} strategy={rectSortingStrategy}>
            <div className="canvas-preview__track" ref={trackRef} aria-label="Workout chart">
              {blocks.length ? <>{chartPieces.map(({ block, preview, key, previousSelectedHeight, nextSelectedZone }) => <Fragment key={key}>{!preview && placementBlock && placementIndex === blocks.findIndex((item) => item.clientId === block.clientId) ? <ChartPlacement block={placementBlock} sport={draft.sport} profile={performanceProfile} /> : null}{preview ? <ChartGhost block={block} sport={draft.sport} profile={performanceProfile} /> : <ChartBar block={block} index={blocks.findIndex((item) => item.clientId === block.clientId)} selected={selectedIds.includes(block.clientId)} previousSelectedHeight={previousSelectedHeight} nextSelectedZone={nextSelectedZone} sport={draft.sport} profile={performanceProfile} onSelect={(id, additive, range) => select(id, additive || multiSelect, range)} />}</Fragment>)}{placementBlock && placementIndex === blocks.length ? <ChartPlacement block={placementBlock} sport={draft.sport} profile={performanceProfile} /> : null}</> : <>{placementBlock && placementIndex === 0 ? <ChartPlacement block={placementBlock} sport={draft.sport} profile={performanceProfile} /> : null}<EmptyChartDrop /></>}
              <EndDrop active={dropIndex === blocks.length} />
            </div>
          </SortableContext>
          <div className="canvas-preview__ruler"><span>Start</span><span>{formatDurationExact(previewSeconds)} · Finish</span></div>
          <div className="canvas-preview__mobile-block-list">
            {blocks.length ? (
              <ol aria-label="Workout blocks" className="space-y-3">
                {blocks.map((block, index) => {
                  const isSelected = selectedIds.includes(block.clientId);
                  const targetLabel = block.target
                    ? formatResolvedWorkoutTarget(block.target, performanceProfile, draft.sport) ?? formatWorkoutTarget(block.target, draft.sport)
                    : 'No target set';
                  const blockTitle = block.kind === 'pause'
                    ? 'Pause between blocks'
                    : `Zone ${block.zone} · ${names[block.zone]} · ${formatBlockKind(block.kind)}`;
                  return (
                    <li key={block.clientId} className={`canvas-preview__mobile-block ${isSelected ? 'is-selected' : ''}`}>
                      <button type="button" aria-pressed={isSelected} aria-label={`Edit block ${index + 1}: ${blockTitle}`} onClick={() => selectOnlyBlock(block.clientId)} className="canvas-preview__mobile-block-summary">
                        <span className="canvas-preview__mobile-block-mark" style={{ background: `var(--color-zone-${block.zone})` }} aria-hidden="true" />
                        <span className="min-w-0 flex-1 text-left">
                          <strong>{index + 1}. {blockTitle}</strong>
                          <span>{formatDurationExact(effectiveSeconds(block))}{block.reps && block.reps > 1 ? ` · ${block.reps} repeats` : ''} · {block.kind === 'pause' ? 'Recovery' : targetLabel}</span>
                          {block.skipped ? <span className="canvas-preview__mobile-block-skipped">Skipped · excluded from total time</span> : null}
                        </span>
                        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                      </button>
                      <div className="canvas-preview__mobile-block-actions" aria-label={`Actions for block ${index + 1}`}>
                        <button type="button" aria-label={`Move block ${index + 1} up`} disabled={index === 0} onClick={() => moveBlock(block.clientId, -1)}><ChevronUp aria-hidden="true" size={16} /> Up</button>
                        <button type="button" aria-label={`Move block ${index + 1} down`} disabled={index === blocks.length - 1} onClick={() => moveBlock(block.clientId, 1)}><ChevronDown aria-hidden="true" size={16} /> Down</button>
                        <button type="button" aria-label={`Duplicate block ${index + 1}`} onClick={() => duplicateBlock(block.clientId)}><Copy aria-hidden="true" size={15} /> Copy</button>
                        <button type="button" aria-label={`Remove block ${index + 1}`} className="is-danger" onClick={() => removeBlock(block.clientId)}><Trash2 aria-hidden="true" size={15} /> Remove</button>
                      </div>
                      {isSelected ? <BlockInspector className="canvas-preview__inspector--mobile" active={block} selectionCount={1} targetedSelectionCount={block.target && block.kind !== 'pause' ? 1 : 0} onAdjustSelection={(direction) => adjustTargets('selection', direction)} onEditTarget={openBlockTargetDialog} sport={draft.sport} onPatch={patch} performanceProfile={performanceProfile} profileLabel={profileLabel} /> : null}
                    </li>
                  );
                })}
              </ol>
            ) : <p className="canvas-preview__mobile-block-empty">Add an intensity block above to start your workout.</p>}
          </div>
          <BlockInspector className="canvas-preview__inspector--inline" active={active} selectionCount={selected.length} targetedSelectionCount={targetedSelection.length} onAdjustSelection={(direction) => adjustTargets('selection', direction)} onEditTarget={openBlockTargetDialog} sport={draft.sport} onPatch={patch} performanceProfile={performanceProfile} profileLabel={profileLabel} />
          {selected.some((block) => block.kind !== 'pause') ? <details className="canvas-preview__pattern-disclosure" open={!isPhoneLayout || advancedControlsOpen} onToggle={(event) => setAdvancedControlsOpen(event.currentTarget.open)}>
            <summary>Repeat blocks and add pauses</summary>
            <div className="canvas-preview__pattern-tools" aria-label="Pattern and pause controls">
              <div className="canvas-preview__pattern-grid">
                <div className="canvas-preview__pattern-row">
                  <div className="canvas-preview__pattern-row-copy"><strong>Repeat selection</strong></div>
                  <div className="canvas-preview__pattern-repeat-controls"><label className="canvas-preview__pattern-check"><input type="checkbox" checked={pauseBetweenRepeats} onChange={(event) => setPauseBetweenRepeats(event.target.checked)} /> Pause between sets</label><div className="canvas-preview__pattern-stepper" role="group" aria-label="Number of sets"><button type="button" aria-label="Fewer sets" disabled={repeatCount === 1} onClick={() => setRepeatCount((count) => Math.max(1, count - 1))}><Minus size={16} /></button><output aria-live="polite">{repeatCount}×</output><button type="button" aria-label="More sets" disabled={repeatCount === 10} onClick={() => setRepeatCount((count) => Math.min(10, count + 1))}><Plus size={16} /></button></div><button className="canvas-preview__pattern-apply" type="button" disabled={!copiesCount} onClick={repeat}>Apply repeats</button></div>
                </div>
                <div className="canvas-preview__pattern-row">
                  <div className="canvas-preview__pattern-row-copy"><strong>Place a pause</strong>{!canAddPauseBefore && !canAddPause ? <span>No open gap beside this selection.</span> : null}</div>
                  <div className="canvas-preview__pattern-pause-controls"><div className="canvas-preview__pause-stepper" role="group" aria-label="New pause duration"><button type="button" aria-label="Decrease new pause by 5 seconds" disabled={pauseSeconds <= 5} onClick={() => setPauseSeconds((seconds) => Math.max(5, seconds - 5))}><Minus size={16} /></button><output aria-live="polite">{pauseSeconds} sec</output><button type="button" aria-label="Increase new pause by 5 seconds" disabled={pauseSeconds >= 180} onClick={() => setPauseSeconds((seconds) => Math.min(180, seconds + 5))}><Plus size={16} /></button></div><div className="canvas-preview__pattern-placement"><button type="button" disabled={!canAddPauseBefore} onClick={() => addPause('before')}>Add before</button><button type="button" disabled={!canAddPause} onClick={() => addPause('after')}>Add after</button></div></div>
                </div>
              </div>
            </div>
          </details> : null}
          {notice ? <p className="canvas-preview__notice" role="status">{notice}</p> : null}
        </section>
        <BlockInspector className="canvas-preview__inspector--desktop" active={active} selectionCount={selected.length} targetedSelectionCount={targetedSelection.length} onAdjustSelection={(direction) => adjustTargets('selection', direction)} onEditTarget={openBlockTargetDialog} sport={draft.sport} onPatch={patch} performanceProfile={performanceProfile} profileLabel={profileLabel} />
      </div>
      <dialog ref={blockTargetDialogRef} className="canvas-preview__target-dialog" aria-labelledby="block-target-title" onClose={() => setBlockTargetId(null)}>
        <div className="canvas-preview__target-dialog-head"><div><h2 id="block-target-title">Edit target range</h2><p>{blockTarget ? `Zone ${blockTarget.zone} · ${names[blockTarget.zone]} · ${blockTarget.target ? formatWorkoutTarget(blockTarget.target, draft.sport) : 'No target set'}` : ''}</p></div><button type="button" aria-label="Close target range" onClick={() => blockTargetDialogRef.current?.close()}><X size={18} /></button></div>
        <div className="canvas-preview__target-dialog-body">
          <section className="canvas-preview__target-dialog-section">{blockTarget ? <TargetFields sport={draft.sport} zone={blockTarget.zone} profile={performanceProfile} target={blockTarget.target} onChange={(target) => { patch(blockTarget.clientId, { target }); setBlockTargetNotice('Target updated in the workout draft. Save when ready.'); }} /> : null}{blockTargetNotice ? <p role="status">{blockTargetNotice}</p> : null}</section>
        </div>
      </dialog>
      <dialog ref={targetDialogRef} className="canvas-preview__target-dialog" aria-labelledby="session-targets-title">
        <div className="canvas-preview__target-dialog-head"><div><h2 id="session-targets-title">Session targets</h2><p>Choose how the zone presets translate into a training target.</p></div><button type="button" aria-label="Close session targets" onClick={() => targetDialogRef.current?.close()}><X size={18} /></button></div>
        <div className="canvas-preview__target-dialog-body">
          {targetedBlocks.length ? <section className="canvas-preview__target-dialog-section"><h3>Adjust whole session</h3><p>Shifts each active target by 5 W, 5 sec pace, 1 bpm, 1 percentage point, or 0.5 RPE. Pauses and blocks without targets are skipped.</p><TargetAdjuster label="Active targets" count={targetedBlocks.length} onDecrease={() => adjustTargets('session', -1)} onIncrease={() => adjustTargets('session', 1)} />{targetedBlocks.length < activeBlocks.length ? <p>{activeBlocks.length - targetedBlocks.length} block{activeBlocks.length - targetedBlocks.length === 1 ? ' has' : 's have'} no target.</p> : null}{targetDialogNotice ? <p role="status">{targetDialogNotice}</p> : null}</section> : null}
          <section className="canvas-preview__target-dialog-section"><h3>Zone presets</h3><p>Each zone starts at its midpoint. Adjustments can move a block into the next zone.</p>
            <label>Target type<select value={choiceValue} onChange={(event) => setSessionTargetChoice(event.target.value)}>{targetOptions.map((option) => <option key={`${option.metric}:${option.mode}:${option.reference}`} value={`${option.metric}:${option.mode}:${option.reference ?? ''}`}>{option.label}</option>)}</select></label>
             {chosenTarget ? <><div className="canvas-preview__zone-ranges"><div className="canvas-preview__zone-ranges-head"><span>Zone</span><span>Bounds</span><span>Starts at</span></div>{zones.map((zone) => { const band = ZONE_BANDS[chosenTarget.metric][zone]; const preset = presetTarget(draft.sport, zone, performanceProfile, chosenTarget.metric, chosenTarget.mode, chosenTarget.reference); return <div key={zone}><strong>Zone {zone} · {names[zone]}</strong><span>{formatZoneBounds(zone, draft.sport, performanceProfile, chosenTarget, band)}</span><span>{formatPresetValue(preset, draft.sport, performanceProfile)}</span></div>; })}</div><p>Personal HR and running pace targets use Profile. Pace estimates start from race speed; adjust their zone ranges in Profile.</p><button className="canvas-preview__target-apply" type="button" onClick={applySessionTargets}>{activeBlocks.length ? `Apply ${chosenTarget.label} presets` : `Use ${chosenTarget.label} for new blocks`}</button></> : null}
          </section>
        </div>
      </dialog>
      <DragOverlay dropAnimation={null}>{draggingZone && zones.includes(draggingZone) ? <div className={`canvas-preview__drag-tile ${dropIndex !== null ? 'is-over-chart' : ''}`}><PresetContent zone={draggingZone} /></div> : draggingBlock ? <div className="canvas-preview__drag-chart" style={{ '--zone': intensityColor(draggingBlock.zone, chartIntensityFraction(draggingBlock.target, draggingBlock.zone, draft.sport, performanceProfile)), '--effort-height': `${chartHeightPercent(draggingBlock.target, draggingBlock.zone, draft.sport, performanceProfile, draggingBlock.kind === 'pause')}%` } as CSSProperties}><span /></div> : null}</DragOverlay>
    </DndContext>
  </div>;
}

function TargetAdjuster({ label, count, onDecrease, onIncrease }: { label: string; count: number; onDecrease: () => void; onIncrease: () => void }) {
  return <div className="canvas-preview__intensity-adjuster" role="group" aria-label={`${label} target intensity`}><span>{label} <small>{count}</small></span><button type="button" aria-label={`Decrease ${label.toLowerCase()} target intensity`} title={`Decrease ${label.toLowerCase()} target intensity`} disabled={!count} onClick={onDecrease}><Minus size={16} /></button><button type="button" aria-label={`Increase ${label.toLowerCase()} target intensity`} title={`Increase ${label.toLowerCase()} target intensity`} disabled={!count} onClick={onIncrease}><Plus size={16} /></button></div>;
}

function BlockInspector({ className, active, selectionCount, targetedSelectionCount, onAdjustSelection, onEditTarget, sport, onPatch, performanceProfile, profileLabel }: {
  className: string;
  active: SessionEditorBlock | null;
  selectionCount: number;
  targetedSelectionCount: number;
  onAdjustSelection: (direction: -1 | 1) => void;
  onEditTarget: (blockId: string) => void;
  sport: string;
  onPatch: (id: string, patch: Partial<SessionEditorBlock>) => void;
  performanceProfile: PerformanceProfile | null;
  profileLabel: string;
}) {
  return <aside className={`canvas-preview__inspector ${className}`} aria-label="Block details">
    <h2>Block details</h2>
    <p>{selectionCount > 1 ? `${selectionCount} blocks selected. Adjust their targets here, or use the chart controls to move and repeat them.` : 'Select a bar to edit its effort, time, and targets.'}</p>
    {selectionCount > 1 ? <div className="canvas-preview__selection-targets"><TargetAdjuster label="Selected targets" count={targetedSelectionCount} onDecrease={() => onAdjustSelection(-1)} onIncrease={() => onAdjustSelection(1)} />{targetedSelectionCount < selectionCount ? <p>Blocks without targets or marked as skipped are excluded.</p> : null}</div> : null}
    {active ? <BlockDetails key={active.clientId} block={active} sport={sport} onPatch={onPatch} onEditTarget={onEditTarget} performanceProfile={performanceProfile} profileLabel={profileLabel} /> : <p className="canvas-preview__hint">{selectionCount ? 'Select one block to edit its details.' : 'Click an intensity tile to add a block, then select a bar in the chart to edit it. Shift-click bars to select a pattern.'}</p>}
  </aside>;
}

function IntensityPreset({ zone, onAdd }: { zone: TempoZone; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `${palettePrefix}${zone}` });
  return <div className="canvas-preview__preset" ref={setNodeRef}><button type="button" className="canvas-preview__preset-button" {...attributes} {...listeners} aria-label={`Zone ${zone} ${names[zone]}, 10 min. Tap or click to add it at the end. Dragging is also supported in the chart view.`} onClick={onAdd}><PresetContent zone={zone} /></button></div>;
}

function PresetContent({ zone }: { zone: TempoZone }) {
  return <><span className="canvas-preview__preset-swatch" style={{ background: `var(--color-zone-${zone})` }} aria-hidden="true" /><span className="canvas-preview__preset-copy"><strong>{names[zone]}</strong><small>Z{zone} · 10 min</small><span className="canvas-preview__preset-level" aria-hidden="true">{zones.map((step) => <i key={step} style={{ background: step <= zone ? `var(--color-zone-${zone})` : undefined }} />)}</span></span><Plus size={15} aria-hidden="true" /></>;
}

function ChartBar({ block, index, selected, previousSelectedHeight, nextSelectedZone, sport, profile, onSelect }: { block: SessionEditorBlock; index: number; selected: boolean; previousSelectedHeight: number | null; nextSelectedZone: TempoZone | null; sport: string; profile: PerformanceProfile | null; onSelect: (id: string, additive: boolean, range: boolean) => void }) {
  const isPause = block.kind === 'pause';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.clientId });
  const spokenTarget = block.target ? formatResolvedWorkoutTarget(block.target, profile, sport) ?? formatWorkoutTarget(block.target, sport) : '';
  return <div ref={setNodeRef} className={`canvas-preview__block ${isPause ? 'is-pause' : ''} ${selected ? 'is-selected' : ''} ${block.skipped ? 'is-skipped' : ''} ${selected && previousSelectedHeight === null ? 'is-selection-start' : ''} ${selected && nextSelectedZone === null ? 'is-selection-end' : ''} ${selected && previousSelectedHeight !== null ? 'is-selection-continuation' : ''}`} style={{ '--zone': intensityColor(block.zone, chartIntensityFraction(block.target, block.zone, sport, profile)), '--effort-height': `${chartHeightPercent(block.target, block.zone, sport, profile, isPause)}%`, '--previous-effort-height': previousSelectedHeight === null ? '0%' : `${previousSelectedHeight}%`, flexGrow: effectiveSeconds(block), transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .15 : 1 } as CSSProperties}><button type="button" className="canvas-preview__bar" {...attributes} {...listeners} aria-pressed={selected} aria-label={`${selected ? 'Selected, ' : ''}${block.skipped ? 'Skipped, excluded from workout time, ' : ''}${isPause ? 'Pause' : `${TEMPO_ZONE_META[block.zone].label} ${formatBlockKind(block.kind)}${spokenTarget ? `, ${spokenTarget}` : ''}`}, ${formatDurationExact(effectiveSeconds(block))}. Block ${index + 1}. Click to ${selected ? 'deselect' : 'inspect'}; drag to move.`} onClick={(event) => onSelect(block.clientId, event.ctrlKey || event.metaKey, event.shiftKey)}><span className="sr-only">{block.skipped ? 'Skipped ' : ''}{isPause ? 'Pause' : `${TEMPO_ZONE_META[block.zone].label} block`}</span>{block.skipped ? <span className="canvas-preview__skipped-label" aria-hidden="true">Skipped</span> : null}</button></div>;
}

function ChartPlacement({ block, sport, profile }: { block: VisualBlock; sport: string; profile: PerformanceProfile | null }) {
  return <div className="canvas-preview__block is-placement" style={{ '--zone': intensityColor(block.zone, chartIntensityFraction(block.target, block.zone, sport, profile)), '--effort-height': `${chartHeightPercent(block.target, block.zone, sport, profile)}%`, flexGrow: block.durationSec * (block.reps ?? 1) } as CSSProperties} aria-hidden="true"><span className="canvas-preview__bar" /></div>;
}

function ChartGhost({ block, sport, profile }: { block: SessionEditorBlock; sport: string; profile: PerformanceProfile | null }) {
  return <div className={`canvas-preview__block is-preview ${block.kind === 'pause' ? 'is-pause' : ''}`} style={{ '--zone': intensityColor(block.zone, chartIntensityFraction(block.target, block.zone, sport, profile)), '--effort-height': `${chartHeightPercent(block.target, block.zone, sport, profile, block.kind === 'pause')}%`, flexGrow: effectiveSeconds(block) } as CSSProperties} aria-hidden="true"><span className="canvas-preview__bar" /></div>;
}

function EmptyChartDrop() {
  const { setNodeRef, isOver } = useDroppable({ id: emptyId });
  return <div ref={setNodeRef} className={`canvas-preview__empty-chart ${isOver ? 'is-over' : ''}`}>Click a zone to add it, or drag one here to choose its position.</div>;
}

function EndDrop({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: endId });
  return <div ref={setNodeRef} className={`canvas-preview__end ${active || isOver ? 'is-over' : ''}`} aria-hidden="true" />;
}

function BlockDetails({ block, sport, onPatch, onEditTarget, performanceProfile, profileLabel }: { block: SessionEditorBlock; sport: string; onPatch: (id: string, patch: Partial<SessionEditorBlock>) => void; onEditTarget: (blockId: string) => void; performanceProfile: PerformanceProfile | null; profileLabel: string }) {
  if (block.kind === 'pause') return <div className="canvas-preview__details canvas-preview__pause-details"><strong>Pause between blocks</strong><div className="canvas-preview__pause-stepper" role="group" aria-label="Pause duration"><button type="button" aria-label="Decrease pause by 5 seconds" disabled={block.durationSec <= 1} onClick={() => onPatch(block.clientId, { durationSec: Math.max(1, block.durationSec - 5) })}><Minus size={16} /></button><output aria-live="polite">{block.durationSec} sec</output><button type="button" aria-label="Increase pause by 5 seconds" disabled={block.durationSec >= 1800} onClick={() => onPatch(block.clientId, { durationSec: Math.min(1800, block.durationSec + 5) })}><Plus size={16} /></button></div><label>Exact duration (seconds)<ValidatedNumberInput min={1} max={1800} value={block.durationSec} onChange={(durationSec) => onPatch(block.clientId, { durationSec })} /></label></div>;
  const minutes = block.durationSec / 60;
  const resolved = block.target ? formatResolvedWorkoutTarget(block.target, performanceProfile, sport) : null;
  const profilePaceRange = block.target?.metric === 'pace' && isProfilePaceZoneReference(block.target.reference) ? getRunningPaceZones(performanceProfile)[block.zone] : null;
  const targetSummary = profilePaceRange
    ? `${formatPaceSecondsPerKm(profilePaceRange.fastestSecPerKm)}–${formatPaceSecondsPerKm(profilePaceRange.slowestSecPerKm)} /km`
    : block.target ? resolved ?? formatWorkoutTarget(block.target, sport) : 'No target';
  const missing = block.target ? missingProfileAction(block.target) : null;
  return <div className="canvas-preview__details">
    <div className="canvas-preview__inline">
      <strong>Edit {TEMPO_ZONE_META[block.zone].label} {formatBlockKind(block.kind)}</strong>
      <label>Block type<select value={block.kind} onChange={(event) => onPatch(block.clientId, { kind: event.target.value as SessionEditorBlock['kind'] })}><option value="work">Work</option><option value="recovery">Recovery</option><option value="warmup">Warm-up</option><option value="cooldown">Cool-down</option></select></label>
      <label>Effort zone<select value={block.zone} onChange={(event) => onPatch(block.clientId, { zone: Number(event.target.value) as TempoZone })}>{zones.map((zone) => <option key={zone} value={zone}>Zone {zone} · {names[zone]}</option>)}</select></label>
       <div className="canvas-preview__target-heading"><strong>Intensity</strong><span>{targetSummary}</span></div>
        {profilePaceRange && resolved ? <p className="canvas-preview__target-summary">Block target: {resolved} · From {profileLabel}</p> : resolved && block.target?.reference === 'max-hr' ? <p className="canvas-preview__target-summary">Personalized from {profileLabel}</p> : null}
      {block.target ? <div className="canvas-preview__block-adjust" role="group" aria-label="Fine-tune this block target"><span>Adjust by {targetAdjustmentLabel(block.target)}</span><button type="button" aria-label="Decrease this block intensity" disabled={!adjustWorkoutTarget(block.target, -1)} onClick={() => onPatch(block.clientId, { target: adjustWorkoutTarget(block.target!, -1) })}><Minus size={16} /></button><button type="button" aria-label="Increase this block intensity" disabled={!adjustWorkoutTarget(block.target, 1)} onClick={() => onPatch(block.clientId, { target: adjustWorkoutTarget(block.target!, 1) })}><Plus size={16} /></button></div> : null}
      <button className="canvas-preview__target-trigger" type="button" onClick={() => onEditTarget(block.clientId)}>{block.target ? 'Edit target range' : 'Set a target'}</button>
       {!resolved && missing ? <p className="canvas-preview__target-summary">{missing}</p> : null}
      <label className="canvas-preview__duration"><span>Duration <output>{formatDuration(block.durationSec)}</output></span><input type="range" aria-label="Duration in minutes" min="1" max="30" step="1" value={Math.min(30, Math.max(1, Math.round(minutes)))} onChange={(event) => onPatch(block.clientId, { durationSec: Number(event.target.value) * 60 })} /><span className="canvas-preview__slider-ends"><span>1 min</span><span>30 min</span></span></label>
    </div>
    {minutes > 30 ? <p className="canvas-preview__legacy-note">This existing block is longer than 30 min. Move the slider to set a shorter duration, or copy blocks to build a longer effort.</p> : null}
  </div>;
}

function TargetFields({ sport, zone, profile, target, onChange }: { sport: string; zone: TempoZone; profile: PerformanceProfile | null; target: WorkoutTarget | null; onChange: (target: WorkoutTarget | null) => void }) {
  const options = getAvailableWorkoutTargets(sport).filter((option) => isTargetOptionAvailable(sport, option, profile));
  const value = target ? `${target.metric}:${target.mode}:${targetOptionReference(target.reference) ?? ''}` : '';
  return <div className="canvas-preview__target-fields"><label>Training target<select value={value} onChange={(event) => { const option = options.find((item) => `${item.metric}:${item.mode}:${item.reference ?? ''}` === event.target.value); if (!option) { onChange(null); return; } const preset = presetTarget(sport, zone, profile, option.metric, option.mode, option.reference); const preserveRange = target?.metric === option.metric && target?.mode === option.mode && targetOptionReference(target.reference) === option.reference; onChange(preserveRange ? target : preset); }}><option value="">No target set</option>{options.map((option) => <option key={`${option.metric}-${option.mode}-${option.reference}`} value={`${option.metric}:${option.mode}:${option.reference ?? ''}`}>{option.label}</option>)}</select></label>{target ? <><div><label>Low<ValidatedNumberInput min={0} step="0.01" value={target.low} onChange={(low) => onChange({ ...target, low })} /></label><label>High<ValidatedNumberInput min={0} step="0.01" value={target.high} onChange={(high) => onChange({ ...target, high })} /></label></div>{target.low === 0 && target.high === 0 ? <p>Enter your target range to enable useful intensity adjustments.</p> : null}</> : null}</div>;
}

function formatBlockKind(kind: SessionEditorBlock['kind']) {
  if (kind === 'pause') return 'pause';
  if (kind === 'warmup') return 'warm-up';
  if (kind === 'cooldown') return 'cool-down';
  if (kind === 'recovery') return 'recovery';
  return 'work';
}

function formatPresetValue(target: WorkoutTarget, sport: string, profile: PerformanceProfile | null): string {
  return formatResolvedWorkoutTarget(target, profile, sport) ?? formatWorkoutTarget(target, sport);
}

function isTargetOptionAvailable(sport: string, option: { metric: WorkoutTarget['metric']; mode: WorkoutTarget['mode']; reference: WorkoutTarget['reference'] }, profile: PerformanceProfile | null): boolean {
  if (option.mode === 'absolute' && option.metric !== 'rpe') {
    const hasReference = Boolean(referenceValue(sport, option.metric, profile, option.reference));
    const hasRunningZoneRanges = option.metric === 'pace' && sport === 'RUNNING' && Object.keys(getRunningPaceZones(profile)).length > 0;
    if (!hasReference && !hasRunningZoneRanges) return false;
  }
  if (option.reference === 'max-hr') return Boolean(referenceValue(sport, option.metric, profile, option.reference));
  if (option.reference === 'profile-pace') return hasCompleteRunningPaceZones(profile);
  return true;
}

function targetOptionKey(target: { metric: WorkoutTarget['metric']; mode: WorkoutTarget['mode']; reference: WorkoutTarget['reference'] }): string {
  return `${target.metric}:${target.mode}:${targetOptionReference(target.reference) ?? ''}`;
}

function formatZoneBounds(zone: TempoZone, sport: string, profile: PerformanceProfile | null, target: { metric: WorkoutTarget['metric']; mode: WorkoutTarget['mode']; reference: WorkoutTarget['reference'] }, band: { low: number; high: number }): string {
  if (target.metric === 'hr' && target.reference === 'max-hr' && profile?.heartRateMaxBpm) {
    const range = calculateOlympiatoppenHeartRateZones(profile.heartRateMaxBpm)?.[zone];
    if (range) return `${range.low}–${range.high} bpm`;
  }
  if (target.metric === 'pace' && target.reference === 'profile-pace' && sport === 'RUNNING') {
    const range = getRunningPaceZones(profile)[zone];
    if (range) return `${formatPaceSecondsPerKm(range.fastestSecPerKm)}–${formatPaceSecondsPerKm(range.slowestSecPerKm)} /km`;
  }
  if (target.mode === 'absolute') return formatPresetValue(presetTarget(sport, zone, profile, target.metric, target.mode, target.reference), sport, profile);
  const suffix = target.metric === 'rpe' ? ' RPE' : target.metric === 'power' ? '% FTP' : target.metric === 'pace' ? sport === 'SWIMMING' ? '% CSS' : '% threshold speed' : '% threshold HR';
  return `${band.low}–${band.high}${suffix}`;
}
