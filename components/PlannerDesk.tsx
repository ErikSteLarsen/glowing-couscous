'use client';

import { SearchField } from '@/components/tempo/SearchField';
import { addMonths, format, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
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
  Badge,
  ActionLink,
  dangerButtonClassName,
  dangerTextClassName,
  EmptyState,
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  getSwitchOptionClassName,
  ghostButtonClassName,
  iconButtonClassName,
  primaryButtonClassName,
  Surface,
  successTextClassName,
  switchTrackClassName,
} from '@/components/ui';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { formatDuration } from '@/lib/format-duration';
import { parsePlannedTime } from '@/lib/planned-time';
import { getSportLabel } from '@/lib/sport';
import { getTemplateDurationDays, templateDatesForSelection, templateCadenceMeta, validateTemplateDateRange, type TemplateCadence } from '@/lib/template-cadence';

export type PlannerDeskRole = 'coach' | 'athlete';
export type PlannerDeskSourceKind = 'workout' | 'template' | 'training-plan';

export type PlannerDeskSource = {
  key: string;
  id: number;
  kind: PlannerDeskSourceKind;
  title: string;
  sport: string;
  summary: string | null;
  durationSec?: number;
  cadence?: TemplateCadence;
  sessionCount?: number;
};

export type PlannerDeskSession = {
  id: number;
  athleteId?: number | null;
  scheduledDate: string;
  sport: string;
  title: string;
  summary?: string | null;
  status: string;
  durationSec: number;
  tss: number | null;
  segments: Array<{ key: string; zone: number; durationSec: number; label: string; color: string }>;
};

export type PlannerDeskCalendarDay = {
  isoDate: string;
  label: string;
  dateLabel: string;
  inMonth: boolean;
  sessions: PlannerDeskSession[];
};

export type PlannerDeskAthlete = {
  id: number;
  name: string;
  email?: string;
};

type SourceTab = PlannerDeskSourceKind;
type PlacementFeedback = { dates: string[]; title: string; state: 'placing' | 'saved' | 'failed'; athleteId: number | null };

