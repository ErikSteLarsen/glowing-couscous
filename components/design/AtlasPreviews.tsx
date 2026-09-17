'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

export type AtlasDirectionVariant = 'select' | 'range' | 'desk';
type AtlasSourceKind = 'workout' | 'template';
type AtlasPlacementStatus = 'planned' | 'completed' | 'adjusted';

type AtlasSource = {
  id: string;
  kind: AtlasSourceKind;
  title: string;
  sport: string;
  duration: string;
  durationDays?: number;
  detail: string;
  accent: string;
};

type AtlasPlacement = {
  id: string;
  sourceId: string;
  date: string;
  status: AtlasPlacementStatus;
  sequenceIndex?: number;
};

type AtlasDay = {
  iso: string;
  short: string;
  long: string;
  number: string;
};

export const ATLAS_DIRECTION_LINKS: Array<{ id: AtlasDirectionVariant; label: string; href: string }> = [
  { id: 'select', label: 'Select days', href: '/design/planner/atlas/select' },
  { id: 'range', label: 'Template range', href: '/design/planner/atlas/range' },
  { id: 'desk', label: 'Planning desk', href: '/design/planner/atlas/desk' },
];

export const ATLAS_SOURCE_IDS = ['tempo-build', 'morning-aerobic', 'strength-rhythm', 'race-prep', 'long-aerobic'];

const MONTH_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_CELLS = Array.from({ length: 35 }, (_, index) => dateFromOffset('2026-08-31', index));
const ATLAS_MONTH_DAYS: AtlasDay[] = MONTH_CELLS.map((iso) => ({
  iso,
  short: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(new Date(`${iso}T12:00:00`)),
  long: new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(`${iso}T12:00:00`)),
  number: iso.slice(-2).replace(/^0/, ''),
}));

const ATLAS_SOURCES: AtlasSource[] = [
  {
    id: 'tempo-build',
    kind: 'workout',
    title: 'Tempo build',
    sport: 'Run',
    duration: '58 min',
    detail: '3 x 8 min at controlled tempo',
    accent: 'var(--color-zone-3)',
  },
  {
    id: 'morning-aerobic',
    kind: 'workout',
    title: 'Morning aerobic',
    sport: 'Ride',
    duration: '50 min',
    detail: 'Easy aerobic with a relaxed finish',
    accent: 'var(--color-zone-2)',
  },
  {
    id: 'strength-rhythm',
    kind: 'template',
    title: 'Strength rhythm',
    sport: 'Mixed',
    duration: '7 days',
    durationDays: 7,
    detail: 'Two strength touches across the week',
    accent: 'var(--color-zone-4)',
  },
  {
    id: 'race-prep',
    kind: 'template',
    title: 'Race prep block',
    sport: 'Mixed',
    duration: '28 days',
    durationDays: 28,
    detail: 'A four-week build toward race day',
    accent: 'var(--color-zone-5)',
  },
  {
    id: 'long-aerobic',
    kind: 'workout',
    title: 'Long aerobic run',
    sport: 'Run',
    duration: '1 h 42 min',
    detail: 'Steady endurance, last 20 min progressive',
    accent: 'var(--color-zone-2)',
  },
];

const INITIAL_PLACEMENTS: AtlasPlacement[] = [
  { id: 'placed-recovery', sourceId: 'morning-aerobic', date: '2026-09-03', status: 'completed' },
  { id: 'placed-tempo', sourceId: 'tempo-build', date: '2026-09-08', status: 'planned' },
  { id: 'placed-strength', sourceId: 'strength-rhythm', date: '2026-09-14', status: 'planned', sequenceIndex: 1 },
  { id: 'placed-strength-2', sourceId: 'strength-rhythm', date: '2026-09-16', status: 'planned', sequenceIndex: 3 },
  { id: 'placed-adjusted', sourceId: 'tempo-build', date: '2026-09-18', status: 'adjusted' },
  { id: 'placed-long', sourceId: 'long-aerobic', date: '2026-09-26', status: 'planned' },
];

