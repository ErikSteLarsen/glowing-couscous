'use client';

import { addDays, addMonths, format, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Search,
  Trash2,
} from 'lucide-react';

import {
  ActionLink,
  dangerButtonClassName,
  dangerTextClassName,
  EmptyState,
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  primaryButtonClassName,
  Surface,
  successTextClassName,
} from '@/components/ui';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { getTempoZoneMeta } from '@/lib/tempo-blocks';
import { getAverageSessionZone } from '@/lib/session-intensity';
import { SessionIntensitySwatch } from '@/components/tempo/SessionIntensitySwatch';

import type { PlannerRole, PlannerSourceKind, PlannerSource as BasePlannerSource, PlannerSession, PlannerCalendarDay, PlannerAthlete } from '@/lib/planner-view';

type SourceTab = Exclude<PlannerSourceKind, 'template'>;
type PlannerSource = Omit<BasePlannerSource, 'kind'> & { kind: SourceTab };
type PlacementFeedback = { dates: string[]; title: string; state: 'placing' | 'saved' | 'failed'; athleteId: number | null };

export function PlannerDesk({
  role,
  initialDate,
  calendarLabel,
  calendarDays,
  sources,
  athletes = [],
  initialAthleteId = null,
}: {
  role: PlannerRole;
  initialDate: string;
  calendarLabel: string;
  calendarDays: PlannerCalendarDay[];
  sources: PlannerSource[];
  athletes?: PlannerAthlete[];
  initialAthleteId?: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedAthleteId, setSelectedAthleteId] = useState<number | null>(initialAthleteId);
  const [sourceTab, setSourceTab] = useState<SourceTab>('workout');
  const [query, setQuery] = useState('');
  const [selectedSourceKey, setSelectedSourceKey] = useState('');
  const [selectedDates, setSelectedDates] = useState([initialDate]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger' | 'neutral'>('neutral');
  const [pendingAction, setPendingAction] = useState<'assign' | number | null>(null);
  const [placement, setPlacement] = useState<PlacementFeedback | null>(null);
  const mutationInFlight = useRef(false);
  const placementRequest = useRef<{ signature: string; requestKey: string } | null>(null);

  const selectedSource = sources.find((source) => source.key === selectedSourceKey && source.kind === sourceTab) ?? null;
  const visibleSources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sources.filter((source) => {
      if (source.kind !== sourceTab) return false;
      if (!normalizedQuery) return true;
      return `${source.title} ${source.sport} ${source.summary ?? ''}`.toLowerCase().includes(normalizedQuery);
    });
  }, [query, sourceTab, sources]);

  const visibleSessions = calendarDays.flatMap((day) => day.sessions).filter((session) => role === 'athlete' || session.athleteId === selectedAthleteId);
  const selectedDate = selectedDates[0] ?? initialDate;
  const canAssign = Boolean(selectedSource && selectedDates.length && (role === 'athlete' || selectedAthleteId));

  function selectSource(source: PlannerSource) {
    setSelectedSourceKey(source.key);
    setMessage('');
    setMessageTone('neutral');
    if (!selectedDates.length) setSelectedDates([initialDate]);
    if (source.kind === 'training-plan') {
      const monday = format(startOfWeek(parseISO(`${selectedDates[0] ?? initialDate}T00:00:00`), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      setSelectedDates([monday]);
    }
  }

  function changeSourceTab(tab: SourceTab) {
    setSourceTab(tab);
    setQuery('');
    const firstSource = sources.find((source) => source.kind === tab);
    setMessage('');
    setMessageTone('neutral');
    if (firstSource) selectSource(firstSource);
    else setSelectedSourceKey('');
  }

  function selectDate(date: string) {
    setMessageTone('neutral');
    if (selectedSource?.kind === 'training-plan') {
      const monday = format(startOfWeek(parseISO(`${date}T00:00:00`), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      setSelectedDates([monday]);
      setMessage('Training plans always start on a Monday.');
      return;
    }

    setSelectedDates((current) => current.includes(date)
      ? current.filter((item) => item !== date)
      : [...current, date].sort());
    setMessage('');
    setMessageTone('neutral');
  }

  function selectOnlyDate(date: string) {
    setMessageTone('neutral');
    setSelectedDates([date]);
    setMessage(`Only ${formatShortDate(date)} is selected.`);
  }

  function navigateMonth(offset: number) {
    const referenceDate = offset === 0 ? new Date() : parseISO(`${initialDate}T00:00:00`);
    const nextMonth = offset === 0 ? referenceDate : offset > 0 ? addMonths(referenceDate, 1) : subMonths(referenceDate, 1);
    const nextDate = format(startOfMonth(nextMonth), 'yyyy-MM-dd');
    const params = new URLSearchParams({ date: nextDate });
    if (role === 'coach' && selectedAthleteId) params.set('athleteId', String(selectedAthleteId));
    router.push(`${role === 'coach' ? '/coach/planner' : '/athlete/planner'}?${params.toString()}`);
  }

  function navigateWeek(offset: -1 | 1) {
    const referenceDate = parseISO(`${selectedDate}T00:00:00`);
    const shiftedDate = addDays(referenceDate, offset * 7);
    const nextDate = selectedSource?.kind === 'training-plan'
      ? format(startOfWeek(shiftedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(shiftedDate, 'yyyy-MM-dd');
    setSelectedDates([nextDate]);
    setMessage('');
    setMessageTone('neutral');
    const params = new URLSearchParams({ date: nextDate });
    if (role === 'coach' && selectedAthleteId) params.set('athleteId', String(selectedAthleteId));
    router.push(`${role === 'coach' ? '/coach/planner' : '/athlete/planner'}?${params.toString()}`);
  }

  function assignSource() {
    if (mutationInFlight.current) return;
    if (!selectedSource || !selectedDates.length) {
      setMessageTone('danger');
      setMessage('Choose a source and at least one target date.');
      return;
    }
    if (role === 'coach' && !selectedAthleteId) {
      setMessageTone('danger');
      setMessage('Choose an athlete before assigning source content.');
      return;
    }
    mutationInFlight.current = true;
    setPendingAction('assign');
    const feedback = { dates: [...selectedDates], title: selectedSource.title, athleteId: selectedAthleteId };
    setPlacement({ ...feedback, state: 'placing' });
    startTransition(async () => {
      try {
        const signature = JSON.stringify({
          sourceKind: selectedSource.kind,
          sourceId: selectedSource.id,
          dates: [...selectedDates].sort(),
        });
        if (role === 'athlete' && placementRequest.current?.signature !== signature) {
          placementRequest.current = { signature, requestKey: crypto.randomUUID() };
        }
        const body = role === 'athlete'
          ? {
              sourceKind: selectedSource.kind,
              sourceId: selectedSource.id,
              dates: selectedDates,
              requestKey: placementRequest.current?.requestKey,
            }
          : { athleteId: selectedAthleteId, source: coachSource(selectedSource), dates: selectedDates };
        const response = await fetch(role === 'athlete' ? '/api/athlete/planner/assignments' : '/api/coach/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string; sessionIds?: number[] };
        if (!response.ok) {
          setMessageTone('danger');
          setMessage(payload.error ?? 'Could not assign this source.');
          setPlacement({ ...feedback, state: 'failed' });
          return;
        }
        setMessageTone('success');
        if (role === 'athlete') placementRequest.current = null;
        setPlacement({ ...feedback, state: 'saved' });
        setMessage(`${selectedSource.title} assigned to ${payload.sessionIds?.length ?? selectedDates.length} day${(payload.sessionIds?.length ?? selectedDates.length) === 1 ? '' : 's'}.`);
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not confirm placement. Check your connection and try again.');
        setPlacement({ ...feedback, state: 'failed' });
      } finally { mutationInFlight.current = false; setPendingAction(null); }
    });
  }

  function removeSession(session: PlannerSession) {
    if (mutationInFlight.current) return;
    if (!window.confirm(`Remove "${session.title}" from the plan? This cannot be undone.`)) return;
    mutationInFlight.current = true;
    setPendingAction(session.id);
    startTransition(async () => {
      try {
        const endpoint = role === 'athlete' ? `/api/athlete/planner/sessions/${session.id}` : `/api/coach/planner/sessions/${session.id}`;
        const response = await fetch(endpoint, { method: 'DELETE' });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) {
          setMessageTone('danger');
          setMessage(payload.error ?? 'Could not remove this session.');
          return;
        }
        setMessageTone('success');
        setPlacement(null);
        setMessage(`${session.title} removed from ${formatShortDate(session.scheduledDate)}.`);
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage(`Could not remove ${session.title}. Check your connection and try again.`);
      } finally { mutationInFlight.current = false; setPendingAction(null); }
    });
  }

  if (role === 'coach' && athletes.length === 0) {
    return (
      <Surface className="space-y-4">
        <EmptyState
          title="Add an athlete before planning"
          description="Planner places defined workouts and reusable sources on an athlete's calendar. Add someone to your roster, then return here to schedule their work."
          action={<ActionLink href="/coach" tone="secondary" size="compact">Open athletes</ActionLink>}
        />
      </Surface>
    );
  }

  return (
    <div className="planner-desk">
      <AssignmentSummary
        source={selectedSource}
        selectedDates={selectedDates}
        isPending={isPending}
        isAssigning={pendingAction === 'assign'}
        message={message}
        messageTone={messageTone}
        canAssign={canAssign}
        onAssign={assignSource}
      />

      <div className="planner-desk__layout">
        <SourceDock
          role={role}
          sources={sources}
          selectedSource={selectedSource}
          sourceTab={sourceTab}
          query={query}
          visibleSources={visibleSources}
          selectedDate={selectedDate}
          athletes={athletes}
          selectedAthleteId={selectedAthleteId}
          onAthleteChange={setSelectedAthleteId}
          onQueryChange={setQuery}
          onTabChange={changeSourceTab}
          onSelectSource={selectSource}
        />
        <MonthCalendar
          label={calendarLabel}
          initialDate={initialDate}
          selectedDate={selectedDate}
          days={calendarDays.map((day) => ({ ...day, sessions: day.sessions.filter((session) => role === 'athlete' || session.athleteId === selectedAthleteId) }))}
          placement={role === 'athlete' || placement?.athleteId === selectedAthleteId ? placement : null}
          selectedDates={selectedDates}
          selectedSource={selectedSource}
          onNavigate={navigateMonth}
          onNavigateWeek={navigateWeek}
          onSelectDate={selectDate}
        />
        <SelectionPanel
          role={role}
          sessions={visibleSessions}
          selectedDates={selectedDates}
          isPending={isPending}
          removingId={typeof pendingAction === 'number' ? pendingAction : null}
          onSelectOnlyDate={selectOnlyDate}
          onRemoveSession={removeSession}
        />
      </div>
    </div>
  );
}

function AssignmentSummary({ source, selectedDates, isPending, isAssigning, message, messageTone, canAssign, onAssign }: { source: PlannerSource | null; selectedDates: string[]; isPending: boolean; isAssigning: boolean; message: string; messageTone: 'success' | 'danger' | 'neutral'; canAssign: boolean; onAssign: () => void }) {
  const selectedCount = selectedDates.length;
  const buttonLabel = !source
    ? 'Choose a source'
    : source.kind === 'training-plan'
      ? 'Assign training plan'
      : `Assign workout to ${selectedCount} day${selectedCount === 1 ? '' : 's'}`;
  return (
    <section className={`planner-desk__assignment ${source ? 'planner-desk__assignment--active' : 'planner-desk__assignment--idle'} border-y border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-inset)] sm:px-5`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text)]">{source ? source.title : 'No source selected'}{source ? <span className="font-normal text-[var(--text-secondary)]"> · {getSportLabel(source.sport)} · {sourceMeta(source)}</span> : null}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {`${selectedCount} ${selectedCount === 1 ? 'day' : 'days'} selected`}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className={`text-xs text-[var(--text-muted)]`}>
            {!source ? 'Choose a workout or plan below to start planning.' : 'Click dates to toggle the selection.'}
          </p>
          {source ? <button type="button" aria-label={isAssigning ? 'Placing workout' : buttonLabel} disabled={isPending || !canAssign} onClick={onAssign} className={`${primaryButtonClassName} planner-desk__assignment-action`}>
            <Check aria-hidden="true" className="mr-2 h-4 w-4" />
            <span className="md:hidden">{isAssigning ? 'Placing…' : 'Assign'}</span>
            <span className="hidden md:inline">{isAssigning ? 'Placing...' : buttonLabel}</span>
          </button> : null}
        </div>
      </div>
      {message ? <p role={messageTone === 'danger' ? 'alert' : 'status'} aria-live="polite" className={`mt-2 border-t border-[var(--border)] pt-2 ${messageTone === 'danger' ? dangerTextClassName : messageTone === 'success' ? successTextClassName : 'text-sm text-[var(--text-secondary)]'}`}>{message}</p> : null}
    </section>
  );
}

function SourceDock({ role, sources, selectedSource, sourceTab, query, visibleSources, selectedDate, athletes, selectedAthleteId, onAthleteChange, onQueryChange, onTabChange, onSelectSource }: { role: PlannerRole; sources: PlannerSource[]; selectedSource: PlannerSource | null; sourceTab: SourceTab; query: string; visibleSources: PlannerSource[]; selectedDate: string; athletes: PlannerAthlete[]; selectedAthleteId: number | null; onAthleteChange: (athleteId: number) => void; onQueryChange: (query: string) => void; onTabChange: (tab: SourceTab) => void; onSelectSource: (source: PlannerSource) => void }) {
  const tabs: SourceTab[] = role === 'coach' ? ['workout', 'training-plan'] : ['workout'];
  const tabSources = sources.filter((source) => source.kind === sourceTab);
  const hasSearch = query.trim().length > 0;
  return (
    <aside className="planner-desk__sources min-w-0 border border-[var(--border)] bg-[var(--nav-surface)] p-3 shadow-[var(--shadow-inset)]">
      {role === 'coach' ? (
        <label className="block border-b border-[var(--nav-border)] pb-3">
          <span className={formLabelClassName}>Athlete</span>
          <select value={selectedAthleteId ?? ''} onChange={(event) => onAthleteChange(Number(event.target.value))} className={formSelectClassName}>
            {athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.name}</option>)}
          </select>
        </label>
      ) : null}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Find a source</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--nav-muted)]">Search saved content, then choose its dates.</p>
        </div>
        <Search aria-hidden="true" className="mt-1 h-5 w-5 text-[var(--color-liquid)]" />
      </div>
      <label className="relative mt-3 block">
        <span className="sr-only">Search workouts and plans</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search by name or sport" className={`${formFieldClassName} pl-9`} />
      </label>
      <div role="group" aria-label="Filter sources by type" className="mt-3 flex overflow-x-auto border-b border-[var(--nav-border)]">
        {tabs.map((tab) => {
          const count = sources.filter((source) => source.kind === tab).length;
          return <button key={tab} type="button" aria-pressed={sourceTab === tab} onClick={() => onTabChange(tab)} className={`min-h-9 shrink-0 border-b-2 px-2.5 text-xs font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${sourceTab === tab ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--nav-muted)] hover:text-[var(--nav-text)]'}`}>{tab === 'training-plan' ? 'Plans' : `${tab}s`} <span className="font-normal">{count}</span></button>;
        })}
      </div>
      <div className="planner-desk__source-results mt-3 space-y-2">
        {visibleSources.length ? visibleSources.map((source) => <SourceResult key={source.key} source={source} selected={source.key === selectedSource?.key} selectedDate={selectedDate} onSelect={onSelectSource} />) : hasSearch && tabSources.length > 0 ? (
          <div className="border border-dashed border-[var(--nav-border)] px-3 py-4">
            <p className="text-sm text-[var(--nav-muted)]">No {sourceTab === 'training-plan' ? 'plans' : `${sourceTab}s`} match “{query.trim()}”.</p>
            <button type="button" onClick={() => onQueryChange('')} className="mt-2 text-sm font-semibold text-[var(--brand)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">Clear search</button>
          </div>
        ) : role === 'athlete' ? (
          <div className="border border-dashed border-[var(--nav-border)] px-3 py-4">
            <p className="text-sm font-semibold text-[var(--nav-text)]">No saved workouts yet.</p>
            <p className="mt-1 text-sm leading-5 text-[var(--nav-muted)]">Create one in your library, then return here to add it to your calendar.</p>
            <div className="mt-3"><ActionLink href="/athlete/workouts" tone="secondary" size="compact">Create workout</ActionLink></div>
          </div>
        ) : (
          <p className="border border-dashed border-[var(--nav-border)] px-3 py-4 text-sm text-[var(--nav-muted)]">No {sourceTab === 'training-plan' ? 'plans' : `${sourceTab}s`} available.</p>
        )}
      </div>
      <div className="mt-4 border-t border-[var(--nav-border)] pt-3 text-xs leading-5 text-[var(--nav-muted)]">
        <p>Planner places independent copies. Editing stays in the library.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <ActionLink href={role === 'coach' ? '/coach/workouts' : '/athlete/workouts'} tone="ghost" size="compact">Manage workouts</ActionLink>
        </div>
      </div>
    </aside>
  );
}