export function PlannerDesk({
  role,
  initialDate,
  today,
  calendarLabel,
  calendarDays,
  sources,
  athletes = [],
  initialAthleteId = null,
  initialSourceKey = '',
  initialSourceTab = 'workout',
  initialMessage = '',
  getNavigationHref,
}: {
  role: PlannerDeskRole;
  initialDate: string;
  /** The user's calendar day (yyyy-MM-dd), resolved on the server in their zone. */
  today: string;
  calendarLabel: string;
  calendarDays: PlannerDeskCalendarDay[];
  sources: PlannerDeskSource[];
  athletes?: PlannerDeskAthlete[];
  initialAthleteId?: number | null;
  initialSourceKey?: string;
  initialSourceTab?: PlannerDeskSourceKind;
  initialMessage?: string;
  /** Athlete placement lives inside Calendar, which owns the month URL. */
  getNavigationHref?: (date: string, sourceKey: string | null) => string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialSource = sources.find((source) => source.key === initialSourceKey && source.kind === initialSourceTab);
  const initialTemplateDates = initialSource?.kind === 'template'
    ? templateDatesForSelection(initialSource.cadence ?? 'day', initialDate)
    : [initialDate];
  const initialSelectedDates = initialTemplateDates.length ? initialTemplateDates : [initialDate];
  const [selectedAthleteId, setSelectedAthleteId] = useState<number | null>(initialAthleteId);
  const [sourceTab, setSourceTab] = useState<SourceTab>(initialSourceTab);
  const [query, setQuery] = useState('');
  const [selectedSourceKey, setSelectedSourceKey] = useState(initialSourceKey);
  const [selectedDates, setSelectedDates] = useState(initialSelectedDates);
  const [rangeStart, setRangeStart] = useState<string | null>(initialSource?.kind === 'template' ? initialSelectedDates[0] ?? null : null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(initialSource?.kind === 'template' && (initialSource.cadence ?? 'day') !== 'day' ? initialSelectedDates.at(-1) ?? null : null);
  const [message, setMessage] = useState(initialMessage);
  const [startTime, setStartTime] = useState('');
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
  const selectedTemplateDays = selectedSource?.kind === 'template' ? getTemplateDurationDays(selectedSource.cadence ?? 'day', selectedDate) : null;
  const templateRangeError = selectedSource?.kind === 'template' ? validateTemplateDateRange(selectedDates, selectedSource.cadence ?? 'day') : null;
  const templateRangeValid = selectedSource?.kind !== 'template'
    || (selectedSource.cadence === 'day'
      ? selectedDates.length === 1
      : selectedDates.length === selectedTemplateDays && templateRangeError === null);
  const plannedTime = parsePlannedTime(startTime.trim());
  const timeError = plannedTime.ok ? null : plannedTime.error;
  const scopedCalendarDays = calendarDays.map((day) => ({ ...day, sessions: day.sessions.filter((session) => role === 'athlete' || session.athleteId === selectedAthleteId) }));
  const duplicateSourceDates = selectedSource
    ? selectedDates.filter((date) => scopedCalendarDays.some((day) => day.isoDate === date
        && day.sessions.some((session) => session.title === selectedSource.title && session.sport === selectedSource.sport)))
    : [];
  const sourceNoun = selectedSource?.kind === 'template' ? 'template' : selectedSource?.kind === 'training-plan' ? 'plan' : 'workout';
  const duplicateWarning = duplicateSourceDates.length ? `Some selected days already have this ${sourceNoun}.` : null;
  const canAssign = Boolean(selectedSource && selectedDates.length && templateRangeValid && !timeError && (role === 'athlete' || selectedAthleteId));

  function selectSource(source: PlannerDeskSource) {
    setSelectedSourceKey(source.key);
    setMessage('');
    setMessageTone('neutral');
    if (source.kind === 'template') {
      const dates = templateDatesForSelection(source.cadence ?? 'day', selectedDates[0] ?? initialDate);
      setSelectedDates(dates);
      setRangeStart(dates[0] ?? null);
      setRangeEnd((source.cadence ?? 'day') === 'day' ? null : dates.at(-1) ?? null);
      if (dates.length > 1) {
        setMessageTone('neutral');
        setMessage(`Selected ${formatShortDate(dates[0])} to ${formatShortDate(dates[dates.length - 1])}. Review the highlighted dates, then assign.`);
      }
    } else {
      setRangeStart(null);
      setRangeEnd(null);
      if (!selectedDates.length) setSelectedDates([initialDate]);
    }
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
    else { setSelectedSourceKey(''); setRangeStart(null); setRangeEnd(null); }
  }

  function selectDate(date: string) {
    setMessageTone('neutral');
    if (selectedSource?.kind === 'template') {
      if (selectedSource.cadence === 'day') {
        setSelectedDates([date]);
        setRangeStart(date);
        setRangeEnd(null);
        setMessage('');
    setMessageTone('neutral');
        return;
      }
      if (!rangeStart || rangeEnd) {
        setRangeStart(date);
        setRangeEnd(null);
        setSelectedDates([date]);
        setMessage(`Start date set to ${formatShortDate(date)}. Choose an end date.`);
        return;
      }
      const dates = datesBetween(rangeStart, date);
      setRangeEnd(date);
      setSelectedDates(dates);
      const rangeError = validateTemplateDateRange(dates, selectedSource.cadence ?? 'day');
      setMessageTone(rangeError ? 'danger' : 'neutral');
      setMessage(rangeError === null
        ? `${selectedSource.title} fits this ${dates.length}-day range.`
        : rangeError);
      return;
    }

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

  function selectTemplateRange() {
    if (selectedSource?.kind !== 'template') return;
    const dates = templateDatesForSelection(selectedSource.cadence ?? 'day', selectedDate);
    setSelectedDates(dates);
    setRangeStart(dates[0]);
    setRangeEnd(dates.at(-1) ?? null);
    setMessageTone('neutral');
    setMessage(`Selected ${formatShortDate(dates[0])} to ${formatShortDate(dates[dates.length - 1])}. Review the highlighted dates, then assign.`);
  }

  function selectOnlyDate(date: string) {
    setMessageTone('neutral');
    setSelectedDates([date]);
    if (selectedSource?.kind === 'template') {
      setRangeStart(date);
      setRangeEnd(null);
    }
    setMessage(`Only ${formatShortDate(date)} is selected.`);
  }

  function navigateMonth(offset: number) {
    const referenceDate = parseISO(`${offset === 0 ? today : initialDate}T00:00:00`);
    const nextMonth = offset === 0 ? referenceDate : offset > 0 ? addMonths(referenceDate, 1) : subMonths(referenceDate, 1);
    const nextDate = format(startOfMonth(nextMonth), 'yyyy-MM-dd');
    if (getNavigationHref) {
      router.push(getNavigationHref(nextDate, selectedSource?.key ?? null));
      return;
    }
    const params = new URLSearchParams({ date: nextDate });
    if (role === 'coach' && selectedAthleteId) params.set('athleteId', String(selectedAthleteId));
    if (role === 'athlete') params.set('place', selectedSource?.kind === 'template' ? 'template' : 'workout');
    if (role === 'athlete' && selectedSource) params.set('source', selectedSource.key);
    router.push(`${role === 'coach' ? '/coach/planner' : '/athlete/calendar'}?${params.toString()}`);
  }

  function assignSource() {
    if (mutationInFlight.current) return;
    if (!selectedSource || !selectedDates.length) {
      setMessageTone('danger');
      setMessage('Choose a workout or plan and at least one date.');
      return;
    }
    if (role === 'coach' && !selectedAthleteId) {
      setMessageTone('danger');
      setMessage('Choose an athlete first.');
      return;
    }
    if (!templateRangeValid) {
      setMessageTone('danger');
      setMessage(templateRangeError ?? `Select exactly ${selectedTemplateDays} days for this template.`);
      return;
    }
    if (!plannedTime.ok) {
      setMessageTone('danger');
      setMessage(plannedTime.error);
      return;
    }
    const timeLabel = plannedTime.timeLabel;

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
          timeLabel,
        });
        if (role === 'athlete' && placementRequest.current?.signature !== signature) {
          placementRequest.current = { signature, requestKey: crypto.randomUUID() };
        }
        const body = role === 'athlete'
          ? {
              sourceKind: selectedSource.kind,
              sourceId: selectedSource.id,
              dates: selectedDates,
              timeLabel,
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
          setMessage(payload.error ?? 'Could not add this to the athlete’s calendar.');
          setPlacement({ ...feedback, state: 'failed' });
          return;
        }
        setMessageTone('success');
        if (role === 'athlete') placementRequest.current = null;
        setPlacement({ ...feedback, state: 'saved' });
        const placedCount = payload.sessionIds?.length ?? selectedDates.length;
        // Clear the selection so the assign button cannot place the same dates twice.
        setSelectedDates([]);
        setMessage(`${selectedSource.title} assigned to ${placedCount} day${placedCount === 1 ? '' : 's'}. Review them in Calendar.`);
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not confirm that this was added. Check your connection and try again.');
        setPlacement({ ...feedback, state: 'failed' });
      } finally { mutationInFlight.current = false; setPendingAction(null); }
    });
  }

  function removeSession(session: PlannerDeskSession) {
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
          setMessage(payload.error ?? 'Could not remove this workout.');
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
          description="The planner puts your workouts and training plans on an athlete’s calendar. Add an athlete to your roster first."
          action={<ActionLink href="/coach" tone="secondary" size="compact">Open athletes</ActionLink>}
        />
      </Surface>
    );
  }

  return (
    <div className="space-y-4">
      <AssignmentSummary
        role={role}
        source={selectedSource}
        selectedDates={selectedDates}
        selectedTemplateDays={selectedTemplateDays}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        valid={templateRangeValid}
        isPending={isPending}
        isAssigning={pendingAction === 'assign'}
        message={message}
        messageTone={messageTone}
        canAssign={canAssign}
        startTime={startTime}
        timeError={timeError}
        duplicateWarning={duplicateWarning}
        onStartTimeChange={setStartTime}
        onAssign={assignSource}
      />

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <div className="min-w-0 xl:row-span-2">
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
        </div>
        <div className="min-w-0">
        <MonthCalendar
          onSelectTemplateRange={selectTemplateRange}
          label={calendarLabel}
          initialDate={initialDate}
          today={today}
          days={scopedCalendarDays}
          placement={role === 'athlete' || placement?.athleteId === selectedAthleteId ? placement : null}
          selectedDates={selectedDates}
          selectedSource={selectedSource}
          onNavigate={navigateMonth}
          onSelectDate={selectDate}
        />
        </div>
        <div className="min-w-0">
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
    </div>
  );
}