export function AtlasPreviews({ variant }: { variant: AtlasDirectionVariant }) {
  const [sourceTab, setSourceTab] = useState<AtlasSourceKind>('workout');
  const [query, setQuery] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('tempo-build');
  const [selectedDates, setSelectedDates] = useState(['2026-09-16']);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [placements, setPlacements] = useState(INITIAL_PLACEMENTS);
  const [notice, setNotice] = useState('');

  const selectedSource = getSource(selectedSourceId) ?? ATLAS_SOURCES[0];
  const visibleSources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return ATLAS_SOURCES.filter((source) => {
      if (source.kind !== sourceTab) return false;
      if (!normalizedQuery) return true;
      return `${source.title} ${source.sport} ${source.detail}`.toLowerCase().includes(normalizedQuery);
    });
  }, [query, sourceTab]);

  function selectSource(sourceId: string) {
    const source = getSource(sourceId);
    if (!source) return;
    setSelectedSourceId(sourceId);
    setNotice('');
    if (source.kind === 'template') {
      const start = selectedDates[0] ?? '2026-09-16';
      setRangeStart(start);
      setRangeEnd(null);
      setSelectedDates([start]);
    } else {
      setRangeStart(null);
      setRangeEnd(null);
      if (!selectedDates.length) setSelectedDates(['2026-09-16']);
    }
  }

  function changeSourceTab(kind: AtlasSourceKind) {
    setSourceTab(kind);
    const firstVisible = ATLAS_SOURCES.find((source) => source.kind === kind);
    if (firstVisible && selectedSource.kind !== kind) selectSource(firstVisible.id);
  }

  function selectDate(date: string) {
    if (selectedSource.kind === 'template') {
      if (!rangeStart || rangeEnd) {
        setRangeStart(date);
        setRangeEnd(null);
        setSelectedDates([date]);
        setNotice(`Start date set to ${formatShortDate(date)}. Choose an end date.`);
        return;
      }
      const dates = datesBetween(rangeStart, date);
      setRangeEnd(date);
      setSelectedDates(dates);
      const expectedDays = selectedSource.durationDays ?? 0;
      setNotice(dates.length === expectedDays
        ? `${selectedSource.title} fits from ${formatShortDate(dates[0])} to ${formatShortDate(dates[dates.length - 1])}.`
        : `${selectedSource.title} needs ${expectedDays} days. This range contains ${dates.length}.`);
      return;
    }

    setSelectedDates((current) => {
      if (current.includes(date)) return current.filter((item) => item !== date);
      return [...current, date].sort();
    });
    setNotice('');
  }

  function selectOnlyDate(date: string) {
    setSelectedDates([date]);
    if (selectedSource.kind === 'template') {
      setRangeStart(date);
      setRangeEnd(null);
    }
    setNotice(`Only ${formatShortDate(date)} is selected.`);
  }

  function assignSelected() {
    if (!selectedDates.length) {
      setNotice('Select at least one day before assigning.');
      return;
    }
    if (selectedSource.kind === 'template' && selectedDates.length !== selectedSource.durationDays) {
      setNotice(`${selectedSource.title} needs exactly ${selectedSource.durationDays} selected days.`);
      return;
    }

    const newPlacements = selectedDates.map((date, index) => ({
      id: `${selectedSource.id}-${Date.now()}-${index}`,
      sourceId: selectedSource.id,
      date,
      status: 'planned' as const,
      sequenceIndex: selectedSource.kind === 'template' ? index + 1 : undefined,
    }));
    setPlacements((current) => {
      const existing = new Set(current.map((placement) => `${placement.sourceId}:${placement.date}`));
      return [...current, ...newPlacements.filter((placement) => !existing.has(`${placement.sourceId}:${placement.date}`))];
    });
    setNotice(selectedSource.kind === 'template'
      ? `${selectedSource.title} assigned across ${selectedDates.length} days.`
      : `${selectedSource.title} assigned to ${selectedDates.length} ${selectedDates.length === 1 ? 'day' : 'days'}.`);
  }

  const isTemplateRangeValid = selectedSource.kind !== 'template' || selectedDates.length === selectedSource.durationDays;

  return (
    <div className="planner-preview min-h-screen bg-[var(--background)] text-[var(--text)]">
      <AtlasChrome variant={variant} />
      <main className="mx-auto w-full max-w-[1520px] px-5 pb-12 pt-4 sm:px-7 lg:px-10">
        <header className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-[34px] font-normal leading-none tracking-[-0.045em] max-md:text-[30px]">{atlasVariantTitle(variant)}</h1>
            <p className="mt-2 max-w-[72ch] text-[15px] leading-6 text-[var(--text-secondary)]">{atlasVariantDescription(variant)}</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]"><span className="h-2 w-2 rounded-full bg-[var(--status-success)]" /> Synthetic preview data</span>
        </header>

        <div className="mt-4">
          <AssignmentSummary
            source={selectedSource}
            selectedDates={selectedDates}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            valid={isTemplateRangeValid}
            notice={notice}
            onAssign={assignSelected}
          />
        </div>

        <div className="mt-4">
          {variant === 'select' ? (
            <SelectDaysLayout
              placements={placements}
              selectedDates={selectedDates}
              selectedSource={selectedSource}
              sourceTab={sourceTab}
              query={query}
              visibleSources={visibleSources}
              onQueryChange={setQuery}
              onTabChange={changeSourceTab}
              onSelectSource={selectSource}
              onSelectDate={selectDate}
              onSelectOnlyDate={selectOnlyDate}
            />
          ) : null}
          {variant === 'range' ? (
            <RangeLayout
              placements={placements}
              selectedDates={selectedDates}
              selectedSource={selectedSource}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              sourceTab={sourceTab}
              query={query}
              visibleSources={visibleSources}
              onQueryChange={setQuery}
              onTabChange={changeSourceTab}
              onSelectSource={selectSource}
              onSelectDate={selectDate}
              onSelectOnlyDate={selectOnlyDate}
            />
          ) : null}
          {variant === 'desk' ? (
            <DeskLayout
              placements={placements}
              selectedDates={selectedDates}
              selectedSource={selectedSource}
              sourceTab={sourceTab}
              query={query}
              visibleSources={visibleSources}
              onQueryChange={setQuery}
              onTabChange={changeSourceTab}
              onSelectSource={selectSource}
              onSelectDate={selectDate}
              onSelectOnlyDate={selectOnlyDate}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function AtlasChrome({ variant }: { variant: AtlasDirectionVariant }) {
  return (
    <div className="border-b border-[var(--nav-border)] bg-[var(--nav-surface)]">
      <div className="mx-auto flex min-h-12 max-w-[1520px] items-center justify-between gap-4 px-5 sm:px-7 lg:px-10">
        <Link href="/design/planner" className="flex items-center gap-3 text-sm font-semibold tracking-[-0.01em] text-[var(--nav-text)]">
          <span className="ink-brand-mark h-7 w-7"><span /><i /></span>
          Tempo <span className="hidden font-normal text-[var(--nav-muted)] sm:inline">/ Atlas directions</span>
        </Link>
        <nav aria-label="Atlas preview directions" className="flex items-center gap-1 overflow-x-auto">
          {ATLAS_DIRECTION_LINKS.map((link) => (
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

function AssignmentSummary({ source, selectedDates, rangeStart, rangeEnd, valid, notice, onAssign }: { source: AtlasSource; selectedDates: string[]; rangeStart: string | null; rangeEnd: string | null; valid: boolean; notice: string; onAssign: () => void }) {
  const isTemplate = source.kind === 'template';
  const label = isTemplate ? `Assign ${source.durationDays}-day template` : `Assign workout to ${selectedDates.length} ${selectedDates.length === 1 ? 'day' : 'days'}`;
  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-inset)] sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-[var(--brand-tint)] text-[var(--brand)] sm:inline-flex"><Sparkles aria-hidden="true" className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text)]">{source.title} <span className="font-normal text-[var(--text-secondary)]">· {source.sport} · {source.duration}</span></p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {isTemplate
                ? `${selectedDates.length} of ${source.durationDays} days selected${rangeStart ? ` · starts ${formatShortDate(rangeStart)}` : ''}${rangeEnd ? ` · ends ${formatShortDate(rangeEnd)}` : ''}`
                : `${selectedDates.length} ${selectedDates.length === 1 ? 'day' : 'days'} selected`}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className={`text-xs ${isTemplate && !valid ? 'text-[var(--status-warning)]' : 'text-[var(--text-muted)]'}`}>
            {isTemplate ? (valid ? 'Range length matches the template.' : `Select exactly ${source.durationDays} days.`) : 'Click dates in the month to toggle them.'}
          </p>
          <button type="button" onClick={onAssign} disabled={!selectedDates.length || !valid} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[3px] bg-[var(--brand)] px-4 py-2 text-[13px] font-semibold text-[var(--signal-ink)] shadow-[var(--shadow-raised)] transition hover:bg-[var(--signal-hover)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]">
            <Check aria-hidden="true" className="h-4 w-4" /> {label}
          </button>
        </div>
      </div>
      {notice ? <p role="status" aria-live="polite" className="mt-2 border-t border-[var(--border)] pt-2 text-xs text-[var(--text-secondary)]">{notice}</p> : null}
    </section>
  );
}

function SelectDaysLayout(props: LayoutProps) {
  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
      <AtlasMonth {...props} helper="Select one or more dates for a workout. Select a start and end for a template." />
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
        <SourceDock {...props} />
        <SelectionPanel {...props} />
      </aside>
    </div>
  );
}

function RangeLayout(props: LayoutProps & { rangeStart: string | null; rangeEnd: string | null }) {
  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
      <AtlasMonth {...props} helper="Templates become a continuous run. Choose the first day, then the last day." />
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
        <RangeCard {...props} />
        <SourceDock {...props} />
        <SelectionPanel {...props} compact />
      </aside>
    </div>
  );
}

function DeskLayout(props: LayoutProps) {
  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[290px_minmax(0,1fr)_310px]">
      <SourceDock {...props} compact />
      <AtlasMonth {...props} helper="Select dates in the month. Your current selection stays visible on the right." />
      <SelectionPanel {...props} />
    </div>
  );
}

type LayoutProps = {
  placements: AtlasPlacement[];
  selectedDates: string[];
  selectedSource: AtlasSource;
  sourceTab: AtlasSourceKind;
  query: string;
  visibleSources: AtlasSource[];
  onQueryChange: (query: string) => void;
  onTabChange: (kind: AtlasSourceKind) => void;
  onSelectSource: (sourceId: string) => void;
  onSelectDate: (date: string) => void;
  onSelectOnlyDate: (date: string) => void;
};

function AtlasMonth({ placements, selectedDates, selectedSource, helper, onSelectDate }: LayoutProps & { helper: string }) {
  return (
    <section className="min-w-0 border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em]">September 2026</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{helper}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]"><CalendarDays aria-hidden="true" className="h-4 w-4" /> {selectedDates.length} selected</span>
      </div>
      <div className="mt-3 overflow-x-auto pb-1">
        <div className="min-w-[650px]">
          <div className="grid grid-cols-7 border-y border-[var(--border)] bg-[var(--sunken)]">
            {MONTH_DAY_NAMES.map((name) => <div key={name} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{name}</div>)}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border)] border-b border-[var(--border)]">
            {ATLAS_MONTH_DAYS.map((day) => (
              <AtlasMonthCell
                key={day.iso}
                day={day}
                placements={placementsForDate(placements, day.iso)}
                selected={selectedDates.includes(day.iso)}
                templateMode={selectedSource.kind === 'template'}
                onSelect={() => onSelectDate(day.iso)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--brand)]" /> Selected date</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--status-success)]" /> Completed</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--status-warning)]" /> Adjusted</span>
      </div>
    </section>
  );
}

