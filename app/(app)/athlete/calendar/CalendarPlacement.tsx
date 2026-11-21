'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition } from 'react';
import { Check, ChevronDown, CircleAlert, Plus, Search, X } from 'lucide-react';

import {
  dangerTextClassName,
  EmptyState,
  ActionLink,
  formFieldClassName,
  formLabelClassName,
  getSegmentedChoiceClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  sectionHeadingClassName,
  TopBar,
  buttonFocusClassName,
} from '@/components/ui';
import { getCalendarHref, type CalendarView } from '@/lib/calendar-navigation';
import {
  addPlacementDate,
  findRepeatedPlacementDates,
  formatPlacementDate,
  getPlacementButtonLabel,
  getPlacementReturnHref,
  getRoutineDates,
  getRoutineRangeLabel,
  removePlacementDate,
  type ExistingSessionsByDate,
  type PlacementKind,
  type RoutinePeriod,
} from '@/lib/calendar-placement';
import { formatDuration } from '@/lib/format-duration';
import { parsePlannedTime } from '@/lib/planned-time';
import { getSportLabel } from '@/lib/sport';
import { routineWeekday } from '@/lib/template-routine';

export type PlacementWorkout = { id: number; title: string; sport: string; summary: string | null; durationSec: number };
export type PlacementRoutine = {
  id: number;
  name: string;
  summary: string | null;
  defaultPeriod: RoutinePeriod;
  entries: Array<{ weekday: number; title: string; sport: string }>;
};

type Item = { key: string; id: number; title: string; detail: string };

/**
 * Athlete placement: pick one saved workout or routine, pick when, confirm.
 * Placement goes through /api/athlete/planner/assignments with a stable retry key.
 */
