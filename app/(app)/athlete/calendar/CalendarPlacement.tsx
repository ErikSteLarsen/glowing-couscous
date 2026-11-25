'use client';

import { SearchField } from '@/components/tempo/SearchField';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition } from 'react';
import { Check, ChevronDown, CircleAlert, Plus, X } from 'lucide-react';

import {
  dangerTextClassName,
  EmptyState,
  compactSecondaryButtonClassName,
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  getSegmentedChoiceClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  sectionHeadingClassName,
  TopBar,
  buttonFocusClassName,
} from '@/components/ui';
import type { BackTarget } from '@/lib/app-navigation';
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
import { formatDuration, formatDurationExact } from '@/lib/format-duration';
import { parsePlannedTime } from '@/lib/planned-time';
import { getSportLabel } from '@/lib/sport';
import { selectPlanWorkouts, type BuiltInPlanPreview } from '@/lib/plan-catalog/selection';
import { routineWeekday, ROUTINE_DAYS } from '@/lib/template-routine';

export type PlacementWorkout = { id: number; title: string; sport: string; summary: string | null; durationSec: number };
export type PlacementRoutine = {
  id: number;
  name: string;
  summary: string | null;
  defaultPeriod: RoutinePeriod;
  entries: Array<{ weekday: number; title: string; sport: string }>;
};

/** A built-in Library workout placed as dated copies through the catalog schedule route. */
export type PlacementCatalogSource = { slug: string; title: string; durationSec: number; back: BackTarget };

type Item = { key: string; id?: number; title: string; detail: string };

const CATALOG_KEY = 'catalog';

/**
 * Athlete placement: pick one saved workout or routine, pick when, confirm.
 * Placement goes through /api/athlete/planner/assignments with a stable retry key.
 * With `catalog`, the built-in workout is fixed and copies go through the Library
 * schedule route, which keeps catalog ownership and the same retry key contract.
 */
