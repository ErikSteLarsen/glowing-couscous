'use client';

import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  GripVertical,
  Layers3,
  ListFilter,
  ListPlus,
  MousePointer2,
  PackageOpen,
  PanelLeft,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
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
import { ATLAS_DIRECTION_LINKS } from './AtlasPreviews';

type PlannerPreviewVariant = 'field' | 'atlas' | 'dispatch';
type SourceKind = 'workout' | 'template';
type TargetMode = 'day' | 'week' | 'month';
type PlacementStatus = 'planned' | 'completed' | 'adjusted';

type PlannerSource = {
  id: string;
  kind: SourceKind;
  title: string;
  sport: string;
  duration: string;
  detail: string;
  cadence: string;
  accent: string;
};

type PlannerPlacement = {
  id: string;
  sourceId: string;
  date: string;
  status: PlacementStatus;
  targetMode: TargetMode;
};

type PlannerDay = {
  iso: string;
  short: string;
  long: string;
  number: string;
};

const WEEK_DAYS: PlannerDay[] = [
  { iso: '2026-09-14', short: 'Mon', long: 'Monday', number: '14' },
  { iso: '2026-09-15', short: 'Tue', long: 'Tuesday', number: '15' },
  { iso: '2026-09-16', short: 'Wed', long: 'Wednesday', number: '16' },
  { iso: '2026-09-17', short: 'Thu', long: 'Thursday', number: '17' },
  { iso: '2026-09-18', short: 'Fri', long: 'Friday', number: '18' },
  { iso: '2026-09-19', short: 'Sat', long: 'Saturday', number: '19' },
  { iso: '2026-09-20', short: 'Sun', long: 'Sunday', number: '20' },
];

const SOURCES: PlannerSource[] = [
  {
    id: 'tempo-build',
    kind: 'workout',
    title: 'Tempo build',
    sport: 'Run',
    duration: '58 min',
    detail: '3 x 8 min at controlled tempo',
    cadence: 'Day',
    accent: 'var(--color-zone-3)',
  },
  {
    id: 'morning-aerobic',
    kind: 'workout',
    title: 'Morning aerobic',
    sport: 'Ride',
    duration: '50 min',
    detail: 'Easy aerobic with a relaxed finish',
    cadence: 'Day',
    accent: 'var(--color-zone-2)',
  },
  {
    id: 'strength-rhythm',
    kind: 'template',
    title: 'Strength rhythm',
    sport: 'Mixed',
    duration: 'Week plan',
    detail: 'Two strength touches across the week',
    cadence: 'Week',
    accent: 'var(--color-zone-4)',
  },
  {
    id: 'race-prep',
    kind: 'template',
    title: 'Race prep block',
    sport: 'Mixed',
    duration: 'Month plan',
    detail: 'A four-week build toward race day',
    cadence: 'Month',
    accent: 'var(--color-zone-5)',
  },
  {
    id: 'long-aerobic',
    kind: 'workout',
    title: 'Long aerobic run',
    sport: 'Run',
    duration: '1 h 42 min',
    detail: 'Steady endurance, last 20 min progressive',
    cadence: 'Day',
    accent: 'var(--color-zone-2)',
  },
];

const INITIAL_PLACEMENTS: PlannerPlacement[] = [
  { id: 'placed-recovery', sourceId: 'morning-aerobic', date: '2026-09-14', status: 'completed', targetMode: 'day' },
  { id: 'placed-tempo', sourceId: 'tempo-build', date: '2026-09-15', status: 'planned', targetMode: 'day' },
  { id: 'placed-strength', sourceId: 'strength-rhythm', date: '2026-09-16', status: 'planned', targetMode: 'week' },
  { id: 'placed-adjusted', sourceId: 'tempo-build', date: '2026-09-17', status: 'adjusted', targetMode: 'day' },
  { id: 'placed-long', sourceId: 'long-aerobic', date: '2026-09-19', status: 'planned', targetMode: 'day' },
];