function SourceResult({ source, selected, selectedDate, onSelect }: { source: PlannerSource; selected: boolean; selectedDate: string; onSelect: (source: PlannerSource) => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={() => onSelect(source)} className={`flex w-full min-w-0 items-start gap-3 rounded-[3px] border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${selected ? 'border-[var(--field-selected-border)] bg-[var(--surface)] shadow-[var(--shadow-inset)]' : 'border-[var(--nav-border)] bg-[var(--field-surface)] hover:border-[var(--field-selected-border)] hover:bg-[var(--surface)]'}`}>
      <span className={`mt-1 h-8 w-1 shrink-0 rounded-full ${source.kind === 'training-plan' ? 'bg-[var(--color-zone-5)]' : 'bg-[var(--color-zone-2)]'}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2"><span className="truncate text-[13px] font-semibold text-[var(--text)]">{source.title}</span>{selected ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" /> : null}</span>
        <span className="mt-1 block text-xs text-[var(--text-secondary)]">{getSportLabel(source.sport)} · {sourceMeta(source)}</span>
        <span className="mt-2 block text-xs leading-5 text-[var(--text-muted)]">{source.summary ?? sourceDescription(source)}</span>
      </span>
    </button>
  );
}

function MonthCalendar({ placement, label, initialDate, selectedDate, days, selectedDates, selectedSource, onNavigate, onNavigateWeek, onSelectDate }: { placement: PlacementFeedback | null; label: string; initialDate: string; selectedDate: string; days: PlannerCalendarDay[]; selectedDates: string[]; selectedSource: PlannerSource | null; onNavigate: (offset: number) => void; onNavigateWeek: (offset: -1 | 1) => void; onSelectDate: (date: string) => void }) {
  const weekStripRef = useRef<HTMLDivElement>(null);
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const weekStart = startOfWeek(parseISO(`${selectedDate}T00:00:00`), { weekStartsOn: 1 });
  const selectedWeekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const isoDate = format(date, 'yyyy-MM-dd');
    const calendarDay = days.find((day) => day.isoDate === isoDate);
    return {
      isoDate,
      label: format(date, 'EEEE'),
      dateLabel: format(date, 'd MMMM yyyy'),
      shortDate: format(date, 'd'),
      sessions: calendarDay?.sessions ?? [],
    };
  });
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    const strip = weekStripRef.current;
    const selectedDay = strip?.querySelector<HTMLButtonElement>(`[data-date="${selectedDate}"]`);
    if (!strip || !selectedDay) return;

    const dayLeft = selectedDay.offsetLeft;
    const dayRight = dayLeft + selectedDay.offsetWidth;
    const stripLeft = strip.scrollLeft;
    const stripRight = stripLeft + strip.clientWidth;
    if (dayRight > stripRight) strip.scrollLeft = dayRight - strip.clientWidth;
    else if (dayLeft < stripLeft) strip.scrollLeft = dayLeft;
  }, [selectedDate]);
  return (
    <section className={`planner-desk__calendar min-w-0 border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-inset)]`}>
      <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em]">{label}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{calendarInstruction(selectedSource)}</p>
        </div>
        <div className="flex items-center gap-1" aria-label="Month navigation">
          <button type="button" aria-label="Previous month" onClick={() => onNavigate(-1)} className="planner-desk__month-nav rounded-[3px] text-[var(--text-secondary)] transition hover:bg-[var(--brand-tint)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
          <button type="button" onClick={() => onNavigate(0)} className="planner-desk__month-current rounded-[3px] px-2.5 text-xs font-medium text-[var(--brand)] transition hover:bg-[var(--brand-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">This month</button>
          <button type="button" aria-label="Next month" onClick={() => onNavigate(1)} className="planner-desk__month-nav rounded-[3px] text-[var(--text-secondary)] transition hover:bg-[var(--brand-tint)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-3">
        <div className="planner-desk__week-picker mb-4 border-b border-[var(--border)] pb-3 md:hidden">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text)]">Choose a day</h3>
              <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{format(parseISO(`${selectedDate}T00:00:00`), 'EEEE d MMMM yyyy')}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" aria-label="Previous week" onClick={() => onNavigateWeek(-1)} className="planner-desk__week-nav" ><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
              <button type="button" aria-label="Next week" onClick={() => onNavigateWeek(1)} className="planner-desk__week-nav"><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
            </div>
          </div>
          <div ref={weekStripRef} className="planner-desk__week-strip" aria-label="Dates in this week">
            {selectedWeekDays.map((day) => (
              <button
                key={day.isoDate}
                data-date={day.isoDate}
                type="button"
                aria-pressed={selectedDates.includes(day.isoDate)}
                aria-current={day.isoDate === todayIso ? 'date' : undefined}
                aria-label={`${day.label}, ${day.dateLabel}${day.sessions.length ? `, ${day.sessions.length} planned` : ', no sessions planned'}`}
                onClick={() => onSelectDate(day.isoDate)}
                className="planner-desk__week-day"
              >
                <span>{format(parseISO(`${day.isoDate}T00:00:00`), 'EEE')}</span>
                <strong>{day.shortDate}</strong>
                {day.sessions.length ? <span className="planner-desk__week-count">{day.sessions.length}</span> : <span className="planner-desk__week-count planner-desk__week-count--empty" aria-hidden="true">·</span>}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">Swipe to browse days. Use the month below for a date range.</p>
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-7 border-y border-[var(--border)] bg-[var(--sunken)]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="planner-desk__month-heading px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{day}</div>)}
          </div>
          <div className="planner-desk__month grid grid-cols-7 divide-x divide-y divide-[var(--border)] border-b border-[var(--border)]" style={{ gridTemplateRows: `repeat(${Math.ceil(days.length / 7)}, minmax(0, 1fr))` }}>
            {days.map((day) => <CalendarCell key={day.isoDate} feedback={placement?.dates.includes(day.isoDate) ? placement : null} day={day} today={day.isoDate === todayIso} selected={selectedDates.includes(day.isoDate)} onSelect={() => onSelectDate(day.isoDate)} />)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 border border-[var(--brand)] bg-[var(--brand-tint)]" /> Selected</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--status-success)]" /> Completed</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--status-warning)]" /> Adjusted</span>
        <span className="ml-auto inline-flex items-center gap-2"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" /> {selectedDates.length} selected</span>
      </div>
    </section>
  );
}

function CalendarCell({ feedback, day, today, selected, onSelect }: { feedback: PlacementFeedback | null; day: PlannerCalendarDay; today: boolean; selected: boolean; onSelect: () => void }) {
  const sessionNames = day.sessions.slice(0, 3).map((session) => session.title).join(', ');
  const extraSessionCount = Math.max(0, day.sessions.length - 3);
  const previewSession = day.sessions[0];
  const previewAverageZone = previewSession ? getAverageSessionZone(previewSession.segments) : null;
  const previewAverageZoneName = previewAverageZone ? getTempoZoneMeta(previewAverageZone).name : null;
  const scheduleDescription = day.sessions.length === 0
    ? 'No sessions planned.'
    : `${day.sessions.length} planned: ${sessionNames}${extraSessionCount ? `, and ${extraSessionCount} more` : ''}.${previewAverageZoneName ? ` First session averages in the ${previewAverageZoneName} zone; pause time is excluded.` : ''}`;
  return (
    <button type="button" aria-pressed={selected} aria-current={today ? 'date' : undefined} aria-label={`${day.label} ${day.dateLabel}${today ? ', today' : ''}. ${scheduleDescription} Toggle date.`} onClick={onSelect} className={`planner-desk__day flex min-w-0 flex-col p-2 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)] ${day.inMonth ? 'bg-[var(--field-surface)]' : 'bg-[var(--sunken)]'} ${!selected ? 'hover:bg-[var(--selection)]' : ''}`}>
      <span className="flex items-center justify-between gap-2"><span className={`metric-text text-sm font-semibold ${day.inMonth ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'} ${today ? 'calendar-day-date--today' : ''}`}>{day.dateLabel.split(' ')[0]}</span></span>
      {feedback ? <span className={`planner-desk__feedback mt-1 block truncate text-xs ${feedback.state === 'failed' ? 'text-[var(--status-danger)]' : feedback.state === 'saved' ? 'text-[var(--status-success)]' : 'text-[var(--text-secondary)]'}`}>{feedback.state === 'placing' ? 'Placing' : feedback.state === 'saved' ? 'Placed' : 'Not confirmed'}: {feedback.title}</span> : null}
      <span className="planner-desk__sessions mt-1 w-full min-w-0">{previewSession ? <span key={previewSession.id} className="flex min-w-0 items-center gap-1.5 bg-[var(--surface)] px-1.5 py-1">{previewAverageZone ? <SessionIntensitySwatch zone={previewAverageZone} /> : null}<span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--text)]">{previewSession.title}</span></span> : null}{day.sessions.length > 1 ? <span className="block px-1.5 text-[11px] text-[var(--text-muted)]">+{day.sessions.length - 1} more</span> : null}</span>
      <span className="planner-desk__count text-[11px] text-[var(--text-secondary)]">{day.sessions.length ? `${day.sessions.length} planned` : ''}</span>
    </button>
  );
}