export function CalendarPlacement({
  view,
  placement,
  workouts,
  routines,
  builtInPlans = [],
  existing,
  initialDate,
  initialSourceKey,
  initialMessage,
  catalog,
}: {
  view: CalendarView;
  placement: PlacementKind;
  /** Most recently changed first. */
  workouts: PlacementWorkout[];
  routines: PlacementRoutine[];
  builtInPlans?: BuiltInPlanPreview[];
  /** Sessions already planned, for the repeated-placement warning. */
  existing: ExistingSessionsByDate;
  initialDate: string;
  initialSourceKey: string;
  initialMessage: string;
  catalog?: PlacementCatalogSource;
}) {
  const router = useRouter();
  const ids = useId();
  const [isPending, startTransition] = useTransition();
  const calendarHref = getCalendarHref(view, initialDate);
  const isRoutine = placement === 'template';

  const items: Item[] = catalog
    ? [{ key: CATALOG_KEY, id: 0, title: catalog.title, detail: [getSportLabel('BIKING'), formatDuration(catalog.durationSec)].join('\u00A0– ') }]
    : isRoutine
    ? [...routines.map((routine) => ({
        key: `template:${routine.id}`,
        id: routine.id,
        title: routine.name,
        detail: `${routine.entries.length} workout${routine.entries.length === 1 ? '' : 's'} a week`,
      })), ...builtInPlans.map((plan) => ({
        key: `built-in-plan:${plan.slug}`,
        title: plan.name,
        detail: 'Built-in plan / 1 week',
      }))]
    : workouts.map((workout) => ({
        key: `workout:${workout.id}`,
        id: workout.id,
        title: workout.title,
        detail: [getSportLabel(workout.sport), workout.durationSec > 0 ? formatDuration(workout.durationSec) : null].filter(Boolean).join('\u00A0– '),
      }));

  const [selectedKey, setSelectedKey] = useState(catalog ? CATALOG_KEY : items.some((item) => item.key === initialSourceKey) ? initialSourceKey : '');
  const [picking, setPicking] = useState(!selectedKey);
  const [query, setQuery] = useState('');
  const [dates, setDates] = useState([initialDate]);
  const [extraDate, setExtraDate] = useState('');
  const [showMoreDates, setShowMoreDates] = useState(false);
  const routineForKey = (key: string) => routines.find((routine) => `template:${routine.id}` === key) ?? null;
  const [personalPeriod, setPeriod] = useState<RoutinePeriod>(routineForKey(selectedKey)?.defaultPeriod ?? 'week');
  const [planChoices, setPlanChoices] = useState<Record<string, string>>({});
  const [routineDate, setRoutineDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('');
  const [error, setError] = useState(initialMessage);
  const inFlight = useRef(false);
  const request = useRef<{ signature: string; requestKey: string } | null>(null);

  const selected = items.find((item) => item.key === selectedKey) ?? null;
  const selectedWorkout = catalog
    ? { title: catalog.title, sport: 'BIKING' }
    : isRoutine ? null : workouts.find((workout) => `workout:${workout.id}` === selectedKey) ?? null;
  const selectedRoutine = isRoutine ? routineForKey(selectedKey) : null;
  const builtInPlan = builtInPlans.find((plan) => `built-in-plan:${plan.slug}` === selectedKey);
  const period = builtInPlan ? 'week' : personalPeriod;
  const builtInWorkouts = builtInPlan ? selectPlanWorkouts(builtInPlan.slots, planChoices) : [];
  const builtInDuration = builtInWorkouts.reduce((total, { option }) => total + option.durationSec, 0);

  const needle = query.trim().toLowerCase();
  const visibleItems = needle ? items.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(needle)) : items;

  const targetDates = isRoutine ? getRoutineDates(period, routineDate) : dates;
  const routinePlacements = builtInPlan
    ? targetDates.length ? builtInWorkouts.map(({ weekday, option }) => ({ date: targetDates[weekday], ...option })) : []
    : selectedRoutine
    ? targetDates.flatMap((date) => selectedRoutine.entries
        .filter((entry) => entry.weekday === routineWeekday(date))
        .map((entry) => ({ date, title: entry.title, sport: entry.sport })))
    : [];
  const placements = selectedWorkout
    ? targetDates.map((date) => ({ date, title: selectedWorkout.title, sport: selectedWorkout.sport }))
    : routinePlacements;
  const repeatedDates = findRepeatedPlacementDates(placements, existing);
  const plannedTime = builtInPlan ? parsePlannedTime('') : parsePlannedTime(startTime.trim());
  const canPlace = Boolean(selected) && targetDates.length > 0 && plannedTime.ok && !isPending;

  function choose(item: Item) {
    setSelectedKey(item.key);
    setPicking(false);
    setQuery('');
    setError('');
    if (item.key !== selectedKey) setPlanChoices({});
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
    const body = catalog
      ? { dates: targetDates, timeLabel: plannedTime.timeLabel }
      : builtInPlan
      ? { sourceKind: 'built-in-plan', sourceId: builtInPlan.slug, version: builtInPlan.version, choices: planChoices, dates: targetDates }
      : { sourceKind: placement, sourceId: selected.id, dates: targetDates, timeLabel: plannedTime.timeLabel };
    const endpoint = catalog ? `/api/athlete/library/${encodeURIComponent(catalog.slug)}/schedule` : '/api/athlete/planner/assignments';
    const signature = JSON.stringify(body);
    // Retries of the same placement reuse one key, so the server never places it twice.
    if (request.current?.signature !== signature) request.current = { signature, requestKey: crypto.randomUUID() };
    const requestKey = request.current.requestKey;
    inFlight.current = true;
    setError('');
    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, requestKey }),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string; sessionIds?: number[] };
        if (!response.ok) {
          setError(payload.error ?? 'Could not add this to your Calendar.');
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

  const noun = isRoutine ? 'training plan' : 'workout';
  const title = catalog ? 'Schedule workout' : isRoutine ? 'Apply a training plan' : 'Add workout';
  const back = catalog?.back ?? { href: calendarHref, destination: 'Calendar', label: 'Back to Calendar' };

  if (!items.length) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <TopBar back={back} title={title} />
        <EmptyState
          title={isRoutine ? 'No training plans yet' : 'No saved workouts yet'}
          description={isRoutine ? 'Build a weekly training plan from your saved workouts, then apply it here.' : 'Save a workout first, then add it to any day.'}
          action={
            <Link href={isRoutine ? '/athlete/templates' : '/athlete/workouts'} className={`${compactSecondaryButtonClassName} max-md:min-h-11`}>
              {isRoutine ? 'Open training plans' : 'Open Workouts'}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <TopBar back={back} title={title} />

      <section aria-labelledby={`${ids}-what`} className="flex flex-col gap-3">
        <h2 id={`${ids}-what`} className={sectionHeadingClassName}>{isRoutine ? 'Training plan' : 'Workout'}</h2>
        {selected && !picking ? (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--field-selected-border)] bg-[var(--brand-tint)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text)] [overflow-wrap:anywhere]">{selected.title}</p>
              <p className="data truncate text-[13px] text-[var(--text-secondary)]">{selected.detail}</p>
            </div>
            {catalog ? null : <button type="button" onClick={() => setPicking(true)} className={`${secondaryButtonClassName} max-md:min-h-11`}>Change</button>}
          </div>
        ) : (
          <>
            {items.length > 5 ? (
              <SearchField label={`Search ${noun}s`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${noun}s`} className="max-md:min-h-11" />
            ) : null}
            <ul className="flex flex-col divide-y divide-[var(--border)] max-h-[280px] overflow-y-auto rounded-xl border border-[var(--border)]" aria-label={`Available ${noun}s`}>
              {visibleItems.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-pressed={item.key === selectedKey}
                    onClick={() => choose(item)}
                    className={`flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--raised)] ${buttonFocusClassName} focus-visible:ring-inset focus-visible:ring-offset-0`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--text)] [overflow-wrap:anywhere]">{item.title}</span>
                      <span className="data block truncate text-[13px] text-[var(--text-muted)]">{item.detail}</span>
                    </span>
                    {item.key === selectedKey ? <Check aria-hidden="true" size={16} className="text-[var(--brand)]" /> : null}
                  </button>
                </li>
              ))}
              {!visibleItems.length ? <li className="px-4 py-3 text-sm text-[var(--text-muted)] [overflow-wrap:anywhere]">No {noun}s match “{query.trim()}”.</li> : null}
            </ul>
          </>
        )}
      </section>

      {builtInPlan && !picking ? (
        <details className="group rounded-xl border border-[var(--border)]">
          <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm hover:bg-[var(--raised)] ${buttonFocusClassName}`}>
            <span>Workout options</span>
            <span className="flex items-center gap-1 text-[13px] text-[var(--text-secondary)]">
              <span className="data">{formatDurationExact(builtInDuration)}</span>
              <ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="space-y-3 px-4 pb-4 pt-1">
            {builtInPlan.slots.filter((slot) => slot.options.length > 1).map((slot) => (
              <label key={slot.id} className="block space-y-1">
                <span className={formLabelClassName}>{ROUTINE_DAYS[slot.weekday]} / {slot.label}</span>
                <select
                  className={`${formSelectClassName} max-md:min-h-11`}
                  value={planChoices[slot.id] ?? slot.options[0].id}
                  onChange={(event) => {
                    setPlanChoices({ ...planChoices, [slot.id]: event.target.value });
                    setError('');
                  }}
                >
                  {slot.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}{option.durationSec ? ` / ${formatDurationExact(option.durationSec)}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
      ) : null}

      <section aria-labelledby={`${ids}-when`} className="flex flex-col gap-3">
        <h2 id={`${ids}-when`} className={sectionHeadingClassName}>When</h2>
        {isRoutine ? (
          <>
            {!builtInPlan ? <div className="flex gap-2" role="group" aria-label="Apply for">
              {(['week', 'month'] as const).map((option) => (
                <button key={option} type="button" aria-pressed={period === option} onClick={() => setPeriod(option)} className={`${getSegmentedChoiceClassName(period === option)} max-md:min-h-11`}>
                  {option === 'week' ? 'One week' : 'Whole month'}
                </button>
              ))}
            </div> : null}
            <label className="block">
              <span className={formLabelClassName}>{period === 'week' ? 'Any day in the week' : 'Any day in the month'}</span>
              <input type="date" required value={routineDate} onChange={(event) => setRoutineDate(event.target.value || routineDate)} className={`${formFieldClassName} max-md:min-h-11`} />
            </label>
            {targetDates.length ? (
              <details className="group rounded-xl border border-[var(--border)]">
                <summary className={`flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm hover:bg-[var(--raised)] max-md:min-h-11 ${buttonFocusClassName}`}>
                  <span className="data text-[var(--text)]">{getRoutineRangeLabel(targetDates)}</span>
                  <span className="flex items-center gap-1 text-[13px] text-[var(--text-secondary)]">
                    {(selectedRoutine || builtInPlan) ? `${routinePlacements.length} workout${routinePlacements.length === 1 ? '' : 's'}` : null}
                    <ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                {selectedRoutine || builtInPlan ? (
                  <ul className="data mt-2 flex flex-col gap-1 px-4 text-[13px] text-[var(--text-secondary)]">
                    {routinePlacements.map((entry, index) => (
                      <li key={`${entry.date}:${index}`} className="flex gap-3"><span className="w-24 shrink-0 text-[var(--text-muted)]">{formatPlacementDate(entry.date)}</span><span className="min-w-0 break-words">{entry.title}</span></li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 px-4 pb-3 text-[13px] text-[var(--text-muted)]">Workouts already on your Calendar stay. Days without a workout stay empty. Each workout is added as its own copy.</p>
              </details>
            ) : null}
          </>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2" aria-label="Selected dates">
              {dates.map((date) => (
                <li key={date} className="data inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--field-selected-border)] bg-[var(--brand-tint)] pl-3 pr-1 text-sm text-[var(--field-selected-text)]">
                  {formatPlacementDate(date)}
                  <button type="button" aria-label={`Remove ${formatPlacementDate(date)}`} onClick={() => setDates((current) => removePlacementDate(current, date))} className={`inline-flex size-8 items-center justify-center rounded-md hover:bg-[var(--raised)] max-md:size-11 ${buttonFocusClassName}`}>
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
                  <input type="date" value={extraDate} onChange={(event) => setExtraDate(event.target.value)} className={`${formFieldClassName} max-md:min-h-11`} />
                </label>
                <button type="button" onClick={addExtraDate} disabled={!extraDate} className={`${secondaryButtonClassName} max-md:min-h-11`}>Add</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowMoreDates(true)} className={`${secondaryButtonClassName} self-start max-md:min-h-11`}>
                <Plus aria-hidden="true" size={16} />Add more dates
              </button>
            )}
          </>
        )}
      </section>

      {!builtInPlan ? <details className="group">
        <summary className={`inline-flex min-h-10 cursor-pointer list-none items-center gap-1 max-md:min-h-11 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] ${buttonFocusClassName}`}>
          Advanced<ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180" />
        </summary>
        <label className="mt-2 block max-w-48">
          <span className={formLabelClassName}>Start time</span>
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={`${formFieldClassName} max-md:min-h-11`} />
        </label>
      </details> : null}

      <div className="flex flex-col gap-3">
        {repeatedDates.length ? (
          <p className="flex items-start gap-2 text-[13px] text-[var(--status-warning)]">
            <CircleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            {`Already planned on ${repeatedDates.map(formatPlacementDate).join(', ')}. Adding it again puts it there twice.`}
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