function AssignmentSummary({ role, source, selectedDates, selectedTemplateDays, rangeStart, rangeEnd, valid, isPending, isAssigning, message, messageTone, canAssign, startTime, timeError, duplicateWarning, onStartTimeChange, onAssign }: { role: PlannerDeskRole; source: PlannerDeskSource | null; selectedDates: string[]; selectedTemplateDays: number | null; rangeStart: string | null; rangeEnd: string | null; valid: boolean; isPending: boolean; isAssigning: boolean; message: string; messageTone: 'success' | 'danger' | 'neutral'; canAssign: boolean; startTime: string; timeError: string | null; duplicateWarning: string | null; onStartTimeChange: (value: string) => void; onAssign: () => void }) {
  const selectedCount = selectedDates.length;
  const buttonLabel = !source
    ? 'Choose a workout or plan'
    : source.kind === 'training-plan'
      ? 'Assign training plan'
      : source.kind === 'template'
        ? `Assign ${selectedTemplateDays}-day template`
        : `Assign workout to ${selectedCount} day${selectedCount === 1 ? '' : 's'}`;
  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-inset)] sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text)]">{source ? source.title : 'Nothing selected yet'}{source ? <span className="font-normal text-[var(--text-secondary)]"> – {getSportLabel(source.sport)}&nbsp;– {sourceMeta(source, selectedDates[0])}</span> : null}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {source?.kind === 'template'
              ? `${selectedCount} of ${selectedTemplateDays} days selected${rangeStart ? ` – starts ${formatShortDate(rangeStart)}` : ''}${rangeEnd ? ` – ends ${formatShortDate(rangeEnd)}` : ''}`
              : `${selectedCount} ${selectedCount === 1 ? 'day' : 'days'} selected`}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <p className={`text-xs sm:max-w-[200px] ${source?.kind === 'template' && !valid ? 'text-[var(--status-warning)]' : 'text-[var(--text-muted)]'}`}>
            {source?.kind === 'template' ? (valid ? 'Range length matches the template.' : `Select exactly ${selectedTemplateDays} days.`) : 'Click dates to toggle the selection.'}
          </p>
          {role === 'athlete' ? (
            <details className="group min-w-0 sm:w-40">
              <summary className="min-h-10 cursor-pointer list-none rounded-lg py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
                <span aria-hidden="true" className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
                Advanced{startTime && !timeError ? `\u00A0– ${startTime}` : ''}
              </summary>
              <label className="block">
                <span className={formLabelClassName}>Start time</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={5}
                  placeholder="HH:mm"
                  value={startTime}
                  onChange={(event) => onStartTimeChange(event.target.value)}
                  aria-invalid={timeError ? true : undefined}
                  aria-describedby="planner-start-time-hint"
                  className={formFieldClassName}
                />
              </label>
              <p id="planner-start-time-hint" className={`mt-1 text-xs ${timeError ? 'text-[var(--status-danger)]' : 'text-[var(--text-muted)]'}`}>
                {timeError ?? 'Optional. Leave empty for no set time.'}
              </p>
            </details>
          ) : null}
          <div className="flex flex-col gap-2 sm:items-end">
            {duplicateWarning ? (
              <p className="inline-flex items-start gap-1.5 text-xs font-medium text-[var(--status-warning)]">
                <CircleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>{duplicateWarning}</span>
              </p>
            ) : null}
            <button type="button" disabled={isPending || !canAssign} onClick={onAssign} className={primaryButtonClassName}>
              <Check aria-hidden="true" className="mr-2 h-4 w-4" /> {isAssigning ? 'Placing...' : buttonLabel}
            </button>
          </div>
        </div>
      </div>
      {message ? <p role={messageTone === 'danger' ? 'alert' : 'status'} aria-live="polite" className={`mt-2 border-t border-[var(--border)] pt-2 ${messageTone === 'danger' ? dangerTextClassName : messageTone === 'success' ? successTextClassName : 'text-sm text-[var(--text-secondary)]'}`}>{message}</p> : null}
    </section>
  );
}

