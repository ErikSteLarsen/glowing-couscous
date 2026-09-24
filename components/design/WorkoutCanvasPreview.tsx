'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ArrowRight, Copy, Plus, RotateCcw, Trash2 } from 'lucide-react';
import './workout-canvas.css';

type Variant = 'profile' | 'ribbon' | 'score';
type Block = { id: string; name: string; kind: 'Warm-up' | 'Work' | 'Recovery' | 'Cool-down'; zone: number; minutes: number };
type Preset = Omit<Block, 'id'>;

const original: Block[] = [
  { id: 'warm', name: 'Settle in', kind: 'Warm-up', zone: 2, minutes: 10 },
  { id: 'work-1', name: 'Tempo', kind: 'Work', zone: 4, minutes: 8 },
  { id: 'rest-1', name: 'Easy spin', kind: 'Recovery', zone: 1, minutes: 3 },
  { id: 'work-2', name: 'Tempo', kind: 'Work', zone: 4, minutes: 8 },
  { id: 'rest-2', name: 'Easy spin', kind: 'Recovery', zone: 1, minutes: 3 },
  { id: 'work-3', name: 'Final push', kind: 'Work', zone: 5, minutes: 5 },
  { id: 'cool', name: 'Roll home', kind: 'Cool-down', zone: 1, minutes: 8 },
];
const presets: Preset[] = [
  { name: 'Recovery', kind: 'Recovery', zone: 1, minutes: 10 },
  { name: 'Easy', kind: 'Work', zone: 2, minutes: 10 },
  { name: 'Steady', kind: 'Work', zone: 3, minutes: 10 },
  { name: 'Threshold', kind: 'Work', zone: 4, minutes: 10 },
  { name: 'Sprint', kind: 'Work', zone: 5, minutes: 10 },
];
const concepts: { id: Variant; name: string; description: string }[] = [
  { id: 'profile', name: 'Intensity profile', description: 'Height shows effort. Width shows time. Pauses sit low between efforts.' },
  { id: 'ribbon', name: 'Session ribbon', description: 'A continuous, flush strip with a quieter height difference between efforts.' },
  { id: 'score', name: 'Interval score', description: 'A compact bar chart with block details in a side inspector.' },
];
const makeId = () => `block-${crypto.randomUUID()}`;