const MONTH_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_CELLS = Array.from({ length: 35 }, (_, index) => dateFromOffset('2026-08-31', index));
const VARIANT_LINKS: Array<{ id: PlannerPreviewVariant; label: string; href: string }> = [
  { id: 'field', label: 'Field', href: '/design/planner/field' },
  { id: 'atlas', label: 'Atlas', href: '/design/planner/atlas' },
  { id: 'dispatch', label: 'Dispatch', href: '/design/planner/dispatch' },
];

export function PlannerPreviews({ variant }: { variant: PlannerPreviewVariant }) {
  const [selectedSourceId, setSelectedSourceId] = useState('tempo-build');
  const [selectedDate, setSelectedDate] = useState('2026-09-16');
  const [selectedDispatchDates, setSelectedDispatchDates] = useState(['2026-09-16', '2026-09-18']);
  const [targetMode, setTargetMode] = useState<TargetMode>('day');
  const [placements, setPlacements] = useState(INITIAL_PLACEMENTS);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const selectedSource = getSource(selectedSourceId) ?? SOURCES[0];
  const activeSource = activeSourceId ? getSource(activeSourceId) : null;

  function changeTargetMode(mode: TargetMode) {
    setTargetMode(mode);
    setMessage('');
    if (mode !== 'day') {
      const anchor = mode === 'week' ? WEEK_DAYS[0].iso : '2026-09-01';
      setSelectedDate(anchor);
      setSelectedDispatchDates([anchor]);
    }
  }

  function selectSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    setMessage('');
  }

  function toggleDispatchDate(date: string) {
    setSelectedDate(date);
    setMessage('');
    if (targetMode !== 'day') {
      setSelectedDispatchDates([date]);
      return;
    }
    setSelectedDispatchDates((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date].sort());
  }

  function getTargetDates(anchor: string, explicitDates?: string[]) {
    if (targetMode === 'week') return [WEEK_DAYS[0].iso];
    if (targetMode === 'month') return ['2026-09-01'];
    return explicitDates?.length ? explicitDates : [anchor];
  }

  function placeSource(sourceId = selectedSourceId, anchor = selectedDate, explicitDates?: string[]) {
    const source = getSource(sourceId);
    if (!source) return;
    const dates = getTargetDates(anchor, explicitDates);
    const newPlacements: PlannerPlacement[] = dates.map((date, index) => ({
      id: `${sourceId}-${Date.now()}-${index}`,
      sourceId,
      date,
      status: 'planned',
      targetMode,
    }));
    setPlacements((current) => [...current, ...newPlacements]);
    setSelectedSourceId(sourceId);
    setSelectedDate(anchor);
    setMessage(`${source.title} placed on ${targetSummary(dates, targetMode)}.`);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveSourceId(String(event.active.id).replace('source-', ''));
  }

  function handleDragEnd(event: DragEndEvent) {
    const sourceId = String(event.active.id).replace('source-', '');
    const date = event.over?.data.current?.date as string | undefined;
    setActiveSourceId(null);
    if (!date) return;
    setSelectedSourceId(sourceId);
    setSelectedDate(date);
    if (variant === 'dispatch') setSelectedDispatchDates([date]);
    placeSource(sourceId, date, [date]);
  }

  function handleDragCancel() {
    setActiveSourceId(null);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="planner-preview min-h-screen bg-[var(--background)] text-[var(--text)]">
        <PreviewChrome variant={variant} />
        <main className="mx-auto w-full max-w-[1480px] px-5 pb-12 pt-7 sm:px-7 lg:px-10">
          <header className="flex flex-col gap-5 border-b border-[var(--border)] pb-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-[40px] font-normal leading-none tracking-[-0.045em] max-md:text-[34px]">{variantTitle(variant)}</h1>
              <p className="mt-3 max-w-[68ch] text-[15px] leading-6 text-[var(--text-secondary)]">{variantDescription(variant)}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="inline-flex h-2 w-2 rounded-full bg-[var(--status-success)]" />
              Synthetic preview data
            </div>
          </header>

          <div className="mt-6">
            <AssignmentBar
              source={selectedSource}
              targetMode={targetMode}
              selectedDate={selectedDate}
              selectedCount={variant === 'dispatch' && targetMode === 'day' ? selectedDispatchDates.length : 1}
              message={message}
              onModeChange={changeTargetMode}
              onPlace={() => placeSource(selectedSourceId, selectedDate, variant === 'dispatch' ? selectedDispatchDates : undefined)}
            />
          </div>

          <div className="mt-6">
            {variant === 'field' ? (
              <FieldLayout
                placements={placements}
                selectedSourceId={selectedSourceId}
                selectedDate={selectedDate}
                onSelectSource={selectSource}
                onSelectDate={(date) => { setSelectedDate(date); setMessage(''); }}
                onPlace={(date) => placeSource(selectedSourceId, date, [date])}
              />
            ) : null}
            {variant === 'atlas' ? (
              <AtlasLayout
                placements={placements}
                selectedSourceId={selectedSourceId}
                selectedDate={selectedDate}
                onSelectSource={selectSource}
                onSelectDate={(date) => { setSelectedDate(date); setMessage(''); }}
                onPlace={(date) => placeSource(selectedSourceId, date, [date])}
              />
            ) : null}
            {variant === 'dispatch' ? (
              <DispatchLayout
                placements={placements}
                sources={SOURCES}
                selectedSourceId={selectedSourceId}
                selectedDates={selectedDispatchDates}
                onSelectSource={selectSource}
                onToggleDate={toggleDispatchDate}
                onPlace={() => placeSource(selectedSourceId, selectedDate, selectedDispatchDates)}
              />
            ) : null}
          </div>
        </main>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeSource ? <SourceGhost source={activeSource} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function PreviewChrome({ variant }: { variant: PlannerPreviewVariant }) {
  return (
    <div className="border-b border-[var(--nav-border)] bg-[var(--nav-surface)]">
      <div className="mx-auto flex min-h-14 max-w-[1480px] items-center justify-between gap-4 px-5 sm:px-7 lg:px-10">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[-0.01em] text-[var(--nav-text)]">
          <span className="ink-brand-mark h-7 w-7"><span /><i /></span>
          Tempo <span className="hidden font-normal text-[var(--nav-muted)] sm:inline">/ Planner directions</span>
        </Link>
        <nav aria-label="Planner preview directions" className="flex items-center gap-1 overflow-x-auto">
          {VARIANT_LINKS.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={variant === link.id ? 'page' : undefined}
              className={`min-h-8 rounded-[3px] px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${variant === link.id ? 'bg-[var(--nav-active)] text-[var(--nav-text)]' : 'text-[var(--nav-muted)] hover:bg-[var(--nav-active)] hover:text-[var(--nav-text)]'}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

function AssignmentBar({
  source,
  targetMode,
  selectedDate,
  selectedCount,
  message,
  onModeChange,
  onPlace,
}: {
  source: PlannerSource;
  targetMode: TargetMode;
  selectedDate: string;
  selectedCount: number;
  message: string;
  onModeChange: (mode: TargetMode) => void;
  onPlace: () => void;
}) {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-inset)] sm:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-[var(--brand-tint)] text-[var(--brand)] sm:inline-flex">
            <ArrowDownToLine aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">Ready to place</p>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{source.title} <span className="font-normal text-[var(--text-secondary)]">· {source.sport} · {source.duration}</span></p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex rounded-[3px] border border-[var(--field-border)] bg-[var(--field-surface)] p-0.5" aria-label="Placement scope">
            {(['day', 'week', 'month'] as TargetMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={targetMode === mode}
                onClick={() => onModeChange(mode)}
                className={`min-h-8 rounded-[3px] px-3 text-xs font-medium capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${targetMode === mode ? 'bg-[var(--brand)] text-[var(--signal-ink)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="min-w-0 text-sm text-[var(--text-secondary)]">
            <span className="text-[var(--text-muted)]">Target:</span> {targetSummary(targetMode === 'day' ? [selectedDate] : targetMode === 'week' ? [WEEK_DAYS[0].iso] : ['2026-09-01'], targetMode)}
            {selectedCount > 1 ? ` · ${selectedCount} days` : ''}
          </p>
          <button type="button" onClick={onPlace} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[3px] bg-[var(--brand)] px-4 py-2 text-[13px] font-semibold text-[var(--signal-ink)] shadow-[var(--shadow-raised)] transition hover:bg-[var(--signal-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]">
            <Plus aria-hidden="true" className="h-4 w-4" />
            {selectedCount > 1 ? `Place on ${selectedCount} days` : 'Add here'}
          </button>
        </div>
      </div>
      {message ? <p role="status" aria-live="polite" className="mt-3 border-t border-[var(--border)] pt-3 text-sm text-[var(--status-success)]">{message}</p> : null}
    </section>
  );
}

function FieldLayout({
  placements,
  selectedSourceId,
  selectedDate,
  onSelectSource,
  onSelectDate,
  onPlace,
}: {
  placements: PlannerPlacement[];
  selectedSourceId: string;
  selectedDate: string;
  onSelectSource: (sourceId: string) => void;
  onSelectDate: (date: string) => void;
  onPlace: (date: string) => void;
}) {
  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
      <section className="min-w-0 border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em]">Week of 14 September</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Drop a source onto a day. The open spaces are part of the plan.</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]"><MousePointer2 aria-hidden="true" className="h-3.5 w-3.5" /> Drag or select a day</span>
        </div>
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="grid min-w-[840px] grid-cols-7 divide-x divide-[var(--border)] border-y border-[var(--border)]">
            {WEEK_DAYS.map((day) => (
              <WeekDropSlot
                key={day.iso}
                day={day}
                placements={placementsForDate(placements, day.iso)}
                selected={selectedDate === day.iso}
                onSelect={() => onSelectDate(day.iso)}
                onPlace={() => onPlace(day.iso)}
              />
            ))}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[var(--text-muted)] sm:hidden">Swipe sideways to see all seven days.</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--status-success)]" /> Completed</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--status-warning)]" /> Adjusted</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full border border-[var(--brand)] bg-[var(--brand-tint)]" /> Open target</span>
        </div>
      </section>
      <SourceDock selectedSourceId={selectedSourceId} onSelectSource={onSelectSource} />
    </div>
  );
}

function SourceDock({ selectedSourceId, onSelectSource, compact = false }: { selectedSourceId: string; onSelectSource: (sourceId: string) => void; compact?: boolean }) {
  return (
    <aside className={`min-w-0 border border-[var(--border)] bg-[var(--nav-surface)] p-4 ${compact ? '' : 'xl:sticky xl:top-5 xl:self-start'}`}>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--nav-border)] pb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Source dock</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--nav-muted)]">Saved content, ready to move.</p>
        </div>
        <PackageOpen aria-hidden="true" className="mt-1 h-5 w-5 text-[var(--color-liquid)]" />
      </div>
      <div className="mt-4 space-y-2.5">
        {SOURCES.map((source) => <SourceCard key={source.id} source={source} selected={source.id === selectedSourceId} onSelect={onSelectSource} compact={compact} />)}
      </div>
      <div className="mt-4 flex items-start gap-2 border-t border-[var(--nav-border)] pt-4 text-xs leading-5 text-[var(--nav-muted)]">
        <GripVertical aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Drag a source to a day, or select it and use the placement bar above.
      </div>
    </aside>
  );
}