function SourceDock({ role, sources, selectedSource, sourceTab, query, visibleSources, selectedDate, athletes, selectedAthleteId, onAthleteChange, onQueryChange, onTabChange, onSelectSource }: { role: PlannerDeskRole; sources: PlannerDeskSource[]; selectedSource: PlannerDeskSource | null; sourceTab: SourceTab; query: string; visibleSources: PlannerDeskSource[]; selectedDate: string; athletes: PlannerDeskAthlete[]; selectedAthleteId: number | null; onAthleteChange: (athleteId: number) => void; onQueryChange: (query: string) => void; onTabChange: (tab: SourceTab) => void; onSelectSource: (source: PlannerDeskSource) => void }) {
  const tabs: SourceTab[] = role === 'coach' ? ['workout', 'template', 'training-plan'] : ['workout', 'template'];
  return (
    <aside className="min-w-0 border border-[var(--border)] bg-[var(--nav-surface)] p-3 shadow-[var(--shadow-inset)] xl:sticky xl:top-4 xl:self-start">
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
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Find a workout or plan</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--nav-muted)]">Search your workouts and plans, then choose dates.</p>
        </div>
        <Search aria-hidden="true" className="mt-1 h-5 w-5 text-[var(--color-liquid)]" />
      </div>
      <SearchField label="Search workouts and templates" labelClassName="mt-3" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search by name or sport" />
      <div role="tablist" aria-label="Show workouts or plans" className={`${switchTrackClassName} mt-3 max-w-full overflow-x-auto`}>
        {tabs.map((tab) => {
          const count = sources.filter((source) => source.kind === tab).length;
          return <button key={tab} type="button" role="tab" aria-selected={sourceTab === tab} onClick={() => onTabChange(tab)} className={`${getSwitchOptionClassName(sourceTab === tab)} shrink-0 gap-1 capitalize`}>{tab === 'training-plan' ? 'Plans' : `${tab}s`} <span className="font-normal">{count}</span></button>;
        })}
      </div>
      <div className="mt-3 space-y-2">
        {visibleSources.length ? visibleSources.map((source) => <SourceResult key={source.key} source={source} selected={source.key === selectedSource?.key} selectedDate={selectedDate} onSelect={onSelectSource} />) : <p className="border border-dashed border-[var(--nav-border)] px-3 py-4 text-sm text-[var(--nav-muted)]">No {sourceTab === 'training-plan' ? 'plans' : `${sourceTab}s`} match “{query}”.</p>}
      </div>
      <div className="mt-4 border-t border-[var(--nav-border)] pt-3 text-xs leading-5 text-[var(--nav-muted)]">
        <p>Each date gets its own copy. Editing the original later won’t change it.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <ActionLink href={role === 'coach' ? '/coach/workouts' : '/athlete/workouts'} tone="ghost" size="compact">Manage workouts</ActionLink>
          {role === 'athlete' ? <ActionLink href="/athlete/templates" tone="ghost" size="compact">Manage templates</ActionLink> : null}
        </div>
      </div>
    </aside>
  );
}

