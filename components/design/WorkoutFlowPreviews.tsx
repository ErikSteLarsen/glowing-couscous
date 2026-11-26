'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Check,
  ChevronRight,
  GripVertical,
  Info,
  Layers3,
  ListChecks,
  Map,
  PanelLeft,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Undo2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';

import {
  compactDangerButtonClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  formFieldClassName,
  formSelectClassName,
  formTextareaClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '@/components/ui';
import { MetricText } from '@/components/tempobuilder/MetricText';
import { SessionBlockBar } from '@/components/tempobuilder/SessionBlockBar';
import { TEMPO_ZONE_META, type TempoZone } from '@/lib/tempo-blocks';

type Direction = 'flowline' | 'workbench' | 'trail';
type WorkbenchVariant = 'classic' | 'terrain' | 'ribbon' | 'staging';
type TrailStep = 0 | 1 | 2 | 3;
type TrailIntention = 'build-control' | 'find-rhythm' | 'finish-strong';

type PreviewBlock = {
  id: string;
  label: string;
  kind: string;
  zone: TempoZone;
  duration: number;
  reps: number;
  target: string;
  note: string;
};

type PreviewPreset = Omit<PreviewBlock, 'id'> & { id: string; description: string };

const BASE_BLOCKS: PreviewBlock[] = [
  {
    id: 'settle-in',
    label: 'Settle in',
    kind: 'Warm-up',
    zone: 2,
    duration: 10,
    reps: 1,
    target: 'Easy aerobic',
    note: 'Let breathing find its rhythm.',
  },
  {
    id: 'controlled-build',
    label: 'Controlled build',
    kind: 'Work',
    zone: 3,
    duration: 8,
    reps: 3,
    target: 'Tempo effort',
    note: 'Smooth, not forced.',
  },
  {
    id: 'reset',
    label: 'Reset',
    kind: 'Recovery',
    zone: 1,
    duration: 3,
    reps: 2,
    target: 'Easy movement',
    note: 'Keep the reset honest.',
  },
  {
    id: 'threshold',
    label: 'Threshold',
    kind: 'Work',
    zone: 4,
    duration: 6,
    reps: 4,
    target: 'RPE 7-8',
    note: 'Hold the line through the last minute.',
  },
  {
    id: 'return',
    label: 'Return',
    kind: 'Cool-down',
    zone: 1,
    duration: 8,
    reps: 1,
    target: 'Easy movement',
    note: 'Leave one good effort in reserve.',
  },
];

const PRESETS: PreviewPreset[] = [
  {
    id: 'preset-easy-start',
    label: 'Easy start',
    kind: 'Warm-up',
    zone: 2,
    duration: 8,
    reps: 1,
    target: 'Easy aerobic',
    note: 'Settle the first minutes.',
    description: 'A quiet opening that gives the session room.',
  },
  {
    id: 'preset-tempo',
    label: 'Tempo repeat',
    kind: 'Work',
    zone: 3,
    duration: 8,
    reps: 3,
    target: 'Tempo effort',
    note: 'Stay even across every repeat.',
    description: 'Controlled pressure with a repeatable rhythm.',
  },
  {
    id: 'preset-recovery',
    label: 'Short reset',
    kind: 'Recovery',
    zone: 1,
    duration: 3,
    reps: 2,
    target: 'Easy movement',
    note: 'Let the next effort arrive calmly.',
    description: 'A compact recovery between harder pieces.',
  },
  {
    id: 'preset-threshold',
    label: 'Threshold set',
    kind: 'Work',
    zone: 4,
    duration: 6,
    reps: 4,
    target: 'RPE 7-8',
    note: 'Keep the final repetition composed.',
    description: 'A demanding set with a clear effort ceiling.',
  },
  {
    id: 'preset-cooldown',
    label: 'Cool-down',
    kind: 'Cool-down',
    zone: 1,
    duration: 8,
    reps: 1,
    target: 'Easy movement',
    note: 'Bring the session back down.',
    description: 'A simple landing for the finished session.',
  },
];

const ZONES: TempoZone[] = [1, 2, 3, 4, 5];
const PRESET_PREFIX = 'preset:';
const SEQUENCE_END_ID = 'sequence-end';

const DIRECTION_LINKS: Array<{ id: Direction; label: string; href: string }> = [
  { id: 'flowline', label: 'Flowline', href: '/design/workout-flow/flowline' },
  { id: 'workbench', label: 'Workbench', href: '/design/workout-flow/workbench' },
  { id: 'trail', label: 'Trail', href: '/design/workout-flow/trail' },
];

const WORKBENCH_VARIANT_LINKS: Array<{ id: Exclude<WorkbenchVariant, 'classic'>; label: string; href: string }> = [
  { id: 'terrain', label: 'Terrain', href: '/design/workout-flow/workbench/terrain' },
  { id: 'ribbon', label: 'Ribbon', href: '/design/workout-flow/workbench/ribbon' },
  { id: 'staging', label: 'Staging', href: '/design/workout-flow/workbench/staging' },
];

const TRAIL_STEPS = [
  { label: 'Intent', detail: 'Name the session' },
  { label: 'Sequence', detail: 'Lay down the arc' },
  { label: 'Tune', detail: 'Refine the efforts' },
  { label: 'Read back', detail: 'Check the whole' },
] as const;

export function WorkoutFlowPreviews({ direction, workbenchVariant = 'classic' }: { direction: Direction; workbenchVariant?: WorkbenchVariant }) {
  const [blocks, setBlocks] = useState<PreviewBlock[]>(() => BASE_BLOCKS.map((block) => ({ ...block })));
  const [selectedIds, setSelectedIds] = useState<string[]>(BASE_BLOCKS[1]?.id ? [BASE_BLOCKS[1].id] : []);
  const [paletteZone, setPaletteZone] = useState<TempoZone>(3);
  const [history, setHistory] = useState<PreviewBlock[][]>([]);
  const [future, setFuture] = useState<PreviewBlock[][]>([]);
  const [clipboard, setClipboard] = useState<PreviewBlock[]>([]);
  const [stagedBlocks, setStagedBlocks] = useState<PreviewBlock[]>([]);
  const [selectionNotice, setSelectionNotice] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [workoutName, setWorkoutName] = useState('Tuesday threshold');
  const [sport, setSport] = useState('run');
  const [trailIntention, setTrailIntention] = useState<TrailIntention>('build-control');
  const [trailStep, setTrailStep] = useState<TrailStep>(0);
  const suppressPresetClick = useRef<{ presetId: string; until: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const selectedId = selectedIds.at(-1) ?? null;
  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;
  const metrics = getPreviewMetrics(blocks);
  const activePreset = activePresetId ? PRESETS.find((preset) => preset.id === activePresetId) ?? null : null;

  function commit(next: PreviewBlock[]) {
    setHistory((current) => [...current.slice(-19), blocks]);
    setFuture([]);
    setBlocks(next);
    setSaved(false);
  }

  function addPreset(preset: PreviewPreset, index = blocks.length) {
    const newBlock: PreviewBlock = { ...preset, id: createPreviewBlockId(preset.id) };
    commit([...blocks.slice(0, index), newBlock, ...blocks.slice(index)]);
    setSelectedIds([newBlock.id]);
    setPaletteZone(newBlock.zone);
  }

  function addPresetFromPalette(preset: PreviewPreset) {
    const suppression = suppressPresetClick.current;
    if (suppression?.presetId === preset.id && suppression.until > Date.now()) {
      suppressPresetClick.current = null;
      return;
    }
    if (suppression && suppression.until <= Date.now()) suppressPresetClick.current = null;
    addPreset(preset);
  }

  function patchSelected(patch: Partial<PreviewBlock>) {
    if (!selectedId) return;
    commit(blocks.map((block) => block.id === selectedId ? { ...block, ...patch } : block));
  }

  function moveSelected(direction: -1 | 1) {
    if (!selectedId) return;
    const index = blocks.findIndex((block) => block.id === selectedId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  function deleteSelected() {
    if (!selectedId) return;
    const index = blocks.findIndex((block) => block.id === selectedId);
    const next = blocks.filter((block) => block.id !== selectedId);
    commit(next);
    const nextSelected = next[Math.min(index, next.length - 1)];
    setSelectedIds(nextSelected ? [nextSelected.id] : []);
  }

  function selectBlock(id: string, additive = false) {
    setSelectedIds((current) => {
      const next = additive
        ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
        : [id];
      return next;
    });
    const next = blocks.find((block) => block.id === id);
    if (next) setPaletteZone(next.zone);
  }

  function repeatSelected() {
    const selected = blocks.filter((block) => selectedIds.includes(block.id));
    if (!selected.length) return;
    const lastIndex = Math.max(...selected.map((block) => blocks.findIndex((item) => item.id === block.id)));
    const copies = selected.map((block) => ({ ...block, id: createPreviewBlockId(`${block.id}-repeat`) }));
    commit([...blocks.slice(0, lastIndex + 1), ...copies, ...blocks.slice(lastIndex + 1)]);
    setSelectedIds(copies.map((block) => block.id));
    setSelectionNotice(`Repeated ${copies.length} selected block${copies.length === 1 ? '' : 's'}.`);
  }

  function copySelected() {
    const selected = blocks.filter((block) => selectedIds.includes(block.id));
    if (!selected.length) return;
    setClipboard(selected.map((block) => ({ ...block, id: createPreviewBlockId(`${block.id}-clipboard`) })));
    setSelectionNotice(`Copied ${selected.length} block${selected.length === 1 ? '' : 's'} to the clipboard.`);
  }

  function pasteClipboard() {
    if (!clipboard.length) return;
    const copies = clipboard.map((block) => ({ ...block, id: createPreviewBlockId(`${block.id}-paste`) }));
    commit([...blocks, ...copies]);
    setSelectedIds(copies.map((block) => block.id));
    setSelectionNotice(`Pasted ${copies.length} copied block${copies.length === 1 ? '' : 's'} into the sequence.`);
  }

  function stageSelected() {
    const selected = blocks.filter((block) => selectedIds.includes(block.id));
    if (!selected.length) return;
    const copies = selected.map((block) => ({ ...block, id: createPreviewBlockId(`${block.id}-staged`) }));
    setStagedBlocks((current) => [...current, ...copies]);
    setSelectionNotice(`Moved ${copies.length} block${copies.length === 1 ? '' : 's'} into the staging shelf.`);
  }

  function repeatStaged() {
    if (!stagedBlocks.length) return;
    const copies = stagedBlocks.map((block) => ({ ...block, id: createPreviewBlockId(`${block.id}-repeat`) }));
    setStagedBlocks((current) => [...current, ...copies]);
    setSelectionNotice(`Repeated ${copies.length} staged block${copies.length === 1 ? '' : 's'}.`);
  }

  function commitStaged() {
    if (!stagedBlocks.length) return;
    const copies = stagedBlocks.map((block) => ({ ...block, id: createPreviewBlockId(`${block.id}-final`) }));
    commit([...blocks, ...copies]);
    setSelectedIds(copies.map((block) => block.id));
    setStagedBlocks([]);
    setSelectionNotice(`Added ${copies.length} staged block${copies.length === 1 ? '' : 's'} to the final sequence.`);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setFuture((current) => [blocks, ...current]);
    setBlocks(previous);
    setSelectedIds(previous[0]?.id ? [previous[0].id] : []);
    setSaved(false);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((current) => current.slice(1));
    setHistory((current) => [...current, blocks]);
    setBlocks(next);
    setSelectedIds(next[0]?.id ? [next[0].id] : []);
    setSaved(false);
  }

  function reset() {
    const next = BASE_BLOCKS.map((block) => ({ ...block }));
    setBlocks(next);
    setSelectedIds(next[1]?.id ? [next[1].id] : []);
    setPaletteZone(3);
    setHistory([]);
    setFuture([]);
    setClipboard([]);
    setStagedBlocks([]);
    setSelectionNotice('');
    setActivePresetId(null);
    setSaved(false);
    setWorkoutName('Tuesday threshold');
    setSport('run');
    setTrailIntention('build-control');
    setTrailStep(0);
  }

  function updateWorkoutName(value: string) {
    setWorkoutName(value);
    setSaved(false);
  }

  function updateSport(value: string) {
    setSport(value);
    setSaved(false);
  }

  function updateTrailIntention(value: TrailIntention) {
    setTrailIntention(value);
    setSaved(false);
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith(PRESET_PREFIX)) setActivePresetId(id.slice(PRESET_PREFIX.length));
  }

  function onDragCancel() {
    setActivePresetId(null);
    suppressPresetClick.current = null;
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (activeId.startsWith(PRESET_PREFIX)) {
      const preset = PRESETS.find((item) => item.id === activeId.slice(PRESET_PREFIX.length));
      const overIndex = blocks.findIndex((block) => block.id === overId);
      if (preset && (overId === SEQUENCE_END_ID || overIndex >= 0)) addPreset(preset, overIndex >= 0 ? overIndex : blocks.length);
      setActivePresetId(null);
      suppressPresetClick.current = { presetId: activeId.slice(PRESET_PREFIX.length), until: Date.now() + 500 };
      return;
    }

    const fromIndex = blocks.findIndex((block) => block.id === activeId);
    const overIndex = overId === SEQUENCE_END_ID ? blocks.length - 1 : blocks.findIndex((block) => block.id === overId);
    if (fromIndex < 0 || overIndex < 0 || fromIndex === overIndex) {
      setActivePresetId(null);
      return;
    }
    const next = [...blocks];
    const [moving] = next.splice(fromIndex, 1);
    const insertionIndex = overId === SEQUENCE_END_ID ? next.length : overIndex;
    next.splice(insertionIndex, 0, moving);
    commit(next);
    setSelectedIds([activeId]);
    setActivePresetId(null);
  }

  const editorProps: EditorViewProps = {
     blocks,
     selectedId,
     selectedIds,
    selectedBlock,
    metrics,
    onSelect: (id) => {
      selectBlock(id);
    },
    onToggleSelect: (id) => selectBlock(id, true),
    onAdd: addPreset,
    onPaletteAdd: addPresetFromPalette,
    onPatch: patchSelected,
    onMove: moveSelected,
    onDelete: deleteSelected,
    onUndo: undo,
    onRedo: redo,
    onRepeat: repeatSelected,
    onCopy: copySelected,
    onPaste: pasteClipboard,
    onStage: stageSelected,
    onRepeatStaged: repeatStaged,
    onCommitStaged: commitStaged,
    onRemoveStaged: (id) => setStagedBlocks((current) => current.filter((block) => block.id !== id)),
    clipboardCount: clipboard.length,
    stagedBlocks,
    selectionNotice,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    paletteZone,
    setPaletteZone,
    workoutName,
    setWorkoutName: updateWorkoutName,
    sport,
    setSport: updateSport,
    trailIntention,
    setTrailIntention: updateTrailIntention,
    trailStep,
    setTrailStep,
  };

  return (
     <main className={`workout-preview workout-preview--${direction} workout-preview--${direction}-${workbenchVariant}`}>
       <PreviewTopline direction={direction} workbenchVariant={workbenchVariant} />
      <div className="workout-preview__body">
        <header className="workout-preview__header">
          <div className="min-w-0">
            <p className="workout-preview__context">Workout authoring / sample workspace</p>
             <h1>{getDirectionTitle(direction, workbenchVariant)}</h1>
             <p>{getDirectionDescription(direction, workbenchVariant)}</p>
          </div>
          <div className="workout-preview__header-actions">
            <span className="workout-preview__sample-note"><Info size={14} aria-hidden="true" /> Sample data. Nothing saves.</span>
            <button type="button" className={secondaryButtonClassName} onClick={reset}><RotateCcw size={15} aria-hidden="true" /> Reset demo</button>
            <button type="button" className={primaryButtonClassName} onClick={() => setSaved(true)}><Save size={15} aria-hidden="true" /> {saved ? 'Saved in preview' : 'Save workout'}</button>
          </div>
        </header>

        <DndContext
          id="workout-flow-preview"
          sensors={sensors}
          onDragStart={onDragStart}
          onDragCancel={onDragCancel}
          onDragEnd={onDragEnd}
          accessibility={{ announcements: { onDragStart: ({ active }) => `Picked up ${String(active.id)}.`, onDragOver: ({ active, over }) => `Moving ${String(active.id)} over ${over ? String(over.id) : 'the sequence'}.`, onDragEnd: ({ active, over }) => `Moved ${String(active.id)} ${over ? `near ${String(over.id)}` : 'to its previous position'}.`, onDragCancel: ({ active }) => `Cancelled movement for ${String(active.id)}.` }}}
        >
          <div className="workout-preview__stage">
            {direction === 'flowline' ? <FlowlineView {...editorProps} /> : null}
             {direction === 'workbench' ? <WorkbenchView {...editorProps} variant={workbenchVariant} /> : null}
            {direction === 'trail' ? <TrailView {...editorProps} /> : null}
          </div>
          {activePreset ? <DragOverlay dropAnimation={null}><PresetDragPreview preset={activePreset} /></DragOverlay> : null}
        </DndContext>
      </div>
    </main>
  );
}

function PreviewTopline({ direction, workbenchVariant }: { direction: Direction; workbenchVariant: WorkbenchVariant }) {
  return (
    <div className="workout-preview__topline">
      <Link href="/design/workout-flow/flowline" className="workout-preview__brand" aria-label="TempoBuilder workout flow previews">
        <span className="ink-brand-mark" aria-hidden="true"><span /><i /></span>
        <span>TempoBuilder / Workout flow</span>
      </Link>
       <nav aria-label="Workout flow preview directions" className="workout-preview__direction-links">
         {DIRECTION_LINKS.map((item) => <Link key={item.id} href={item.href} className={item.id === direction ? 'is-active' : ''}>{item.label}</Link>)}
       </nav>
       {direction === 'workbench' ? <nav aria-label="Workbench middle surface experiments" className="workout-preview__variant-links">
         {WORKBENCH_VARIANT_LINKS.map((item) => <Link key={item.id} href={item.href} className={item.id === workbenchVariant ? 'is-active' : ''}>{item.label}</Link>)}
       </nav> : null}
    </div>
  );
}

type EditorViewProps = {
  blocks: PreviewBlock[];
  selectedId: string | null;
  selectedIds: string[];
  selectedBlock: PreviewBlock | null;
  metrics: PreviewMetrics;
  paletteZone: TempoZone;
  setPaletteZone: (zone: TempoZone) => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onAdd: (preset: PreviewPreset, index?: number) => void;
  onPaletteAdd: (preset: PreviewPreset) => void;
  onPatch: (patch: Partial<PreviewBlock>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRepeat: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onStage: () => void;
  onRepeatStaged: () => void;
  onCommitStaged: () => void;
  onRemoveStaged: (id: string) => void;
  clipboardCount: number;
  stagedBlocks: PreviewBlock[];
  selectionNotice: string;
  canUndo: boolean;
  canRedo: boolean;
  workoutName: string;
  setWorkoutName: (value: string) => void;
  sport: string;
  setSport: (value: string) => void;
  trailIntention: TrailIntention;
  setTrailIntention: (value: TrailIntention) => void;
  trailStep: TrailStep;
  setTrailStep: (step: TrailStep) => void;
};

type PreviewMetrics = {
  duration: number;
  load: number;
  segments: Array<{ key: string; zone: number; durationSec: number; label: string; color: string }>;
};

function FlowlineView(props: EditorViewProps) {
  return (
    <div className="workout-preview__flowline-layout">
      <aside className="workout-preview__direction-rail">
        <div className="workout-preview__rail-heading"><WandSparkles size={17} aria-hidden="true" /><span>Flowline</span></div>
        <h2>Shape first.</h2>
        <p>Build from the rhythm of the session, then make each effort precise.</p>
        <div className="workout-preview__rail-steps">
          <FlowlineStep active label="See the arc" detail="The whole session stays visible." />
          <FlowlineStep label="Tune the blocks" detail="Select one piece to edit." />
          <FlowlineStep label="Read it back" detail="Check time, load, and zones." />
        </div>
        <div className="workout-preview__rail-note"><Info size={14} aria-hidden="true" /><span>Drag a card to change the order. Use Earlier or Later when you want a precise move.</span></div>
      </aside>

      <section className="workout-preview__flowline-main" aria-label="Flowline workout sequence">
        <div className="workout-preview__surface-heading">
          <div><h2>{props.workoutName}</h2><p>Run / Tuesday session / {props.blocks.length} blocks</p></div>
          <MetricSummary metrics={props.metrics} />
        </div>
        <div className="workout-preview__flowline-overview">
          <div><span className="workout-preview__label">Session shape</span><SessionBlockBar segments={props.metrics.segments} /></div>
          <div className="workout-preview__shape-copy"><strong>{formatMinutes(props.metrics.duration)}</strong><span>from warm-up to return</span></div>
        </div>
        <div className="workout-preview__flowline-track">
          <Sequence blocks={props.blocks} selectedId={props.selectedId} onSelect={props.onSelect} variant="flowline" />
        </div>
        <div className="workout-preview__flowline-footer">
          <QuickAdd onAdd={props.onAdd} paletteZone={props.paletteZone} setPaletteZone={props.setPaletteZone} />
          <MoveControls {...props} />
        </div>
      </section>

      <Inspector {...props} variant="flowline" />
    </div>
  );
}

function WorkbenchView(props: EditorViewProps & { variant: WorkbenchVariant }) {
  if (props.variant === 'terrain') return <TerrainWorkbench {...props} />;
  if (props.variant === 'ribbon') return <RibbonWorkbench {...props} />;
  if (props.variant === 'staging') return <StagingWorkbench {...props} />;

  return (
    <div className="workout-preview__workbench-layout">
      <aside className="workout-preview__palette-panel">
        <div className="workout-preview__panel-heading"><div><span className="workout-preview__panel-icon"><PanelLeft size={16} aria-hidden="true" /></span><h2>Block library</h2></div><span className="workout-preview__count">5 zones</span></div>
        <p className="workout-preview__panel-copy">Choose a known pattern, click to add it, or drag it into any gap in the sequence.</p>
         <PresetPalette zone={props.paletteZone} onZoneChange={props.setPaletteZone} onAdd={props.onPaletteAdd} />
        <div className="workout-preview__palette-foot"><Layers3 size={14} aria-hidden="true" /><span>Library presets stay reusable. The workout stays yours.</span></div>
      </aside>

      <section className="workout-preview__workbench-main" aria-label="Workbench workout sequence">
        <div className="workout-preview__workbench-toolbar">
          <div><span className="workout-preview__label">Sequence</span><h2>{props.workoutName}</h2><p>Click a block to edit it. Drag handles are available on every row.</p></div>
          <MetricSummary metrics={props.metrics} />
        </div>
        <div className="workout-preview__timeline-panel"><SessionBlockBar segments={props.metrics.segments} /><div className="workout-preview__timeline-meta"><span>Easy start</span><span>Build</span><span>Hardest work</span><span>Return</span></div></div>
        <div className="workout-preview__sequence-heading"><span>Blocks in order</span><span>{props.blocks.length} total</span></div>
        <Sequence blocks={props.blocks} selectedId={props.selectedId} onSelect={props.onSelect} variant="workbench" />
        <div className="workout-preview__workbench-footer"><MoveControls {...props} /><CommandControls {...props} /></div>
      </section>

      <Inspector {...props} variant="workbench" />
    </div>
  );
}

function TerrainWorkbench(props: EditorViewProps & { variant: WorkbenchVariant }) {
  return (
    <div className="workout-preview__workbench-layout workout-preview__workbench-layout--terrain">
      <aside className="workout-preview__palette-panel">
        <WorkbenchPalette {...props} />
      </aside>
      <section className="workout-preview__workbench-main" aria-label="Intensity terrain workout sequence">
        <WorkbenchToolbar label="Intensity terrain" title={props.workoutName} copy="Block width follows time. Block height follows intensity." metrics={props.metrics} />
        <div className="workout-preview__terrain-legend"><span>Height = training intensity</span><span><i className="ink-zone-1" /> Z1 easy <i className="ink-zone-5" /> Z5 hardest</span></div>
        <div className="workout-preview__terrain-timeline"><SessionBlockBar segments={props.metrics.segments} /></div>
        <div className="workout-preview__terrain-canvas" role="group" aria-label="Workout intensity terrain">
          <div className="workout-preview__terrain-axis"><span>Z5</span><span>Z3</span><span>Z1</span></div>
          <SortableContext items={props.blocks.map((block) => block.id)} strategy={rectSortingStrategy}>
            <div className="workout-preview__terrain-sequence">
              {props.blocks.map((block, index) => <SortableTerrainBlock key={block.id} block={block} index={index} selected={props.selectedIds.includes(block.id)} onSelect={props.onToggleSelect} />)}
            </div>
          </SortableContext>
        </div>
        <SelectionTray {...props} label="Selected terrain" />
        <div className="workout-preview__workbench-footer"><MoveControls {...props} /><CommandControls {...props} /></div>
      </section>
      <Inspector {...props} variant="workbench" />
    </div>
  );
}

function RibbonWorkbench(props: EditorViewProps & { variant: WorkbenchVariant }) {
  return (
    <div className="workout-preview__workbench-layout workout-preview__workbench-layout--ribbon">
      <aside className="workout-preview__palette-panel">
        <WorkbenchPalette {...props} />
      </aside>
      <section className="workout-preview__workbench-main" aria-label="Full-width ribbon workout sequence">
        <WorkbenchToolbar label="Full-width ribbon" title={props.workoutName} copy="The session fills the field. Select one or several parts to work below." metrics={props.metrics} />
        <div className="workout-preview__ribbon-intro"><span className="workout-preview__label">Session from start to finish</span><span>Every block stays visible, even when the session is short.</span></div>
        <div className="workout-preview__ribbon-track" role="group" aria-label="Selectable full-width session ribbon">
          <SortableContext items={props.blocks.map((block) => block.id)} strategy={rectSortingStrategy}>
            {props.blocks.map((block, index) => <SortableRibbonSegment key={block.id} block={block} index={index} selected={props.selectedIds.includes(block.id)} onSelect={props.onToggleSelect} />)}
          </SortableContext>
        </div>
        <SelectionTray {...props} label="Ribbon selection" />
        <div className="workout-preview__workbench-footer"><MoveControls {...props} /><CommandControls {...props} /></div>
      </section>
      <Inspector {...props} variant="workbench" />
    </div>
  );
}

function StagingWorkbench(props: EditorViewProps & { variant: WorkbenchVariant }) {
  return (
    <div className="workout-preview__workbench-layout workout-preview__workbench-layout--staging">
      <aside className="workout-preview__palette-panel">
        <WorkbenchPalette {...props} />
      </aside>
      <section className="workout-preview__workbench-main" aria-label="Staging bench workout sequence">
        <WorkbenchToolbar label="Staging bench" title={props.workoutName} copy="Gather repeated work above the final sequence, then move the set down when it reads right." metrics={props.metrics} />
        <StagingShelf {...props} />
        <div className="workout-preview__staging-final-heading"><span>Final workout sequence</span><span>{props.blocks.length} blocks / {formatMinutes(props.metrics.duration)}</span></div>
        <Sequence blocks={props.blocks} selectedId={props.selectedId} selectedIds={props.selectedIds} onSelect={props.onSelect} onToggleSelect={props.onToggleSelect} variant="workbench" />
        <SelectionTray {...props} label="Final sequence selection" showStage />
        <div className="workout-preview__workbench-footer"><MoveControls {...props} /><CommandControls {...props} /></div>
      </section>
      <Inspector {...props} variant="workbench" />
    </div>
  );
}

function WorkbenchPalette(props: EditorViewProps) {
  return <><div className="workout-preview__panel-heading"><div><span className="workout-preview__panel-icon"><PanelLeft size={16} aria-hidden="true" /></span><h2>Block library</h2></div><span className="workout-preview__count">5 zones</span></div><p className="workout-preview__panel-copy">Choose a known pattern, click to add it, or drag it into any gap in the sequence.</p><PresetPalette zone={props.paletteZone} onZoneChange={props.setPaletteZone} onAdd={props.onPaletteAdd} /><div className="workout-preview__palette-foot"><Layers3 size={14} aria-hidden="true" /><span>Library presets stay reusable. The workout stays yours.</span></div></>;
}

function WorkbenchToolbar({ label, title, copy, metrics }: { label: string; title: string; copy: string; metrics: PreviewMetrics }) {
  return <div className="workout-preview__workbench-toolbar"><div><span className="workout-preview__label">{label}</span><h2>{title}</h2><p>{copy}</p></div><MetricSummary metrics={metrics} /></div>;
}

function SelectionTray(props: EditorViewProps & { label: string; showStage?: boolean }) {
  const selected = props.blocks.filter((block) => props.selectedIds.includes(block.id));
  const selectedMetrics = getPreviewMetrics(selected);
  return <section className="workout-preview__selection-tray" aria-live="polite" aria-label={props.label}>
    <div className="workout-preview__selection-heading"><div><span className="workout-preview__label">{props.label}</span><h3>{selected.length ? `${selected.length} block${selected.length === 1 ? '' : 's'} selected` : 'Select blocks to work with them'}</h3></div>{selected.length ? <MetricSummary metrics={selectedMetrics} /> : null}</div>
    {selected.length ? <div className="workout-preview__selection-list">{selected.map((block) => <span key={block.id}><i className={`ink-zone-${block.zone}`} />{block.label} <strong>{formatBlockDuration(block)}</strong></span>)}</div> : <p className="workout-preview__selection-empty">Select one or several blocks above. The active block remains available in Block details.</p>}
    <div className="workout-preview__selection-actions"><button type="button" className={compactSecondaryButtonClassName} disabled={!selected.length} onClick={props.onRepeat}><Redo2 size={14} aria-hidden="true" /> Repeat once</button><button type="button" className={compactSecondaryButtonClassName} disabled={!selected.length} onClick={props.onCopy}>Copy selection</button>{props.clipboardCount ? <button type="button" className={compactSecondaryButtonClassName} onClick={props.onPaste}>Paste {props.clipboardCount} copied</button> : null}{props.showStage ? <button type="button" className={compactPrimaryButtonClassName} disabled={!selected.length} onClick={props.onStage}><Layers3 size={14} aria-hidden="true" /> Stage selection</button> : null}</div>
    {props.selectionNotice ? <p className="workout-preview__selection-notice"><Check size={14} aria-hidden="true" /> {props.selectionNotice}</p> : null}
  </section>;
}

function StagingShelf(props: EditorViewProps) {
  return <section className="workout-preview__staging-shelf" aria-label="Temporary block staging shelf"><div className="workout-preview__staging-shelf-heading"><div><span className="workout-preview__label">Temporary staging shelf</span><h3>{props.stagedBlocks.length ? `${props.stagedBlocks.length} blocks waiting to move` : 'Build a repeat before it reaches the workout'}</h3></div><span className="workout-preview__staging-status">{props.stagedBlocks.length ? 'Draft set' : 'Empty'}</span></div>{props.stagedBlocks.length ? <div className="workout-preview__staged-list">{props.stagedBlocks.map((block, index) => <div key={block.id}><span className={`ink-zone-${block.zone}`} /><span><strong>{String(index + 1).padStart(2, '0')} {block.label}</strong><small>{formatBlockDuration(block)} / {block.target}</small></span><button type="button" className="workout-preview__staged-remove" onClick={() => props.onRemoveStaged(block.id)} aria-label={`Remove ${block.label} from staging`}><X size={15} aria-hidden="true" /></button></div>)}</div> : <p className="workout-preview__staging-empty">Select final blocks below, then use Stage selection to make a temporary set here.</p>}<div className="workout-preview__staging-actions"><button type="button" className={compactSecondaryButtonClassName} disabled={!props.stagedBlocks.length} onClick={props.onRepeatStaged}><Redo2 size={14} aria-hidden="true" /> Repeat staged set</button><button type="button" className={compactPrimaryButtonClassName} disabled={!props.stagedBlocks.length} onClick={props.onCommitStaged}><ArrowDown size={14} aria-hidden="true" /> Move into final sequence</button></div></section>;
}

function SortableTerrainBlock({ block, index, selected, onSelect }: { block: PreviewBlock; index: number; selected: boolean; onSelect: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return <article ref={setNodeRef} style={{ '--terrain-height': `${30 + block.zone * 13}%`, flexGrow: block.duration * block.reps, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 } as CSSProperties} className={`workout-preview__terrain-block ${selected ? 'is-selected' : ''}`}><div className="workout-preview__terrain-block-inner"><button type="button" className="workout-preview__drag-handle" aria-label={`Drag block ${index + 1}, ${block.label}`} {...attributes} {...listeners}><GripVertical size={16} aria-hidden="true" /></button><button type="button" className="workout-preview__terrain-content" aria-pressed={selected} onClick={() => onSelect(block.id)}><span className={`ink-zone-${block.zone}`}>Z{block.zone}</span><strong>{block.label}</strong><small>{formatBlockDuration(block)}</small></button></div></article>;
}

function SortableRibbonSegment({ block, index, selected, onSelect }: { block: PreviewBlock; index: number; selected: boolean; onSelect: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return <article ref={setNodeRef} style={{ '--ribbon-color': `var(--color-zone-${block.zone})`, '--ribbon-tint': `var(--color-zone-${block.zone}-tint)`, flexGrow: block.duration * block.reps, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 } as CSSProperties} className={`workout-preview__ribbon-segment ${selected ? 'is-selected' : ''}`}><button type="button" className="workout-preview__ribbon-handle" aria-label={`Drag block ${index + 1}, ${block.label}`} {...attributes} {...listeners}><GripVertical size={15} aria-hidden="true" /></button><button type="button" className="workout-preview__ribbon-content" aria-pressed={selected} onClick={() => onSelect(block.id)}><span>{String(index + 1).padStart(2, '0')} / Z{block.zone}</span><strong>{block.label}</strong><small>{formatBlockDuration(block)}</small></button></article>;
}

function TrailView(props: EditorViewProps) {
  const step = TRAIL_STEPS[props.trailStep];
  const isLast = props.trailStep === 3;

  return (
    <div className="workout-preview__trail-layout">
      <aside className="workout-preview__trail-steps" aria-label="Workout creation steps">
        <div className="workout-preview__rail-heading"><Map size={17} aria-hidden="true" /><span>Trail</span></div>
        <h2>One clear pass at a time.</h2>
        <p>Keep the decisions small so the workout reads clearly when it is done.</p>
        <ol>
          {TRAIL_STEPS.map((item, index) => {
            const current = index === props.trailStep;
            const complete = index < props.trailStep;
            return <li key={item.label}><button type="button" className={current ? 'is-current' : ''} onClick={() => props.setTrailStep(index as TrailStep)}><span className="workout-preview__trail-number">{complete ? <Check size={14} aria-hidden="true" /> : index + 1}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span></button></li>;
          })}
        </ol>
        <div className="workout-preview__rail-note"><Info size={14} aria-hidden="true" /><span>Your choices remain editable. This is a guide, not a lock-step wizard.</span></div>
      </aside>

      <section className="workout-preview__trail-main" aria-label="Trail workout creation step">
        <div className="workout-preview__trail-heading"><div><span className="workout-preview__label">Pass {props.trailStep + 1} of 4</span><h2>{step.label}</h2><p>{getTrailStepDescription(props.trailStep)}</p></div><span className="workout-preview__trail-status">{props.trailStep === 3 ? 'Ready to review' : 'Draft in progress'}</span></div>
        {props.trailStep === 0 ? <IntentStep {...props} /> : null}
        {props.trailStep === 1 ? <SequenceStep {...props} /> : null}
        {props.trailStep === 2 ? <TuneStep {...props} /> : null}
        {props.trailStep === 3 ? <ReadBackStep {...props} /> : null}
        <div className="workout-preview__trail-actions">
          <button type="button" className={secondaryButtonClassName} disabled={props.trailStep === 0} onClick={() => props.setTrailStep((props.trailStep - 1) as TrailStep)}><ArrowLeft size={15} aria-hidden="true" /> Back</button>
          <button type="button" className={primaryButtonClassName} disabled={isLast} onClick={() => props.setTrailStep((props.trailStep + 1) as TrailStep)}>{isLast ? <><Check size={15} aria-hidden="true" /> Review complete</> : <>Next: {TRAIL_STEPS[props.trailStep + 1].label} <ArrowRight size={15} aria-hidden="true" /></>}</button>
        </div>
      </section>

      <Readout {...props} />
    </div>
  );
}

function IntentStep({ workoutName, setWorkoutName, sport, setSport, trailIntention, setTrailIntention }: EditorViewProps) {
  return (
    <div className="workout-preview__intent-step">
      <div className="workout-preview__intent-callout"><WandSparkles size={18} aria-hidden="true" /><p>Start with the feeling you want the athlete to carry through the session. The details can come next.</p></div>
      <div className="workout-preview__form-grid">
        <label><span>Workout name</span><input className={formFieldClassName} value={workoutName} onChange={(event) => setWorkoutName(event.target.value)} /></label>
        <label><span>Sport</span><select className={formSelectClassName} value={sport} onChange={(event) => setSport(event.target.value)}><option value="run">Run</option><option value="ride">Ride</option><option value="swim">Swim</option></select></label>
      </div>
      <div className="workout-preview__choice-row"><span className="workout-preview__label">Session intention</span><div role="group" aria-label="Session intention"><button type="button" className={trailIntention === 'build-control' ? 'is-selected' : ''} aria-pressed={trailIntention === 'build-control'} onClick={() => setTrailIntention('build-control')}>Build control</button><button type="button" className={trailIntention === 'find-rhythm' ? 'is-selected' : ''} aria-pressed={trailIntention === 'find-rhythm'} onClick={() => setTrailIntention('find-rhythm')}>Find rhythm</button><button type="button" className={trailIntention === 'finish-strong' ? 'is-selected' : ''} aria-pressed={trailIntention === 'finish-strong'} onClick={() => setTrailIntention('finish-strong')}>Finish strong</button></div></div>
    </div>
  );
}

function SequenceStep(props: EditorViewProps) {
  return <div className="workout-preview__trail-sequence"><div className="workout-preview__trail-sequence-note"><ListChecks size={17} aria-hidden="true" /><p>Lay down the broad arc first. Click a preset to append it, or drag one into the exact place it belongs.</p></div><Sequence blocks={props.blocks} selectedId={props.selectedId} onSelect={props.onSelect} variant="trail" /><PresetPalette zone={props.paletteZone} onZoneChange={props.setPaletteZone} onAdd={props.onPaletteAdd} /></div>;
}

function TuneStep(props: EditorViewProps) {
  return <div className="workout-preview__trail-tune"><div className="workout-preview__trail-tune-sequence"><Sequence blocks={props.blocks} selectedId={props.selectedId} onSelect={props.onSelect} variant="trail" /></div><Inspector {...props} variant="trail" /></div>;
}

function ReadBackStep({ blocks, metrics, workoutName }: EditorViewProps) {
  return <div className="workout-preview__readback"><div className="workout-preview__readback-hero"><MetricText>{formatMinutes(metrics.duration)}</MetricText><span>planned time</span><strong>{metrics.load} load</strong></div><SessionBlockBar segments={metrics.segments} /><div className="workout-preview__readback-list">{blocks.map((block, index) => <div key={block.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{block.label}</strong><span>{formatBlockDuration(block)}</span></div>)}</div><p className="workout-preview__readback-note"><Check size={15} aria-hidden="true" /> {workoutName} reads as a controlled build with a clear landing.</p></div>;
}

function Readout({ blocks, metrics, workoutName }: EditorViewProps) {
  return <aside className="workout-preview__readout"><div className="workout-preview__panel-heading"><div><span className="workout-preview__panel-icon"><SlidersHorizontal size={16} aria-hidden="true" /></span><h2>Workout readout</h2></div></div><p className="workout-preview__panel-copy">A quiet check that stays beside the step you are working on.</p><div className="workout-preview__readout-metrics"><div><span>Duration</span><strong>{formatMinutes(metrics.duration)}</strong></div><div><span>Load</span><strong>{metrics.load}</strong></div><div><span>Blocks</span><strong>{blocks.length}</strong></div></div><div className="workout-preview__readout-outline"><span className="workout-preview__label">{workoutName}</span><SessionBlockBar segments={metrics.segments} />{blocks.map((block) => <div key={block.id}><span className={`ink-zone-${block.zone}`} /><span>{block.label}</span><strong>{formatBlockDuration(block)}</strong></div>)}</div><p className="workout-preview__readout-foot"><Check size={14} aria-hidden="true" /> Nothing is hidden behind the next step.</p></aside>;
}

function Sequence({ blocks, selectedId, selectedIds, onSelect, onToggleSelect, variant }: { blocks: PreviewBlock[]; selectedId: string | null; selectedIds?: string[]; onSelect: (id: string) => void; onToggleSelect?: (id: string) => void; variant: 'flowline' | 'workbench' | 'trail' }) {
  return (
    <div className={`workout-preview__sequence workout-preview__sequence--${variant}`}>
      <SortableContext items={blocks.map((block) => block.id)} strategy={rectSortingStrategy}>
        {blocks.length ? blocks.map((block, index) => <SortablePreviewBlock key={block.id} block={block} index={index} selected={selectedIds ? selectedIds.includes(block.id) : block.id === selectedId} onSelect={onSelect} onToggleSelect={onToggleSelect} variant={variant} />) : <div className="workout-preview__empty-sequence"><Plus size={17} aria-hidden="true" /><span>Add a block to start the sequence.</span></div>}
      </SortableContext>
      <SequenceEndDropZone />
    </div>
  );
}

function SortablePreviewBlock({ block, index, selected, onSelect, onToggleSelect, variant }: { block: PreviewBlock; index: number; selected: boolean; onSelect: (id: string) => void; onToggleSelect?: (id: string) => void; variant: 'flowline' | 'workbench' | 'trail' }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const zone = TEMPO_ZONE_META[block.zone];
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }} className={`workout-preview__block-card workout-preview__block-card--${variant} ${selected ? 'is-selected' : ''}`}>
    <button type="button" className="workout-preview__drag-handle" aria-label={`Drag block ${index + 1}, ${block.label}`} {...attributes} {...listeners}><GripVertical size={17} aria-hidden="true" /></button>
    <button type="button" className="workout-preview__block-content" aria-pressed={selected} onClick={() => onToggleSelect ? onToggleSelect(block.id) : onSelect(block.id)}>
      <div className="workout-preview__block-top"><span className="workout-preview__block-order">{String(index + 1).padStart(2, '0')}</span><span className={`workout-preview__zone-line ink-zone-${block.zone}`} aria-hidden="true" /><span className="workout-preview__block-kind">{block.kind}</span><span className="workout-preview__block-zone">{zone.label} {zone.name}</span></div>
      <div className="workout-preview__block-name-row"><strong>{block.label}</strong><MetricText>{formatBlockDuration(block)}</MetricText></div>
      <p>{block.target}</p>
      {variant !== 'flowline' ? <span className="workout-preview__block-note">{block.note}</span> : null}
    </button>
    {variant === 'workbench' ? <ChevronRight className="workout-preview__block-arrow" size={16} aria-hidden="true" /> : null}
  </article>;
}

function SequenceEndDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: SEQUENCE_END_ID });
  return <div ref={setNodeRef} className={`workout-preview__sequence-end ${isOver ? 'is-over' : ''}`}><Plus size={15} aria-hidden="true" /><span>Drop a block here</span></div>;
}

function PresetPalette({ zone, onZoneChange, onAdd }: { zone: TempoZone; onZoneChange: (zone: TempoZone) => void; onAdd: (preset: PreviewPreset) => void }) {
  const visible = PRESETS.filter((preset) => preset.zone === zone);
  return <div className="workout-preview__preset-palette"><div className="workout-preview__zone-picker" role="group" aria-label="Intensity zones">{ZONES.map((item) => <button key={item} type="button" className={item === zone ? 'is-selected' : ''} aria-label={`Zone ${item}: ${TEMPO_ZONE_META[item].name}`} aria-pressed={item === zone} onClick={() => onZoneChange(item)}><span className={`ink-zone-${item}`} aria-hidden="true" />Z{item}</button>)}</div><div className="workout-preview__preset-list">{visible.map((preset) => <PalettePreset key={preset.id} preset={preset} onAdd={() => onAdd(preset)} />)}</div></div>;
}

function PalettePreset({ preset, onAdd }: { preset: PreviewPreset; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${PRESET_PREFIX}${preset.id}` });
  return <button ref={setNodeRef} type="button" className="workout-preview__preset" style={{ opacity: isDragging ? 0.35 : 1 }} onClick={onAdd} {...attributes} {...listeners}><span className={`workout-preview__preset-line ink-zone-${preset.zone}`} aria-hidden="true" /><span><strong>{preset.label}</strong><small>{preset.description}</small></span><Plus size={15} aria-hidden="true" /></button>;
}

function PresetDragPreview({ preset }: { preset: PreviewPreset }) {
  return <div className="workout-preview__preset-drag"><span className={`workout-preview__preset-line ink-zone-${preset.zone}`} aria-hidden="true" /><span><strong>{preset.label}</strong><small>Drop into the sequence</small></span></div>;
}

function QuickAdd({ onAdd, paletteZone, setPaletteZone }: Pick<EditorViewProps, 'onAdd' | 'paletteZone' | 'setPaletteZone'>) {
  const preset = PRESETS.find((item) => item.zone === paletteZone) ?? PRESETS[0];
  return <div className="workout-preview__quick-add"><span className="workout-preview__label">Quick add</span><button type="button" className={compactSecondaryButtonClassName} onClick={() => onAdd(preset)}><Plus size={14} aria-hidden="true" /> {preset.label}</button><button type="button" className={compactSecondaryButtonClassName} onClick={() => setPaletteZone(paletteZone === 5 ? 1 : (paletteZone + 1) as TempoZone)} aria-label="Show the next intensity zone">Zone {paletteZone === 5 ? 1 : paletteZone + 1}</button></div>;
}

function Inspector(props: EditorViewProps & { variant: 'flowline' | 'workbench' | 'trail' }) {
  const block = props.selectedBlock;
  return <aside className={`workout-preview__inspector workout-preview__inspector--${props.variant}`} aria-live="polite"><div className="workout-preview__panel-heading"><div><span className="workout-preview__panel-icon"><SlidersHorizontal size={16} aria-hidden="true" /></span><h2>Block details</h2></div>{block ? <span className="workout-preview__selected-dot">Selected</span> : null}</div><p className="workout-preview__panel-copy">{block ? 'Change the prescription without losing the shape of the session.' : 'Select a block to tune its prescription.'}</p>{block ? <div className="workout-preview__inspector-fields"><label><span>Block name</span><input className={formFieldClassName} value={block.label} onChange={(event) => props.onPatch({ label: event.target.value })} /></label><label><span>Training zone</span><select className={formSelectClassName} value={block.zone} onChange={(event) => props.onPatch({ zone: Number(event.target.value) as TempoZone })}>{ZONES.map((zone) => <option key={zone} value={zone}>Z{zone} / {TEMPO_ZONE_META[zone].name}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label><span>Minutes</span><input className={formFieldClassName} type="number" min="1" value={block.duration} onChange={(event) => props.onPatch({ duration: Math.max(1, Number(event.target.value)) })} /></label><label><span>Repeats</span><input className={formFieldClassName} type="number" min="1" value={block.reps} onChange={(event) => props.onPatch({ reps: Math.max(1, Number(event.target.value)) })} /></label></div><label><span>Target</span><input className={formFieldClassName} value={block.target} onChange={(event) => props.onPatch({ target: event.target.value })} /></label><label><span>Coaching note</span><textarea className={formTextareaClassName} rows={3} value={block.note} onChange={(event) => props.onPatch({ note: event.target.value })} /></label><div className="workout-preview__inspector-actions"><button type="button" className={compactSecondaryButtonClassName} onClick={() => props.onPatch({ note: '', target: 'Open target' })}>Clear extras</button><button type="button" className={compactDangerButtonClassName} onClick={props.onDelete}>Remove block</button></div></div> : <div className="workout-preview__inspector-empty"><SlidersHorizontal size={20} aria-hidden="true" /><span>Choose a block from the sequence.</span></div>}</aside>;
}

function MoveControls(props: Pick<EditorViewProps, 'selectedBlock' | 'onMove'>) {
  return <div className="workout-preview__move-controls"><button type="button" className={compactSecondaryButtonClassName} disabled={!props.selectedBlock} onClick={() => props.onMove(-1)}><ArrowLeft size={14} aria-hidden="true" /> Earlier</button><button type="button" className={compactSecondaryButtonClassName} disabled={!props.selectedBlock} onClick={() => props.onMove(1)}>Later <ArrowRight size={14} aria-hidden="true" /></button></div>;
}

function CommandControls(props: Pick<EditorViewProps, 'onUndo' | 'onRedo' | 'canUndo' | 'canRedo'>) {
  return <div className="workout-preview__command-controls"><button type="button" className={compactSecondaryButtonClassName} disabled={!props.canUndo} onClick={props.onUndo}><Undo2 size={14} aria-hidden="true" /> Undo</button><button type="button" className={compactSecondaryButtonClassName} disabled={!props.canRedo} onClick={props.onRedo}><Redo2 size={14} aria-hidden="true" /> Redo</button></div>;
}

function MetricSummary({ metrics }: { metrics: PreviewMetrics }) {
  return <div className="workout-preview__metric-summary"><div><span>Time</span><strong>{formatMinutes(metrics.duration)}</strong></div><div><span>Load</span><strong>{metrics.load}</strong></div></div>;
}

function FlowlineStep({ label, detail, active = false }: { label: string; detail: string; active?: boolean }) {
  return <div className={`workout-preview__flowline-step ${active ? 'is-active' : ''}`}><span className="workout-preview__flowline-step-mark">{active ? <Check size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}</span><span><strong>{label}</strong><small>{detail}</small></span></div>;
}

function getPreviewMetrics(blocks: PreviewBlock[]): PreviewMetrics {
  const segments = blocks.map((block) => ({ key: block.id, zone: block.zone, durationSec: Math.max(block.duration * block.reps * 60, 1), label: `${block.label}, ${formatBlockDuration(block)}`, color: `var(--color-zone-${block.zone})` }));
  const duration = blocks.reduce((total, block) => total + block.duration * block.reps, 0);
  const load = blocks.reduce((total, block) => total + block.duration * block.reps * (block.zone * 1.7), 0);
  return { duration, load: Math.round(load), segments };
}

function createPreviewBlockId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatBlockDuration(block: PreviewBlock) {
  return block.reps > 1 ? `${block.duration} min x ${block.reps}` : `${block.duration} min`;
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours ? `${hours}h ${String(remaining).padStart(2, '0')}m` : `${minutes} min`;
}

function getDirectionTitle(direction: Direction, workbenchVariant: WorkbenchVariant = 'classic') {
  if (direction === 'flowline') return 'Map the effort before you edit it.';
  if (direction === 'workbench' && workbenchVariant === 'terrain') return 'See the effort rise and fall.';
  if (direction === 'workbench' && workbenchVariant === 'ribbon') return 'Give the whole session the field.';
  if (direction === 'workbench' && workbenchVariant === 'staging') return 'Build the repeat before you commit it.';
  if (direction === 'workbench') return 'Choose, place, refine.';
  return 'A workout takes four clear passes.';
}

function getDirectionDescription(direction: Direction, workbenchVariant: WorkbenchVariant = 'classic') {
  if (direction === 'flowline') return 'See the whole session as one connected line. Start with the shape, then make each effort precise.';
  if (direction === 'workbench' && workbenchVariant === 'terrain') return 'Compare intensity through height as well as color, then select a single block or a set to adjust below.';
  if (direction === 'workbench' && workbenchVariant === 'ribbon') return 'Let the duration-weighted session fill the entire middle field, then work with the selected pieces in the tray underneath.';
  if (direction === 'workbench' && workbenchVariant === 'staging') return 'Gather and repeat blocks in a temporary shelf before moving a composed set into the final workout sequence.';
  if (direction === 'workbench') return 'Keep the block library, sequence, and inspector in one stable work surface built for repeat use.';
  return 'Keep the decisions small, visible, and reversible so the finished workout makes sense at a glance.';
}

function getTrailStepDescription(step: TrailStep) {
  if (step === 0) return 'Give the session a name and an intention before you start tuning numbers.';
  if (step === 1) return 'Lay down the broad rhythm with familiar blocks. You can reorder everything later.';
  if (step === 2) return 'Select a block and give the athlete a clear target, duration, and cue.';
  return 'Read the session from top to bottom. The next action should feel obvious.';
}