export function WorkoutCanvasPreview() {
  const [variant, setVariant] = useState<Variant>('profile');
  const [blocks, setBlocks] = useState<Block[]>(original);
  const [selected, setSelected] = useState<string[]>([]);
  const [repeatCount, setRepeatCount] = useState(1);
  const [multiSelect, setMultiSelect] = useState(false);
  const [message, setMessage] = useState('Click a bar to inspect it. Shift-click or turn on multi-select to choose a pattern.');
  const suppressPresetClick = useRef<{ index: number; until: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const duration = blocks.reduce((sum, block) => sum + block.minutes, 0);
  const selectedBlocks = blocks.filter((block) => selected.includes(block.id));
  const active = selectedBlocks.length === 1 ? selectedBlocks[0] : null;
  const repeatCopies = selectedBlocks.length ? repeatCount - 1 : 0;
  const selectionMinutes = selectedBlocks.reduce((sum, block) => sum + block.minutes, 0);
  const previewDuration = duration + selectionMinutes * repeatCopies;
  const lastSelectedIndex = selectedBlocks.length ? Math.max(...selectedBlocks.map((block) => blocks.findIndex((item) => item.id === block.id))) : -1;
  const chartPieces = blocks.flatMap((block, index) => {
    const real = { block, preview: false };
    if (index !== lastSelectedIndex || !repeatCopies) return [real];
    const copies = Array.from({ length: repeatCopies }, (_, repetition) => selectedBlocks.map((selectedBlock) => ({
      block: { ...selectedBlock, id: `preview-${repetition}-${selectedBlock.id}` },
      preview: true,
    }))).flat();
    return [real, ...copies];
  });

  function add(preset: Preset, index = blocks.length) {
    const block = { ...preset, id: makeId() };
    setBlocks((current) => [...current.slice(0, index), block, ...current.slice(index)]);
    setSelected([block.id]);
    setRepeatCount(1);
    setMessage(`${block.name} added at position ${index + 1}. This is a preview; changes are not saved.`);
  }
  function select(id: string, additive: boolean) {
    setSelected((current) => additive ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id] : [id]);
    setRepeatCount(1);
  }
  function patch(id: string, change: Partial<Block>) {
    setBlocks((current) => current.map((block) => block.id === id ? { ...block, ...change } : block));
    setMessage('Block updated in the session preview.');
  }
  function duplicate() {
    if (!selectedBlocks.length) return;
    const end = Math.max(...selectedBlocks.map((block) => blocks.findIndex((item) => item.id === block.id))) + 1;
    const copies = selectedBlocks.map((block) => ({ ...block, id: makeId() }));
    setBlocks([...blocks.slice(0, end), ...copies, ...blocks.slice(end)]);
    setSelected(copies.map((block) => block.id));
    setRepeatCount(1);
    setMessage(`${copies.length} block${copies.length === 1 ? '' : 's'} copied directly after the selection.`);
  }
  function multiply() {
    if (!selectedBlocks.length || repeatCount < 2) return;
    const end = Math.max(...selectedBlocks.map((block) => blocks.findIndex((item) => item.id === block.id))) + 1;
    const copies = Array.from({ length: repeatCount - 1 }, () => selectedBlocks.map((block) => ({ ...block, id: makeId() }))).flat();
    setBlocks([...blocks.slice(0, end), ...copies, ...blocks.slice(end)]);
    setSelected(copies.map((block) => block.id));
    setRepeatCount(1);
    setMessage(`Selected pattern now appears ${repeatCount} times in sequence.`);
  }
  function remove() {
    setBlocks((current) => current.filter((block) => !selected.includes(block.id)));
    setMessage(`${selected.length} block${selected.length === 1 ? '' : 's'} removed.`);
    setSelected([]);
    setRepeatCount(1);
  }
  function move(direction: -1 | 1) {
    if (!selected.length) return;
    const indexes = blocks.map((block, index) => selected.includes(block.id) ? index : -1).filter((index) => index >= 0);
    const edge = direction < 0 ? indexes[0] : indexes[indexes.length - 1];
    const target = edge + direction;
    if (target < 0 || target >= blocks.length || selected.includes(blocks[target].id)) return;
    const next = [...blocks];
    const group = next.filter((block) => selected.includes(block.id));
    const rest = next.filter((block) => !selected.includes(block.id));
    const insertion = direction < 0 ? rest.findIndex((block) => block.id === blocks[target].id) : rest.findIndex((block) => block.id === blocks[target].id) + 1;
    rest.splice(insertion, 0, ...group);
    setBlocks(rest);
    setRepeatCount(1);
    setMessage(`${group.length} selected block${group.length === 1 ? '' : 's'} moved ${direction < 0 ? 'earlier' : 'later'}.`);
  }
  function dragEnd(event: DragEndEvent) {
    const from = String(event.active.id);
    const to = event.over?.id ? String(event.over.id) : null;
    if (from.startsWith('preset-')) suppressPresetClick.current = { index: Number(from.slice(7)), until: Date.now() + 500 };
    if (!to) return;
    if (from.startsWith('preset-')) {
      const preset = presets[Number(from.slice(7))];
      if (preset) add(preset, to === 'end' ? blocks.length : Math.max(0, blocks.findIndex((block) => block.id === to)));
      return;
    }
    const oldIndex = blocks.findIndex((block) => block.id === from);
    const newIndex = to === 'end' ? blocks.length - 1 : blocks.findIndex((block) => block.id === to);
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      setBlocks(arrayMove(blocks, oldIndex, newIndex));
      setSelected([from]);
      setRepeatCount(1);
      setMessage('Block moved on the session canvas.');
    }
  }

  return <main className="canvas-preview">
    <div className="canvas-preview__top"><a href="/design/workout-flow/workbench/ribbon"><ArrowLeft size={15} /> Existing builder experiments</a><span>Interactive concept preview · sample data only</span></div>
    <header className="canvas-preview__intro"><div><h1>Build on the workout you see.</h1><p>Three ways to make the whole session the editing surface. Add, select, repeat, and move blocks without switching to a separate sequence.</p></div><button type="button" onClick={() => { setBlocks(original); setSelected([]); setRepeatCount(1); setMultiSelect(false); setMessage('Preview reset.'); }}><RotateCcw size={15} /> Reset session</button></header>
    <div className="canvas-preview__concepts" role="group" aria-label="Choose workout layout">{concepts.map((concept) => <button key={concept.id} type="button" className={variant === concept.id ? 'is-active' : ''} aria-pressed={variant === concept.id} onClick={() => setVariant(concept.id)}><strong>{concept.name}</strong><span>{concept.description}</span></button>)}</div>
    <DndContext sensors={sensors} collisionDetection={(args) => { const pointer = pointerWithin(args); return pointer.length ? pointer : closestCenter(args); }} onDragEnd={dragEnd}>
      <div className="canvas-preview__workspace">
        <aside className="canvas-preview__palette"><h2>Intensity blocks</h2><p>Every block starts at 10 min. Drag from anywhere on a tile, then set its time on the chart.</p><div>{presets.map((preset, index) => <PaletteItem key={index} preset={preset} index={index} onAdd={() => { const suppression = suppressPresetClick.current; if (suppression?.index === index && suppression.until > Date.now()) { suppressPresetClick.current = null; return; } add(preset); }} />)}</div><p className="canvas-preview__palette-foot">Click a zone to add it at the end.</p></aside>
        <section className={`canvas-preview__session canvas-preview__session--${variant}`} aria-label="Editable full workout session">
          <div className="canvas-preview__session-head"><div><h2>Tuesday threshold</h2><p>Run · {duration} min · {blocks.length} blocks{repeatCopies ? <span role="status"> · preview {previewDuration} min</span> : null}</p></div><span>Draft preview</span></div>
          <div className="canvas-preview__legend"><span><i className="zone-1" /> Easy / recovery</span><span><i className="zone-3" /> Steady</span><span><i className="zone-4" /> Hard</span><span>Width = time · Height = effort</span></div>
          <SortableContext items={blocks.map((block) => block.id)} strategy={rectSortingStrategy}><div className="canvas-preview__track">{chartPieces.map(({ block, preview }) => preview ? <PreviewBar key={block.id} block={block} /> : <CanvasBlock key={block.id} block={block} index={blocks.findIndex((item) => item.id === block.id)} selected={selected.includes(block.id)} onSelect={(id, additive) => select(id, additive || multiSelect)} />)}<EndDrop /></div></SortableContext>
          <div className="canvas-preview__ruler"><span>Start</span><span>{previewDuration} min · Finish</span></div>
          {variant !== 'score' && active ? <BlockFields block={active} onPatch={patch} /> : null}
          <div className="canvas-preview__repeat"><div><strong>Repeat selected pattern</strong><span>{repeatCopies ? `${repeatCount} times · ${previewDuration} min preview` : 'Choose bars, then slide to preview repeats'}</span></div><label><span className="sr-only">Repeat count</span><input type="range" min="1" max="10" step="1" value={repeatCount} disabled={!selected.length} onChange={(event) => setRepeatCount(Number(event.target.value))} /><output>{repeatCount}×</output></label><button type="button" disabled={!repeatCopies} onClick={multiply}>Apply repeats</button></div>
          <div className="canvas-preview__actions" aria-label="Selected block actions"><strong>{selected.length ? `${selected.length} selected` : 'Click a bar to edit'}</strong><button aria-pressed={multiSelect} className={multiSelect ? 'is-active' : ''} onClick={() => setMultiSelect(!multiSelect)}>Select multiple</button><button disabled={!selected.length} onClick={() => move(-1)}><ArrowLeft size={14} /> Earlier</button><button disabled={!selected.length} onClick={() => move(1)}>Later <ArrowRight size={14} /></button><button disabled={!selected.length} onClick={duplicate}><Copy size={14} /> Add copy</button><button className="is-danger" disabled={!selected.length} onClick={remove}><Trash2 size={14} /> Delete</button></div>
          <p className="canvas-preview__message" role="status">{message}</p>
        </section>
        {variant === 'score' ? <aside className="canvas-preview__inspector"><h2>Block details</h2><p>Select a bar to inspect it while the whole session stays in view.</p>{active ? <BlockFields block={active} onPatch={patch} /> : <p className="canvas-preview__hint">Click one bar in the chart to edit it.</p>}</aside> : null}
      </div>
    </DndContext>
    <div className="canvas-preview__note"><strong>Design recommendation</strong><p>Start with Intensity profile for the clearest whole-session shape. Use the same direct editing and multi-block actions in every layout. Keep recovery as an explicit, low effort block rather than an unlabeled gap.</p></div>
  </main>;
}