function SourceCard({ source, selected, onSelect, compact = false }: { source: PlannerSource; selected: boolean; onSelect: (sourceId: string) => void; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `source-${source.id}`, data: { sourceId: source.id } });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.45 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex w-full min-w-0 items-start gap-2 rounded-[3px] border p-3 text-left transition ${selected ? 'border-[var(--field-selected-border)] bg-[var(--surface)] shadow-[var(--shadow-inset)]' : 'border-[var(--nav-border)] bg-[var(--field-surface)] hover:border-[var(--field-selected-border)] hover:bg-[var(--surface)]'} ${compact ? 'p-2.5' : ''}`}
    >
      <button type="button" aria-pressed={selected} onClick={() => onSelect(source.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]">
        <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: source.accent }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-[var(--text)]">{source.title}</span>
            {selected ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" /> : null}
          </span>
          <span className="mt-1 block text-xs text-[var(--text-secondary)]">{source.sport} · {source.duration}</span>
          {!compact ? <span className="mt-2 block text-xs leading-5 text-[var(--text-muted)]">{source.detail}</span> : null}
          <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--brand)]"><Layers3 aria-hidden="true" className="h-3 w-3" /> {source.kind} · {source.cadence}</span>
        </span>
      </button>
      <button type="button" aria-label={`Drag ${source.title}`} className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] text-[var(--text-muted)] transition hover:bg-[var(--brand-tint)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]" {...listeners} {...attributes}>
        <GripVertical aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

function SourceGhost({ source }: { source: PlannerSource }) {
  return (
    <div className="flex w-[250px] items-center gap-3 border border-[var(--field-focus)] bg-[var(--surface)] p-3 shadow-[var(--shadow-overlay)]">
      <span className="h-8 w-1 rounded-full" style={{ backgroundColor: source.accent }} />
      <span className="min-w-0"><strong className="block truncate text-sm">{source.title}</strong><span className="text-xs text-[var(--text-secondary)]">Drop to place</span></span>
    </div>
  );
}

function WeekDropSlot({ day, placements, selected, onSelect, onPlace }: { day: PlannerDay; placements: PlannerPlacement[]; selected: boolean; onSelect: () => void; onPlace: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `field-day-${day.iso}`, data: { date: day.iso } });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      onDoubleClick={onPlace}
      aria-label={`${day.long} ${day.number}, ${placements.length} planned`}
      className={`flex min-h-[258px] min-w-0 flex-col bg-[var(--field-surface)] p-3 text-left align-top transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)] ${selected ? 'bg-[var(--brand-tint)]' : ''} ${isOver ? 'bg-[var(--selection)]' : ''}`}
    >
      <span className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-2">
        <span><span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{day.short}</span><span className="metric-text mt-1 block text-xl font-semibold text-[var(--text)]">{day.number}</span></span>
        {selected ? <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--signal-ink)]"><Check aria-hidden="true" className="h-3 w-3" /></span> : null}
      </span>
      <span className="mt-3 space-y-2">
        {placements.map((placement) => <PlacementLine key={placement.id} placement={placement} />)}
      </span>
      <span className={`mt-auto flex min-h-8 items-center gap-1.5 border border-dashed px-2 py-1.5 text-[11px] font-medium ${isOver || selected ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-[var(--field-border)] text-[var(--text-muted)]'}`}>
        <Plus aria-hidden="true" className="h-3.5 w-3.5" /> {isOver ? 'Release to add' : 'Drop or select'}
      </span>
    </button>
  );
}