function SourceResult({ source, selected, selectedDate, onSelect }: { source: PlannerDeskSource; selected: boolean; selectedDate: string; onSelect: (source: PlannerDeskSource) => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={() => onSelect(source)} className={`flex w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${selected ? 'border-[var(--field-selected-border)] bg-[var(--surface)] shadow-[var(--shadow-inset)] hover:border-[var(--brand)]' : 'border-[var(--nav-border)] bg-[var(--field-surface)] hover:border-[var(--field-selected-border)] hover:bg-[var(--surface)]'}`}>
      <span className={`mt-1 h-8 w-1 shrink-0 rounded-full ${source.kind === 'template' ? 'bg-[var(--color-zone-4)]' : source.kind === 'training-plan' ? 'bg-[var(--color-zone-5)]' : 'bg-[var(--color-zone-2)]'}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2"><span className="truncate text-[13px] font-semibold text-[var(--text)]">{source.title}</span>{selected ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" /> : null}</span>
        <span className="mt-1 block text-xs text-[var(--text-secondary)]">{getSportLabel(source.sport)}&nbsp;– {sourceMeta(source, selectedDate)}</span>
        <span className="mt-2 block text-xs leading-5 text-[var(--text-muted)]">{source.summary ?? sourceDescription(source, selectedDate)}</span>
      </span>
    </button>
  );
}

function MonthCalendar({ onSelectTemplateRange, placement, label, initialDate, today, days, selectedDates, selectedSource, onNavigate, onSelectDate }: { onSelectTemplateRange: () => void; placement: PlacementFeedback | null; label: string; initialDate: string; today: string; days: PlannerDeskCalendarDay[]; selectedDates: string[]; selectedSource: PlannerDeskSource | null; onNavigate: (offset: number) => void; onSelectDate: (date: string) => void }) {
  const shortcutDates = selectedSource?.kind === 'template' ? templateDatesForSelection(selectedSource.cadence ?? 'day', selectedDates[0] ?? initialDate) : [];
  const rangeError = selectedSource?.kind === 'template' ? validateTemplateDateRange(selectedDates, selectedSource.cadence ?? 'day') : null;
  return (
    <section className="min-w-0 border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em]">{label}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{calendarInstruction(selectedSource)}</p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Month navigation">
          <button type="button" aria-label="Previous month" onClick={() => onNavigate(-1)} className={iconButtonClassName}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
          <button type="button" onClick={() => onNavigate(0)} className={ghostButtonClassName('compact')}>This month</button>
          <button type="button" aria-label="Next month" onClick={() => onNavigate(1)} className={iconButtonClassName}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
        </div>
      </div>
      {selectedSource?.kind === 'template' && selectedSource.cadence !== 'day' ? <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onSelectTemplateRange} className={primaryButtonClassName}>Select {selectedSource.cadence === 'week' ? `week of ${formatShortDate(shortcutDates[0])}` : format(parseISO(shortcutDates[0]), 'MMMM yyyy')}</button>
        <p className="text-sm text-[var(--text-secondary)]">{formatShortDate(shortcutDates[0])}–{formatShortDate(shortcutDates[shortcutDates.length - 1])}, {shortcutDates.length}&nbsp;days</p>
      </div> : null}
      {rangeError ? <p className="mt-2 text-sm text-[var(--status-warning)]">{rangeError}</p> : null}
      <div className="mt-3 pb-1">
        <div className="min-w-0">
          <div className="grid grid-cols-7 border-y border-[var(--border)] bg-[var(--sunken)]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border)] border-b border-[var(--border)]">
            {days.map((day) => <CalendarCell key={day.isoDate} feedback={placement?.dates.includes(day.isoDate) ? placement : null} day={day} today={day.isoDate === today} selected={selectedDates.includes(day.isoDate)} templateMode={selectedSource?.kind === 'template'} onSelect={() => onSelectDate(day.isoDate)} />)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--brand)]" /> Selected</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--status-success)]" /> Completed</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--status-warning)]" /> Adjusted</span>
        <span className="ml-auto inline-flex items-center gap-2"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" /> {selectedDates.length} selected</span>
      </div>
    </section>
  );
}

function CalendarCell({ feedback, day, today, selected, templateMode, onSelect }: { feedback: PlacementFeedback | null; day: PlannerDeskCalendarDay; today: boolean; selected: boolean; templateMode: boolean; onSelect: () => void }) {
  return (
    <button type="button" aria-pressed={selected} aria-current={today ? 'date' : undefined} aria-label={`${day.label} ${day.dateLabel}, ${day.sessions.length} assigned. ${templateMode ? 'Choose for template range.' : 'Toggle date.'}`} onClick={onSelect} className={`flex min-h-[104px] min-w-0 flex-col p-2 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)] ${day.inMonth ? 'bg-[var(--field-surface)]' : 'bg-[var(--sunken)]'} ${selected ? 'bg-[var(--brand-tint)]' : ''} hover:bg-[var(--selection)]`}>
      <span className="flex items-center justify-between gap-2"><span className={`metric-text text-sm font-semibold ${day.inMonth ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>{day.dateLabel.split(' ')[0]}</span>{today ? <Badge tone="brand">Today</Badge> : selected ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--signal-ink)]"><Check aria-hidden="true" className="h-3 w-3" /></span> : null}</span>
      {feedback ? <span className={`mt-2 block text-xs ${feedback.state === 'failed' ? 'text-[var(--status-danger)]' : feedback.state === 'saved' ? 'text-[var(--status-success)]' : 'text-[var(--text-secondary)]'}`}>{feedback.state === 'placing' ? 'Placing' : feedback.state === 'saved' ? 'Placed' : 'Not confirmed'}: {feedback.title}</span> : null}
      <span className="mt-2 min-w-0 space-y-1">{day.sessions.slice(0, 2).map((session) => <span key={session.id} className="block truncate border-l-2 border-[var(--brand)] bg-[var(--surface)] px-1.5 py-1 text-[11px] font-medium text-[var(--text)]">{session.title}</span>)}{day.sessions.length > 2 ? <span className="block px-1.5 text-[11px] text-[var(--text-muted)]">+{day.sessions.length - 2} more</span> : null}</span>
    </button>
  );
}