function SelectionPanel({ role, sessions, selectedDates, isPending, removingId, onSelectOnlyDate, onRemoveSession }: { role: PlannerRole; sessions: PlannerSession[]; selectedDates: string[]; isPending: boolean; removingId: number | null; onSelectOnlyDate: (date: string) => void; onRemoveSession: (session: PlannerSession) => void }) {
  const multiple = selectedDates.length > 1;
  return (
    <section className="planner-desk__selection min-w-0 border border-[var(--field-selected-border)] bg-[var(--brand-tint)] p-4 shadow-[var(--shadow-inset)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em]">{multiple ? 'Selected days' : 'Selected day'}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{multiple ? 'Click a day or session to select only that day.' : 'Sessions assigned to this day.'}</p>
        </div>
        <CalendarDays aria-hidden="true" className="h-5 w-5 text-[var(--brand)]" />
      </div>
      <div className="mt-4 space-y-2 border-t border-[var(--field-selected-border)] pt-3">
        {multiple ? selectedDates.map((date) => {
          const daySessions = sessions.filter((session) => session.scheduledDate === date);
          return <button key={date} type="button" onClick={() => onSelectOnlyDate(date)} className="flex w-full items-start gap-3 border border-[var(--field-selected-border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><span className="metric-text min-w-16 text-sm font-semibold">{formatCompactDate(date)}</span><span className="min-w-0 flex-1">{daySessions.length ? daySessions.map((session) => <span key={session.id} className="block truncate text-[12px] font-semibold">{session.title}</span>) : <span className="block text-xs text-[var(--text-muted)]">Open day</span>}</span><ArrowRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" /></button>;
        }) : <SelectedDaySessions role={role} date={selectedDates[0]} sessions={sessions} isPending={isPending} removingId={removingId} onRemoveSession={onRemoveSession} />}
      </div>
    </section>
  );
}