function AtlasLayout({ placements, selectedSourceId, selectedDate, onSelectSource, onSelectDate, onPlace }: { placements: PlannerPlacement[]; selectedSourceId: string; selectedDate: string; onSelectSource: (sourceId: string) => void; onSelectDate: (date: string) => void; onPlace: (date: string) => void }) {
  const selectedDay = getDay(selectedDate) ?? WEEK_DAYS[2];
  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-semibold tracking-[-0.02em]">September 2026</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">A month at a glance, with one day open for detail.</p></div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><CalendarRange aria-hidden="true" className="h-4 w-4" /> 30 days in view</div>
        </div>
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="min-w-[650px]">
            <div className="grid grid-cols-7 border-y border-[var(--border)] bg-[var(--sunken)]">
              {MONTH_DAY_NAMES.map((name) => <div key={name} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{name}</div>)}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border)] border-b border-[var(--border)]">
              {MONTH_CELLS.map((date) => (
                <MonthDropCell key={date} date={date} placements={placementsForDate(placements, date)} selected={selectedDate === date} onSelect={() => onSelectDate(date)} onPlace={() => onPlace(date)} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-muted)]"><span className="inline-flex h-5 w-5 items-center justify-center border border-dashed border-[var(--brand)] text-[var(--brand)]"><Plus aria-hidden="true" className="h-3 w-3" /></span> Select a date to open its placement rail.</div>
      </section>
      <aside className="min-w-0 space-y-5 xl:sticky xl:top-5 xl:self-start">
        <section className="border border-[var(--field-selected-border)] bg-[var(--brand-tint)] p-5 shadow-[var(--shadow-inset)]">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--brand)]">Focused day</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{selectedDay.long}, {selectedDay.number} Sep</h2></div><CalendarDays aria-hidden="true" className="h-5 w-5 text-[var(--brand)]" /></div>
          <div className="mt-5 space-y-2 border-t border-[var(--field-selected-border)] pt-4">
            {placementsForDate(placements, selectedDate).length ? placementsForDate(placements, selectedDate).map((placement) => <PlacementLine key={placement.id} placement={placement} />) : <p className="text-sm text-[var(--text-secondary)]">This day is open. Add the selected source here.</p>}
          </div>
          <button type="button" onClick={() => onPlace(selectedDate)} className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-[var(--brand)] px-4 py-2 text-[13px] font-semibold text-[var(--signal-ink)] transition hover:bg-[var(--signal-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-tint)]"><Plus aria-hidden="true" className="h-4 w-4" /> Add selected source</button>
        </section>
        <SourceDock selectedSourceId={selectedSourceId} onSelectSource={onSelectSource} compact />
      </aside>
    </div>
  );
}