function AtlasMonthCell({ day, placements, selected, templateMode, onSelect }: { day: AtlasDay; placements: AtlasPlacement[]; selected: boolean; templateMode: boolean; onSelect: () => void }) {
  const inMonth = day.iso.startsWith('2026-09');
  return (
    <button
      type="button"
      disabled={!inMonth}
      aria-pressed={selected}
      aria-label={`${day.long} ${day.number}, ${placements.length} assigned. ${templateMode ? 'Select as a template range date.' : 'Toggle this date.'}`}
      onClick={onSelect}
      className={`flex min-h-[94px] min-w-0 flex-col p-2 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)] disabled:cursor-default ${inMonth ? 'bg-[var(--field-surface)]' : 'bg-[var(--sunken)] opacity-45'} ${selected ? 'bg-[var(--brand-tint)]' : ''} ${inMonth && !selected ? 'hover:bg-[var(--selection)]' : ''}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={`metric-text text-sm font-semibold ${inMonth ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>{day.number}</span>
        {selected ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--signal-ink)]"><Check aria-hidden="true" className="h-3 w-3" /></span> : null}
      </span>
      <span className="mt-2 min-w-0 space-y-1">
        {placements.slice(0, 2).map((placement) => {
          const source = getSource(placement.sourceId);
          return source ? <span key={placement.id} className="block truncate border-l-2 px-1.5 py-1 text-[11px] font-medium text-[var(--text)]" style={{ borderColor: source.accent, backgroundColor: 'var(--surface)' }}>{source.title}{source.kind === 'template' && placement.sequenceIndex ? ` · ${placement.sequenceIndex}/${source.durationDays}` : ''}</span> : null;
        })}
        {placements.length > 2 ? <span className="block px-1.5 text-[11px] text-[var(--text-muted)]">+{placements.length - 2} more</span> : null}
      </span>
    </button>
  );
}

function SourceDock({ sourceTab, query, visibleSources, selectedSource, onQueryChange, onTabChange, onSelectSource, compact = false }: LayoutProps & { compact?: boolean }) {
  return (
    <aside className={`min-w-0 border border-[var(--border)] bg-[var(--nav-surface)] shadow-[var(--shadow-inset)] ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Find a source</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--nav-muted)]">Search your saved workouts and templates.</p>
        </div>
        <Search aria-hidden="true" className="mt-1 h-5 w-5 text-[var(--color-liquid)]" />
      </div>
      <label className="relative mt-3 block">
        <span className="sr-only">Search workouts and templates</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search by name or sport" className="min-h-10 w-full rounded-[3px] border border-[var(--field-border)] bg-[var(--field-surface)] py-2 pl-9 pr-3 text-[13px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--field-focus)] focus:ring-2 focus:ring-[var(--brand)]/20" />
      </label>
      <div role="tablist" aria-label="Source type" className="mt-3 flex border-b border-[var(--nav-border)]">
        {(['workout', 'template'] as AtlasSourceKind[]).map((kind) => {
          const count = ATLAS_SOURCES.filter((source) => source.kind === kind).length;
          return <button key={kind} type="button" role="tab" aria-selected={sourceTab === kind} onClick={() => onTabChange(kind)} className={`min-h-9 border-b-2 px-3 text-xs font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${sourceTab === kind ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--nav-muted)] hover:text-[var(--nav-text)]'}`}>{kind}s <span className="font-normal">{count}</span></button>;
        })}
      </div>
      <div className="mt-3 space-y-2">
        {visibleSources.length ? visibleSources.map((source) => <SourceResult key={source.id} source={source} selected={source.id === selectedSource.id} onSelect={onSelectSource} />) : <p className="border border-dashed border-[var(--nav-border)] px-3 py-4 text-sm text-[var(--nav-muted)]">No {sourceTab}s match “{query}”.</p>}
      </div>
    </aside>
  );
}