function SelectionPanel({ role, sessions, selectedDates, isPending, removingId, onSelectOnlyDate, onRemoveSession }: { role: PlannerDeskRole; sessions: PlannerDeskSession[]; selectedDates: string[]; isPending: boolean; removingId: number | null; onSelectOnlyDate: (date: string) => void; onRemoveSession: (session: PlannerDeskSession) => void }) {
  const multiple = selectedDates.length > 1;
  return (
    <section className="min-w-0 border border-[var(--field-selected-border)] bg-[var(--brand-tint)] p-4 shadow-[var(--shadow-inset)] xl:sticky xl:top-4 xl:self-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em]">{multiple ? 'Selected days' : 'Selected day'}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{multiple ? 'Click a day or workout to select only that day.' : 'Workouts on this day.'}</p>
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

function SelectedDaySessions({ role, date, sessions, isPending, removingId, onRemoveSession }: { role: PlannerDeskRole; date: string | undefined; sessions: PlannerDeskSession[]; isPending: boolean; removingId: number | null; onRemoveSession: (session: PlannerDeskSession) => void }) {
  if (!date) return <p className="text-sm text-[var(--text-secondary)]">Select a day to see its workouts.</p>;
  const daySessions = sessions.filter((session) => session.scheduledDate === date);
  if (!daySessions.length) return <p className="text-sm text-[var(--text-secondary)]">No workouts on this day.</p>;
  return <div className="space-y-2">{daySessions.map((session) => <SessionDetail key={session.id} role={role} session={session} isPending={isPending} removingId={removingId} onRemoveSession={onRemoveSession} />)}</div>;
}

function SessionDetail({ role, session, isPending, removingId, onRemoveSession }: { role: PlannerDeskRole; session: PlannerDeskSession; isPending: boolean; removingId: number | null; onRemoveSession: (session: PlannerDeskSession) => void }) {
  const sessionHref = role === 'athlete' ? `/athlete/session/${session.id}?from=calendar` : session.athleteId ? `/coach/athletes/${session.athleteId}?date=${session.scheduledDate}` : '/coach/planner';
  return (
    <div className="border border-[var(--field-selected-border)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={sessionHref} className="min-w-0 flex-1 hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><span className="flex items-center gap-2"><span className="truncate text-[13px] font-semibold text-[var(--text)]">{session.title}</span><ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" /></span><span className="mt-1 block text-[11px] text-[var(--text-secondary)]">{getSportLabel(session.sport)}&nbsp;– {formatDuration(session.durationSec)}&nbsp;– {session.tss === null ? 'No TSS' : `${session.tss}\u00A0TSS`}</span></Link>
        <button type="button" aria-label={`Remove ${session.title}`} disabled={isPending || session.status === 'completed'} title={session.status === 'completed' ? 'Workouts marked as done can’t be removed.' : undefined} onClick={() => onRemoveSession(session)} className={`${dangerButtonClassName} min-h-8 px-2.5 py-1.5 text-xs`}>{removingId === session.id ? 'Removing...' : <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}</button>
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

function coachSource(source: PlannerDeskSource) {
  if (source.kind === 'template') return { kind: 'template' as const, templateId: source.id };
  if (source.kind === 'training-plan') return { kind: 'training-plan' as const, trainingPlanId: source.id };
  return { kind: 'library-session' as const, sessionId: source.id };
}

function sourceMeta(source: PlannerDeskSource, date: string) {
  if (source.kind === 'workout') return source.durationSec ? formatDuration(source.durationSec) : 'Workout';
  if (source.kind === 'training-plan') return `${source.sessionCount ?? 0} workouts`;
  return `${getTemplateDurationDays(source.cadence ?? 'day', date)} days`;
}

function sourceDescription(source: PlannerDeskSource, date: string) {
  if (source.kind === 'training-plan') return 'Starts on a Monday. The athlete gets their own copy of each workout.';
  if (source.kind === 'template') return `${templateCadenceMeta[source.cadence ?? 'day'].label}\u00A0– ${getTemplateDurationDays(source.cadence ?? 'day', date)} target day${getTemplateDurationDays(source.cadence ?? 'day', date) === 1 ? '' : 's'}.`;
  return 'Each date you choose gets its own copy of this workout.';
}

function calendarInstruction(source: PlannerDeskSource | null) {
  if (source?.kind === 'template') return source.cadence === 'day' ? 'Select the day for this single-day template.' : 'Review the highlighted range, or choose a new start and end date.';
  if (source?.kind === 'training-plan') return 'Choose the Monday the plan starts on.';
  return 'Select one or more dates for the saved workout.';
}

function datesBetween(start: string, end: string) {
  const first = start <= end ? start : end;
  const last = start <= end ? end : start;
  const dates: string[] = [];
  const cursor = parseISO(`${first}T00:00:00`);
  const endDate = parseISO(`${last}T00:00:00`);
  while (cursor <= endDate) {
    dates.push(format(cursor, 'yyyy-MM-dd'));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function formatShortDate(date: string) {
  return format(parseISO(`${date}T00:00:00`), 'd\u00A0MMM');
}

function formatCompactDate(date: string) {
  return format(parseISO(`${date}T00:00:00`), 'EEE\u00A0d\u00A0MMM');
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