function SelectedDaySessions({ role, date, sessions, isPending, removingId, onRemoveSession }: { role: PlannerRole; date: string | undefined; sessions: PlannerSession[]; isPending: boolean; removingId: number | null; onRemoveSession: (session: PlannerSession) => void }) {
  if (!date) return <p className="text-sm text-[var(--text-secondary)]">Select a day to see its sessions.</p>;
  const daySessions = sessions.filter((session) => session.scheduledDate === date);
  if (!daySessions.length) return <p className="text-sm text-[var(--text-secondary)]">No sessions assigned to this day.</p>;
  return <div className="space-y-2">{daySessions.map((session) => <SessionDetail key={session.id} role={role} session={session} isPending={isPending} removingId={removingId} onRemoveSession={onRemoveSession} />)}</div>;
}

function SessionDetail({ role, session, isPending, removingId, onRemoveSession }: { role: PlannerRole; session: PlannerSession; isPending: boolean; removingId: number | null; onRemoveSession: (session: PlannerSession) => void }) {
  const sessionHref = role === 'athlete' ? `/athlete/session/${session.id}?from=planner` : session.athleteId ? `/coach/athletes/${session.athleteId}?from=planner&date=${session.scheduledDate}` : '/coach/planner';
  return (
    <div className="border border-[var(--field-selected-border)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={sessionHref} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><span className="flex items-center gap-2"><span className="truncate text-[13px] font-semibold text-[var(--text)]">{session.title}</span><ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" /></span><span className="mt-1 block text-[11px] text-[var(--text-secondary)]">{getSportLabel(session.sport)} · {formatDuration(session.durationSec)} · {session.tss} TSS</span></Link>
        <button type="button" aria-label={`Remove ${session.title}`} disabled={isPending || session.status === 'completed'} title={session.status === 'completed' ? 'Completed sessions cannot be removed from Planner.' : undefined} onClick={() => onRemoveSession(session)} className={`${dangerButtonClassName} min-h-8 px-2.5 py-1.5 text-xs`}>{removingId === session.id ? 'Removing...' : <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}</button>
      </div>
      <div className="mt-3"><SessionBlockBar segments={session.segments} compact /></div>
      <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"><SessionStatusIcon status={session.status} /> {statusLabel(session.status)}</span>
    </div>
  );
}