export function CalendarPlacement({
  view,
  placement,
  workouts,
  routines,
  existing,
  initialDate,
  initialSourceKey,
  initialMessage,
}: {
  view: CalendarView;
  placement: PlacementKind;
  /** Most recently changed first. */
  workouts: PlacementWorkout[];
  routines: PlacementRoutine[];
  /** Sessions already planned, for the repeated-placement warning. */
  existing: ExistingSessionsByDate;
  initialDate: string;
  initialSourceKey: string;
  initialMessage: string;
}) {
  const router = useRouter();
  const ids = useId();
  const [isPending, startTransition] = useTransition();
  const calendarHref = getCalendarHref(view, initialDate);
  const isRoutine = placement === 'template';

  const items: Item[] = isRoutine
    ? routines.map((routine) => ({
        key: `template:${routine.id}`,
        id: routine.id,
        title: routine.name,
        detail: `${routine.entries.length} workout${routine.entries.length === 1 ? '' : 's'} a week`,
      }))
    : workouts.map((workout) => ({
        key: `workout:${workout.id}`,
        id: workout.id,
        title: workout.title,
        detail: [getSportLabel(workout.sport), workout.durationSec > 0 ? formatDuration(workout.durationSec) : null].filter(Boolean).join(' · '),
      }));

  const [selectedKey, setSelectedKey] = useState(items.some((item) => item.key === initialSourceKey) ? initialSourceKey : '');
  const [picking, setPicking] = useState(!selectedKey);
  const [query, setQuery] = useState('');
  const [dates, setDates] = useState([initialDate]);
  const [extraDate, setExtraDate] = useState('');
  const [showMoreDates, setShowMoreDates] = useState(false);
  const routineForKey = (key: string) => routines.find((routine) => `template:${routine.id}` === key) ?? null;
  const [period, setPeriod] = useState<RoutinePeriod>(routineForKey(selectedKey)?.defaultPeriod ?? 'week');
  const [routineDate, setRoutineDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('');
  const [error, setError] = useState(initialMessage);
  const inFlight = useRef(false);
  const request = useRef<{ signature: string; requestKey: string } | null>(null);

  const selected = items.find((item) => item.key === selectedKey) ?? null;
  const selectedWorkout = isRoutine ? null : workouts.find((workout) => `workout:${workout.id}` === selectedKey) ?? null;
  const selectedRoutine = isRoutine ? routineForKey(selectedKey) : null;

  const needle = query.trim().toLowerCase();
  const visibleItems = needle ? items.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(needle)) : items;

  const targetDates = isRoutine ? getRoutineDates(period, routineDate) : dates;
  const routinePlacements = selectedRoutine
    ? targetDates.flatMap((date) => selectedRoutine.entries
        .filter((entry) => entry.weekday === routineWeekday(date))
        .map((entry) => ({ date, title: entry.title, sport: entry.sport })))
    : [];
  const placements = selectedWorkout
    ? targetDates.map((date) => ({ date, title: selectedWorkout.title, sport: selectedWorkout.sport }))
    : routinePlacements;
  const repeatedDates = findRepeatedPlacementDates(placements, existing);
  const plannedTime = parsePlannedTime(startTime.trim());
  const canPlace = Boolean(selected) && targetDates.length > 0 && plannedTime.ok && !isPending;

  function choose(item: Item) {
    setSelectedKey(item.key);
    setPicking(false);
    setQuery('');
    setError('');
    const routine = routineForKey(item.key);
    if (routine) setPeriod(routine.defaultPeriod);
  }

  function addExtraDate() {
    setDates((current) => addPlacementDate(current, extraDate));
    setExtraDate('');
  }

  function place() {
    if (inFlight.current || !selected || !targetDates.length) return;
    if (!plannedTime.ok) { setError(plannedTime.error); return; }
    const body = { sourceKind: placement, sourceId: selected.id, dates: targetDates, timeLabel: plannedTime.timeLabel };
    const signature = JSON.stringify(body);
    // Retries of the same placement reuse one key, so the server never places it twice.
    if (request.current?.signature !== signature) request.current = { signature, requestKey: crypto.randomUUID() };
    const requestKey = request.current.requestKey;
    inFlight.current = true;
    setError('');
    startTransition(async () => {
      try {
        const response = await fetch('/api/athlete/planner/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, requestKey }),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string; sessionIds?: number[] };
        if (!response.ok) {
          setError(payload.error ?? 'Could not add this to your calendar.');
          return;
        }
        request.current = null;
        router.push(getPlacementReturnHref(view, targetDates, payload.sessionIds?.length ?? placements.length, isRoutine ? period : undefined));
      } catch {
        setError('Could not confirm this. Check your connection and try again.');
      } finally {
        inFlight.current = false;
      }
    });
  }

  const noun = isRoutine ? 'routine' : 'workout';
  const title = isRoutine ? 'Apply a routine' : 'Add workout';
  const back = { href: calendarHref, destination: 'Calendar', label: 'Back to Calendar' };

  if (!items.length) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <TopBar back={back} title={title} />
        <EmptyState
          title={isRoutine ? 'No routines yet' : 'No saved workouts yet'}
          description={isRoutine ? 'Build a weekly routine from your saved workouts, then apply it here.' : 'Save a workout first, then add it to any day.'}
          action={<ActionLink href={isRoutine ? '/athlete/templates' : '/athlete/workouts'} tone="secondary" size="compact">{isRoutine ? 'Open Templates' : 'Open Workouts'}</ActionLink>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <TopBar back={back} title={title} />

      <section aria-labelledby={`${ids}-what`} className="flex flex-col gap-3">
        <h2 id={`${ids}-what`} className={sectionHeadingClassName}>{isRoutine ? 'Routine' : 'Workout'}</h2>
        {selected && !picking ? (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--field-selected-border)] bg-[var(--brand-tint)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--text)]">{selected.title}</p>
              <p className="data truncate text-[13px] text-[var(--text-secondary)]">{selected.detail}</p>
            </div>
            <button type="button" onClick={() => setPicking(true)} className={`${secondaryButtonClassName} max-md:min-h-11`}>Change</button>
          </div>
        ) : (
          <>
            {items.length > 5 ? (
              <label className="relative block">
                <span className="sr-only">Search {noun}s</span>
                <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${noun}s`} className={`${formFieldClassName} pl-9`} />
              </label>
            ) : null}
            <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]" aria-label={`Saved ${noun}s`}>
              {visibleItems.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-pressed={item.key === selectedKey}
                    onClick={() => choose(item)}
                    className={`flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--raised)] ${buttonFocusClassName} focus-visible:ring-inset focus-visible:ring-offset-0`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text)]">{item.title}</span>
                      <span className="data block truncate text-[13px] text-[var(--text-muted)]">{item.detail}</span>
                    </span>
                    {item.key === selectedKey ? <Check aria-hidden="true" size={16} className="text-[var(--brand)]" /> : null}
                  </button>
                </li>
              ))}
              {!visibleItems.length ? <li className="px-4 py-3 text-sm text-[var(--text-muted)]">No {noun}s match “{query.trim()}”.</li> : null}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby={`${ids}-when`} className="flex flex-col gap-3">
        <h2 id={`${ids}-when`} className={sectionHeadingClassName}>When</h2>
        {isRoutine ? (
          <>
            <div className="flex gap-2" role="group" aria-label="Apply for">
              {(['week', 'month'] as const).map((option) => (
                <button key={option} type="button" aria-pressed={period === option} onClick={() => setPeriod(option)} className={getSegmentedChoiceClassName(period === option)}>
                  {option === 'week' ? 'One week' : 'Whole month'}
                </button>
              ))}
            </div>
            <label className="block">
              <span className={formLabelClassName}>{period === 'week' ? 'Any day in the week' : 'Any day in the month'}</span>
              <input type="date" required value={routineDate} onChange={(event) => setRoutineDate(event.target.value || routineDate)} className={formFieldClassName} />
            </label>
            {targetDates.length ? (
              <details className="group rounded-xl border border-[var(--border)] px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
                  <span className="data text-[var(--text)]">{getRoutineRangeLabel(targetDates)}</span>
                  <span className="flex items-center gap-1 text-[13px] text-[var(--text-secondary)]">
                    {selectedRoutine ? `${routinePlacements.length} workout${routinePlacements.length === 1 ? '' : 's'}` : null}
                    <ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                {selectedRoutine ? (
                  <ul className="data mt-3 flex flex-col gap-1 text-[13px] text-[var(--text-secondary)]">
                    {routinePlacements.map((entry, index) => (
                      <li key={`${entry.date}:${index}`} className="flex gap-3"><span className="w-24 shrink-0 text-[var(--text-muted)]">{formatPlacementDate(entry.date)}</span><span className="truncate">{entry.title}</span></li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 text-[13px] text-[var(--text-muted)]">Existing sessions stay. Days without a workout add nothing. Each session is an independent copy.</p>
              </details>
            ) : null}
          </>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2" aria-label="Selected dates">
              {dates.map((date) => (
                <li key={date} className="data inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--field-selected-border)] bg-[var(--brand-tint)] pl-3 pr-1 text-sm text-[var(--field-selected-text)]">
                  {formatPlacementDate(date)}
                  <button type="button" aria-label={`Remove ${formatPlacementDate(date)}`} onClick={() => setDates((current) => removePlacementDate(current, date))} className={`inline-flex size-8 items-center justify-center rounded-md hover:bg-[var(--raised)] ${buttonFocusClassName}`}>
                    <X aria-hidden="true" size={14} />
                  </button>
                </li>
              ))}
              {!dates.length ? <li className="text-sm text-[var(--text-muted)]">No date chosen.</li> : null}
            </ul>
            {showMoreDates || !dates.length ? (
              <div className="flex items-end gap-2">
                <label className="block min-w-0 flex-1">
                  <span className={formLabelClassName}>Add a date</span>
                  <input type="date" value={extraDate} onChange={(event) => setExtraDate(event.target.value)} className={formFieldClassName} />
                </label>
                <button type="button" onClick={addExtraDate} disabled={!extraDate} className={secondaryButtonClassName}>Add</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowMoreDates(true)} className={`${secondaryButtonClassName} self-start`}>
                <Plus aria-hidden="true" size={16} />Add more dates
              </button>
            )}
          </>
        )}
      </section>

      <details className="group">
        <summary className={`inline-flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] ${buttonFocusClassName}`}>
          Advanced<ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180" />
        </summary>
        <label className="mt-2 block max-w-48">
          <span className={formLabelClassName}>Start time</span>
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={formFieldClassName} />
        </label>
      </details>

      <div className="flex flex-col gap-3">
        {repeatedDates.length ? (
          <p className="flex items-start gap-2 text-[13px] text-[var(--status-warning)]">
            <CircleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            {`Already planned on ${repeatedDates.map(formatPlacementDate).join(', ')}. Adding it again creates a second session.`}
          </p>
        ) : null}
        <div role="alert" className="empty:hidden">{error ? <p className={dangerTextClassName}>{error}</p> : null}</div>
        <button type="button" onClick={place} disabled={!canPlace} className={`${primaryButtonClassName} w-full sm:w-auto sm:self-start max-md:min-h-11`}>
          {isPending ? 'Adding…' : selected ? getPlacementButtonLabel(placement, targetDates, period) : `Choose a ${noun}`}
        </button>
      </div>
    </div>
  );
}