function PaletteItem({ preset, index, onAdd }: { preset: Preset; index: number; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `preset-${index}` });
  return <div className="canvas-preview__preset" ref={setNodeRef} style={{ opacity: isDragging ? .4 : 1 }}><button className="canvas-preview__preset-button" type="button" {...attributes} {...listeners} aria-label={`Zone ${preset.zone} ${preset.name}, 10 min. Click to add or drag into the chart.`} onClick={onAdd}><span className="canvas-preview__preset-swatch" style={{ background: `var(--color-zone-${preset.zone})` }} aria-hidden="true" /><span className="canvas-preview__preset-copy"><strong>{preset.name}</strong><small>Z{preset.zone} · 10 min</small><span className="canvas-preview__preset-level" aria-hidden="true">{[1, 2, 3, 4, 5].map((step) => <i key={step} style={{ background: step <= preset.zone ? `var(--color-zone-${preset.zone})` : undefined }} />)}</span></span><Plus size={15} aria-hidden="true" /></button></div>;
}

function CanvasBlock({ block, index, selected, onSelect }: { block: Block; index: number; selected: boolean; onSelect: (id: string, additive: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return <article ref={setNodeRef} className={`canvas-preview__block ${selected ? 'is-selected' : ''} ${block.kind === 'Recovery' ? 'is-recovery' : ''}`} style={{ '--zone': `var(--color-zone-${block.zone})`, '--effort-height': `${24 + block.zone * 15}%`, flexGrow: block.minutes, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .45 : 1 } as CSSProperties}>
    <button type="button" className="canvas-preview__bar" {...attributes} {...listeners} aria-label={`${selected ? 'Selected, ' : ''}${block.name}, ${block.kind}, zone ${block.zone}, ${block.minutes} minutes. Block ${index + 1} of workout. Click to inspect; drag to move.`} aria-pressed={selected} onClick={(event) => onSelect(block.id, event.shiftKey || event.ctrlKey || event.metaKey)}><span className="sr-only">{block.name}</span></button>
  </article>;
}

function PreviewBar({ block }: { block: Block }) {
  return <div className="canvas-preview__block is-preview" style={{ '--zone': `var(--color-zone-${block.zone})`, '--effort-height': `${24 + block.zone * 15}%`, flexGrow: block.minutes } as CSSProperties} aria-hidden="true"><span className="canvas-preview__bar" /></div>;
}

function EndDrop() {
  const { setNodeRef, isOver } = useDroppable({ id: 'end' });
  return <div ref={setNodeRef} className={`canvas-preview__end ${isOver ? 'is-over' : ''}`} aria-hidden="true" />;
}

function BlockFields({ block, onPatch }: { block: Block; onPatch: (id: string, patch: Partial<Block>) => void }) {
  return <div className="canvas-preview__inline" aria-label={`Edit ${block.name}`}><strong>Edit {block.name}</strong><label>Name<input value={block.name} onChange={(event) => onPatch(block.id, { name: event.target.value })} /></label><label>Effort<select value={block.zone} onChange={(event) => onPatch(block.id, { zone: Number(event.target.value) })}>{[1,2,3,4,5].map((zone) => <option key={zone} value={zone}>Zone {zone}</option>)}</select></label><label className="canvas-preview__duration"><span>Duration <output>{block.minutes} min</output></span><input type="range" aria-label="Duration in minutes" min="1" max="30" step="1" value={Math.min(block.minutes, 30)} onChange={(event) => onPatch(block.id, { minutes: Number(event.target.value) })} /><span className="canvas-preview__slider-ends"><span>1 min</span><span>30 min</span></span></label></div>;
}