function MonthDropCell({ date, placements, selected, onSelect, onPlace }: { date: string; placements: PlannerPlacement[]; selected: boolean; onSelect: () => void; onPlace: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `atlas-day-${date}`, data: { date } });
  const inMonth = date.startsWith('2026-09');
  return (
    <button ref={setNodeRef} type="button" onClick={onSelect} onDoubleClick={onPlace} aria-label={`${formatShortDate(date)}, ${placements.length} planned`} className={`flex min-h-[102px] min-w-0 flex-col p-2 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)] ${inMonth ? 'bg-[var(--field-surface)]' : 'bg-[var(--sunken)] opacity-55'} ${selected ? 'bg-[var(--brand-tint)]' : ''} ${isOver ? 'bg-[var(--selection)]' : ''}`}>
      <span className="flex items-center justify-between gap-2"><span className={`metric-text text-sm font-semibold ${inMonth ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>{date.slice(-2).replace(/^0/, '')}</span>{selected ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-[var(--brand)]" /> : null}</span>
      <span className="mt-2 min-w-0 space-y-1">{placements.slice(0, 2).map((placement) => <span key={placement.id} className="block truncate border-l-2 border-[var(--brand)] bg-[var(--surface)] px-1.5 py-1 text-[11px] font-medium text-[var(--text)]">{getSource(placement.sourceId)?.title}</span>)}{placements.length > 2 ? <span className="block px-1.5 text-[11px] text-[var(--text-muted)]">+{placements.length - 2} more</span> : null}</span>
      {isOver ? <span className="mt-auto text-[11px] font-semibold text-[var(--brand)]">Release to add</span> : null}
    </button>
  );
}

function DispatchLayout({ placements, sources, selectedSourceId, selectedDates, onSelectSource, onToggleDate, onPlace }: { placements: PlannerPlacement[]; sources: PlannerSource[]; selectedSourceId: string; selectedDates: string[]; onSelectSource: (sourceId: string) => void; onToggleDate: (date: string) => void; onPlace: () => void }) {
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
      <section className="min-w-0 border border-[var(--border)] bg-[var(--nav-surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--nav-border)] pb-4"><div><h2 className="text-xl font-semibold tracking-[-0.02em]">Source queue</h2><p className="mt-1 text-sm leading-5 text-[var(--nav-muted)]">Pick one, then mark every target it should reach.</p></div><ListFilter aria-hidden="true" className="mt-1 h-5 w-5 text-[var(--color-liquid)]" /></div>
        <div className="mt-4 space-y-2.5">{sources.map((source) => <SourceCard key={source.id} source={source} selected={source.id === selectedSourceId} onSelect={onSelectSource} compact />)}</div>
      </section>
      <section className="min-w-0 border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold tracking-[-0.02em]">Dispatch board</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Week of 14 September · {selectedDates.length} targets selected</p></div><span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]"><ListPlus aria-hidden="true" className="h-3.5 w-3.5" /> Multi-day placement</span></div>
        <div className="mt-5 grid gap-3 md:grid-cols-7">
          {WEEK_DAYS.map((day) => <DispatchTarget key={day.iso} day={day} selected={selectedDates.includes(day.iso)} placements={placementsForDate(placements, day.iso)} onToggle={() => onToggleDate(day.iso)} />)}
        </div>
        <div className="mt-6 grid gap-5 border-t border-[var(--border)] pt-5 xl:grid-cols-[1fr_260px]">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">Selected targets</p><div className="mt-3 flex flex-wrap gap-2">{selectedDates.length ? selectedDates.map((date) => <span key={date} className="inline-flex items-center gap-2 border border-[var(--field-selected-border)] bg-[var(--brand-tint)] px-2.5 py-2 text-xs font-semibold text-[var(--field-selected-text)]"><Check aria-hidden="true" className="h-3 w-3" /> {formatShortDate(date)}</span>) : <span className="text-sm text-[var(--text-secondary)]">Select at least one day above.</span>}</div></div>
          <div className="border-l-0 border-[var(--border)] bg-[var(--field-surface)] p-4 xl:border-l xl:pl-5"><p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">Dispatching</p><p className="mt-2 text-sm font-semibold text-[var(--text)]">{getSource(selectedSourceId)?.title}</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">The library stays untouched. Each target receives an independent planned copy.</p><button type="button" onClick={onPlace} disabled={!selectedDates.length} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-[var(--brand)] px-3 py-2 text-[13px] font-semibold text-[var(--signal-ink)] transition hover:bg-[var(--signal-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--field-surface)]"><ArrowRight aria-hidden="true" className="h-4 w-4" /> Place selected</button></div>
        </div>
      </section>
    </div>
  );
}

function DispatchTarget({ day, selected, placements, onToggle }: { day: PlannerDay; selected: boolean; placements: PlannerPlacement[]; onToggle: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `dispatch-day-${day.iso}`, data: { date: day.iso } });
  return (
    <button ref={setNodeRef} type="button" onClick={onToggle} aria-pressed={selected} aria-label={`${day.long} ${day.number}, ${placements.length} planned`} className={`flex min-h-[174px] min-w-0 flex-col border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)] ${selected ? 'border-[var(--brand)] bg-[var(--brand-tint)]' : 'border-[var(--border)] bg-[var(--field-surface)] hover:border-[var(--field-selected-border)]'} ${isOver ? 'bg-[var(--selection)]' : ''}`}>
      <span className="flex items-start justify-between gap-2"><span><span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{day.short}</span><span className="metric-text mt-1 block text-xl font-semibold">{day.number}</span></span><span className={`inline-flex h-5 w-5 items-center justify-center border ${selected ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--signal-ink)]' : 'border-[var(--field-border)] text-transparent'}`}><Check aria-hidden="true" className="h-3 w-3" /></span></span>
      <span className="mt-4 space-y-1.5">{placements.map((placement) => <span key={placement.id} className="block truncate border-l-2 border-[var(--brand)] bg-[var(--surface)] px-1.5 py-1 text-[11px] font-medium">{getSource(placement.sourceId)?.title}</span>)}</span>
      <span className={`mt-auto pt-3 text-[11px] font-medium ${isOver ? 'text-[var(--brand)]' : 'text-[var(--text-muted)]'}`}>{isOver ? 'Release to add' : selected ? 'Target selected' : 'Select target'}</span>
    </button>
  );
}