function SessionStatusIcon({ status }: { status: string }) {
  const Icon = status === 'completed' ? CheckCircle2 : status === 'adjusted' ? CircleAlert : Clock3;
  const className = status === 'completed' ? 'text-[var(--status-success)]' : status === 'adjusted' ? 'text-[var(--status-warning)]' : 'text-[var(--brand)]';
  return <Icon aria-hidden="true" className={`h-3 w-3 ${className}`} />;
}

function coachSource(source: PlannerSource) {
  if (source.kind === 'training-plan') return { kind: 'training-plan' as const, trainingPlanId: source.id };
  return { kind: 'library-session' as const, sessionId: source.id };
}

function sourceMeta(source: PlannerSource) {
  if (source.kind === 'workout') return source.durationSec ? formatDuration(source.durationSec) : 'Workout';
  if (source.kind === 'training-plan') return `${source.sessionCount ?? 0} sessions`;
}

function sourceDescription(source: PlannerSource) {
  if (source.kind === 'training-plan') return 'Monday-start plan with independent athlete sessions.';
  return 'Saved workout copied independently onto the selected dates.';
}

function calendarInstruction(source: PlannerSource | null) {
  if (source?.kind === 'training-plan') return 'Select the week anchor. Training plans always begin on Monday.';
  return 'Select one or more dates for the saved workout.';
}

function formatShortDate(date: string) {
  return format(parseISO(`${date}T00:00:00`), 'd MMM');
}

function formatCompactDate(date: string) {
  return format(parseISO(`${date}T00:00:00`), 'EEE d MMM');
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