function SourceResult({ source, selected, onSelect }: { source: AtlasSource; selected: boolean; onSelect: (sourceId: string) => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={() => onSelect(source.id)} className={`flex w-full min-w-0 items-start gap-3 rounded-[3px] border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${selected ? 'border-[var(--field-selected-border)] bg-[var(--surface)] shadow-[var(--shadow-inset)]' : 'border-[var(--nav-border)] bg-[var(--field-surface)] hover:border-[var(--field-selected-border)] hover:bg-[var(--surface)]'}`}>
      <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: source.accent }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2"><span className="truncate text-[13px] font-semibold text-[var(--text)]">{source.title}</span>{selected ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" /> : null}</span>
        <span className="mt-1 block text-xs text-[var(--text-secondary)]">{source.sport} · {source.duration}</span>
        <span className="mt-2 block text-xs leading-5 text-[var(--text-muted)]">{source.detail}</span>
      </span>
    </button>
  );
}

function RangeCard({ selectedSource, selectedDates, rangeStart, rangeEnd }: LayoutProps & { rangeStart: string | null; rangeEnd: string | null }) {
  const isTemplate = selectedSource.kind === 'template';
  return (
    <section className="border border-[var(--field-selected-border)] bg-[var(--brand-tint)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-lg font-semibold tracking-[-0.02em]">Template range</h2>
      <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{isTemplate ? `${selectedSource.title} needs ${selectedSource.duration}.` : 'Choose a template to compose a range.'}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="border border-[var(--field-selected-border)] bg-[var(--surface)] p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Start</p><p className="metric-text mt-1 text-sm font-semibold">{rangeStart ? formatShortDate(rangeStart) : 'Choose date'}</p></div>
        <div className="border border-[var(--field-selected-border)] bg-[var(--surface)] p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">End</p><p className="metric-text mt-1 text-sm font-semibold">{rangeEnd ? formatShortDate(rangeEnd) : 'Choose date'}</p></div>
      </div>
      <p className="mt-3 text-xs text-[var(--text-secondary)]">{selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'} in the current selection.</p>
    </section>
  );
}

function SelectionPanel({ placements, selectedDates, onSelectOnlyDate, compact = false }: LayoutProps & { compact?: boolean }) {
  const isMultiple = selectedDates.length > 1;
  return (
    <section className={`min-w-0 border border-[var(--field-selected-border)] bg-[var(--brand-tint)] shadow-[var(--shadow-inset)] ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em]">{isMultiple ? 'Selected days' : 'Selected day'}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{isMultiple ? 'Click a day or session to select only that day.' : 'Sessions assigned to this day.'}</p>
        </div>
        <CalendarDays aria-hidden="true" className="h-5 w-5 text-[var(--brand)]" />
      </div>
      <div className="mt-4 space-y-2 border-t border-[var(--field-selected-border)] pt-3">
        {isMultiple ? selectedDates.map((date) => {
          const dayPlacements = placementsForDate(placements, date);
          return <button key={date} type="button" onClick={() => onSelectOnlyDate(date)} className="flex w-full items-start gap-3 border border-[var(--field-selected-border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><span className="metric-text min-w-16 text-sm font-semibold">{formatCompactDate(date)}</span><span className="min-w-0 flex-1">{dayPlacements.length ? dayPlacements.map((placement) => <span key={placement.id} className="block truncate text-[12px] font-semibold">{placementSummary(placement)}</span>) : <span className="block text-xs text-[var(--text-muted)]">Open day</span>}</span><ArrowRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" /></button>;
        }) : <SingleDayAssignments date={selectedDates[0]} placements={placements} onSelectOnlyDate={onSelectOnlyDate} />}
      </div>
    </section>
  );
}

function SingleDayAssignments({ date, placements, onSelectOnlyDate }: { date: string | undefined; placements: AtlasPlacement[]; onSelectOnlyDate: (date: string) => void }) {
  if (!date) return <p className="text-sm text-[var(--text-secondary)]">Select a day in the month to see its sessions.</p>;
  const dayPlacements = placementsForDate(placements, date);
  if (!dayPlacements.length) return <p className="text-sm text-[var(--text-secondary)]">No sessions assigned to this day.</p>;
  return <div className="space-y-2">{dayPlacements.map((placement) => <PlacementItem key={placement.id} placement={placement} date={date} onSelectOnlyDate={onSelectOnlyDate} />)}</div>;
}

function PlacementItem({ placement, date, onSelectOnlyDate }: { placement: AtlasPlacement; date: string; onSelectOnlyDate: (date: string) => void }) {
  const source = getSource(placement.sourceId);
  if (!source) return null;
  const content = <><span className="flex items-center justify-between gap-2"><span className="truncate text-[13px] font-semibold">{source.title}</span>{source.kind === 'workout' ? <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--brand)]" /> : null}</span><span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"><StatusIcon status={placement.status} /> {source.kind === 'template' && placement.sequenceIndex ? `Day ${placement.sequenceIndex} of ${source.durationDays} · ` : ''}{statusLabel(placement.status)} · {source.duration}</span></>;
  if (source.kind === 'workout') return <Link href={`/design/planner/atlas/workout/${source.id}`} className="block border border-[var(--field-selected-border)] bg-[var(--surface)] px-3 py-3 transition hover:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">{content}</Link>;
  return <button type="button" onClick={() => onSelectOnlyDate(date)} className="block w-full border border-[var(--field-selected-border)] bg-[var(--surface)] px-3 py-3 text-left transition hover:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">{content}</button>;
}

function StatusIcon({ status }: { status: AtlasPlacementStatus }) {
  const Icon = status === 'completed' ? CheckCircle2 : status === 'adjusted' ? CircleAlert : Clock3;
  const className = status === 'completed' ? 'text-[var(--status-success)]' : status === 'adjusted' ? 'text-[var(--status-warning)]' : 'text-[var(--brand)]';
  return <Icon aria-hidden="true" className={`h-3 w-3 ${className}`} />;
}

export function AtlasPreviewIndex() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--text)] sm:px-7 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/design/planner" className="flex items-center gap-3 text-sm font-semibold"><span className="ink-brand-mark h-7 w-7"><span /><i /></span> Tempo <span className="font-normal text-[var(--text-muted)]">/ Atlas directions</span></Link>
        <h1 className="mt-12 max-w-3xl text-[42px] font-normal leading-[0.98] tracking-[-0.05em] max-md:text-[32px]">Three simpler ways to assign from the month.</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--text-secondary)]">Each direction keeps the month visible, lets workouts target multiple days, and treats templates as a validated start-to-end range. Search is split into separate workout and template tabs in every source dock.</p>
        <div className="mt-9 grid gap-4 md:grid-cols-3">{ATLAS_DIRECTION_LINKS.map((link) => <Link key={link.id} href={link.href} className="group border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-inset)] transition hover:border-[var(--field-focus)]"><span className="flex items-center justify-between gap-3"><span className="text-xl font-semibold tracking-[-0.02em]">{link.label}</span><ArrowRight aria-hidden="true" className="h-4 w-4 text-[var(--brand)] transition-transform group-hover:translate-x-1" /></span><span className="mt-3 block text-sm leading-6 text-[var(--text-secondary)]">{atlasVariantDescription(link.id)}</span></Link>)}</div>
      </div>
    </div>
  );
}

export function AtlasWorkoutPreview({ sourceId }: { sourceId: string }) {
  const source = getSource(sourceId);
  return (
    <div className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--text)] sm:px-7 lg:px-10">
      <main className="mx-auto max-w-3xl">
        <Link href="/design/planner/atlas/select" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)]"><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to Atlas directions</Link>
        {source ? <>
          <div className="mt-12 flex items-start gap-4 border-b border-[var(--border)] pb-6"><span className="mt-1 h-12 w-1 rounded-full" style={{ backgroundColor: source.accent }} /><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Workout library preview</p><h1 className="mt-2 text-[42px] font-normal leading-none tracking-[-0.045em]">{source.title}</h1><p className="mt-3 text-[15px] text-[var(--text-secondary)]">{source.sport} · {source.duration}</p></div></div>
          <section className="mt-6 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-inset)]"><div className="flex items-center gap-2 text-sm font-semibold"><FileText aria-hidden="true" className="h-4 w-4 text-[var(--brand)]" /> Session outline</div><p className="mt-4 text-[15px] leading-7 text-[var(--text-secondary)]">{source.detail}. This destination represents the exact workout selected from the day detail rail.</p><div className="mt-6 flex flex-wrap gap-3"><span className="border border-[var(--border)] bg-[var(--field-surface)] px-3 py-2 text-xs font-semibold">{source.sport}</span><span className="border border-[var(--border)] bg-[var(--field-surface)] px-3 py-2 text-xs font-semibold">{source.duration}</span></div></section>
        </> : <div className="mt-12 border border-[var(--border)] bg-[var(--surface)] p-5"><h1 className="text-2xl font-semibold">Workout not found</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">This synthetic preview source does not exist.</p></div>}
      </main>
    </div>
  );
}

function getSource(id: string) {
  return ATLAS_SOURCES.find((source) => source.id === id) ?? null;
}

function placementsForDate(placements: AtlasPlacement[], date: string) {
  return placements.filter((placement) => placement.date === date);
}

function dateFromOffset(startIso: string, offset: number) {
  const date = new Date(`${startIso}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function datesBetween(start: string, end: string) {
  const first = start <= end ? start : end;
  const last = start <= end ? end : start;
  const dates: string[] = [];
  const cursor = new Date(`${first}T12:00:00`);
  const endDate = new Date(`${last}T12:00:00`);
  while (cursor <= endDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
}

function formatCompactDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
}

function statusLabel(status: AtlasPlacementStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function placementSummary(placement: AtlasPlacement) {
  const source = getSource(placement.sourceId);
  if (!source) return 'Unknown session';
  return source.kind === 'template' && placement.sequenceIndex ? `${source.title} · Day ${placement.sequenceIndex}` : source.title;
}

function atlasVariantTitle(variant: AtlasDirectionVariant) {
  return {
    select: 'Select the days. Then assign.',
    range: 'Give templates a clear run.',
    desk: 'Keep the whole planning desk open.',
  }[variant];
}

function atlasVariantDescription(variant: AtlasDirectionVariant) {
  return {
    select: 'A quiet month view with a searchable source dock and a selected-day rail. Workouts can land on several dates at once.',
    range: 'A range-first composition for templates. Mark a start and end, see the exact day count, and assign only when the template fits.',
    desk: 'A three-pane working view for people who want search, month context, and selected-day sessions visible without switching panels.',
  }[variant];
}