function PlacementLine({ placement }: { placement: PlannerPlacement }) {
  const source = getSource(placement.sourceId);
  if (!source) return null;
  const statusMeta = {
    planned: { label: 'Planned', icon: Clock3, className: 'text-[var(--brand)]' },
    completed: { label: 'Completed', icon: CheckCircle2, className: 'text-[var(--status-success)]' },
    adjusted: { label: 'Adjusted', icon: CircleAlert, className: 'text-[var(--status-warning)]' },
  }[placement.status];
  const StatusIcon = statusMeta.icon;
  return (
    <span className="block min-w-0 border-l-2 border-[var(--brand)] bg-[var(--surface)] px-2 py-2 shadow-[var(--shadow-inset)]">
      <span className="block truncate text-[12px] font-semibold text-[var(--text)]">{source.title}</span>
      <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"><StatusIcon aria-hidden="true" className={`h-3 w-3 ${statusMeta.className}`} /> {statusMeta.label} · {source.duration}</span>
    </span>
  );
}

function placementsForDate(placements: PlannerPlacement[], date: string) {
  return placements.filter((placement) => placement.date === date);
}

function getSource(id: string) {
  return SOURCES.find((source) => source.id === id) ?? null;
}

function getDay(date: string) {
  return WEEK_DAYS.find((day) => day.iso === date) ?? null;
}

function dateFromOffset(startIso: string, offset: number) {
  const date = new Date(`${startIso}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parsed);
}

function targetSummary(dates: string[], mode: TargetMode) {
  if (mode === 'week') return 'week of 14 Sep';
  if (mode === 'month') return 'September 2026';
  if (dates.length === 1) return formatShortDate(dates[0]);
  return `${dates.length} selected days`;
}

function variantTitle(variant: PlannerPreviewVariant) {
  return { field: 'Place work on the week.', atlas: 'See the whole month.', dispatch: 'Queue once. Place everywhere.' }[variant];
}

function variantDescription(variant: PlannerPreviewVariant) {
  return {
    field: 'A calendar-first wall for the moment you already know the week you want to shape. Keep the source dock nearby and let open days invite the next move.',
    atlas: 'A month map for longer-range planning. Select any date to bring its sessions into focus, then place a day, week, or month source without leaving the map.',
    dispatch: 'A deliberate queue for batching assignments. Pick one saved workout or template, mark the days it belongs on, and commit the whole set in one motion.',
  }[variant];
}

export function PlannerPreviewIndex() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-5 py-10 text-[var(--text)] sm:px-7 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3 text-sm font-semibold"><span className="ink-brand-mark h-7 w-7"><span /><i /></span> Tempo <span className="font-normal text-[var(--text-muted)]">/ Planner directions</span></div>
        <h1 className="mt-16 max-w-3xl text-[48px] font-normal leading-[0.98] tracking-[-0.05em] max-md:text-[34px]">Three ways to put the right work on the right day.</h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[var(--text-secondary)]">These are interactive directions for the planner assignment surface. Each keeps the calendar visible, makes source placement legible, and leaves a direct click path beside drag and drop.</p>
        <div className="mt-12 grid gap-4 md:grid-cols-3">{VARIANT_LINKS.map((link) => <Link key={link.id} href={link.href} className="group border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-inset)] transition hover:border-[var(--field-focus)]"><span className="flex items-center justify-between gap-3"><span className="text-xl font-semibold tracking-[-0.02em]">{link.label}</span><ArrowRight aria-hidden="true" className="h-4 w-4 text-[var(--brand)] transition-transform group-hover:translate-x-1" /></span><span className="mt-3 block text-sm leading-6 text-[var(--text-secondary)]">{variantDescription(link.id)}</span></Link>)}</div>
        <div className="mt-12 border-t border-[var(--border)] pt-8">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Atlas refinements</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Three new month-first directions based on multi-day workout selection, template ranges, and searchable source tabs.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">{ATLAS_DIRECTION_LINKS.map((link) => <Link key={link.id} href={link.href} className="group border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-inset)] transition hover:border-[var(--field-focus)]"><span className="flex items-center justify-between gap-3"><span className="text-lg font-semibold tracking-[-0.02em]">{link.label}</span><ArrowRight aria-hidden="true" className="h-4 w-4 text-[var(--brand)] transition-transform group-hover:translate-x-1" /></span></Link>)}</div>
        </div>
      </div>
    </div>
  );
}
