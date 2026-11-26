'use client';

import { useDeferredValue, useId, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronRight, X } from 'lucide-react';

import { CatalogProfile } from '@/components/library/CatalogProfile';
import { filterChipClassName } from '@/components/library/CollectionFilters';
import { SearchField } from '@/components/tempobuilder/SearchField';
import { SportBadge, SportIcon } from '@/components/tempobuilder/SportBadge';
import {
  buttonFocusClassName,
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  getSwitchOptionClassName,
  ghostButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  switchTrackClassName,
} from '@/components/ui';
import { getCalendarHref, parseCalendarDay, type CalendarView } from '@/lib/calendar-navigation';
import {
  addPlacementDate,
  formatPlacementDate,
  getPlacementReturnHref,
  getWorkoutButtonLabel,
  removePlacementDate,
  splitSourceKey,
} from '@/lib/calendar-placement';
import { formatDuration } from '@/lib/format-duration';
import { parsePlannedTime } from '@/lib/planned-time';
import { fromDayKey } from '@/lib/training-load';
import { CATALOG_CATEGORIES, matchesSearch, toWorkoutSport, WORKOUT_SPORTS, type WorkoutSport } from '@/lib/workout-catalog/query';
import { AddDialogFrame, usePlacementRequest } from './AddDialogFrame';
import type { AddableWorkout } from './placement-options';

type Origin = AddableWorkout['origin'];
type SportFilter = WorkoutSport | 'ALL';

const ORIGINS: { id: Origin; label: string }[] = [
  { id: 'mine', label: 'My workouts' },
  { id: 'library', label: 'Public library' },
];

/**
 * Add workout: browse every workout you can place (your saved ones and the whole
 * public library), pick one, then confirm the day. Only the day is needed; start
 * time and extra days sit under More options.
 */
export function AddWorkoutDialog({
  view,
  day,
  workouts,
  initialKey,
  initialMessage,
  returnHref,
}: {
  view: CalendarView;
  /** The day the dialog was opened for. */
  day: string;
  workouts: AddableWorkout[];
  initialKey: string | null;
  initialMessage: string;
  /** Where Cancel goes when the dialog was opened from another page; Calendar otherwise. */
  returnHref: string | null;
}) {
  const router = useRouter();
  const ids = useId();
  const initial = workouts.find((workout) => workout.key === initialKey) ?? null;
  const mineCount = workouts.filter((workout) => workout.origin === 'mine').length;

  const [selectedKey, setSelectedKey] = useState<string | null>(initial?.key ?? null);
  const [origin, setOrigin] = useState<Origin>(initial?.origin ?? (mineCount ? 'mine' : 'library'));
  const [sport, setSport] = useState<SportFilter>('ALL');
  const [focus, setFocus] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [date, setDate] = useState(day);
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const { send, isPending, error, setError } = usePlacementRequest();
  const [notice, setNotice] = useState(initialMessage);

  const selected = workouts.find((workout) => workout.key === selectedKey) ?? null;
  // Replace, so Back after closing does not reopen the dialog.
  const close = () => router.replace(returnHref ?? getCalendarHref(view, day), { scroll: false });

  if (selected) {
    const dates = [...new Set([date, ...extraDates].filter((entry) => parseCalendarDay(entry)))].sort();
    const plannedTime = parsePlannedTime(startTime.trim());
    const canAdd = dates.length > 0 && plannedTime.ok && !isPending;

    function add() {
      if (!selected || !dates.length) return;
      if (!plannedTime.ok) { setError(plannedTime.error); return; }
      const [kind, id] = splitSourceKey(selected.key);
      const endpoint = kind === 'catalog' ? `/api/athlete/library/${encodeURIComponent(id)}/schedule` : '/api/athlete/planner/assignments';
      const body = kind === 'catalog'
        ? { dates, timeLabel: plannedTime.timeLabel }
        : { sourceKind: 'workout', sourceId: Number(id), dates, timeLabel: plannedTime.timeLabel };
      send(endpoint, body, (sessionIds) => router.push(getPlacementReturnHref(view, dates, sessionIds.length || dates.length), { scroll: false }));
    }

    return (
      <AddDialogFrame
        title="Add workout"
        steps={[{ label: 'Workout', state: 'done' }, { label: 'Day', state: 'current' }]}
        busy={isPending}
        onClose={close}
        footer={<>
          <button type="button" onClick={close} disabled={isPending} className={`${secondaryButtonClassName} max-md:min-h-11`}>Cancel</button>
          <button type="button" onClick={add} disabled={!canAdd} className={`${primaryButtonClassName} max-md:min-h-11`}>
            {isPending ? 'Adding…' : getWorkoutButtonLabel(dates)}
          </button>
        </>}
      >
        <div className="flex flex-col gap-5">
          <button type="button" onClick={() => { setSelectedKey(null); setError(''); }} disabled={isPending} className={`${ghostButtonClassName('compact')} -ml-2 self-start max-md:min-h-11`}>
            <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.8} />Choose another workout
          </button>

          <WorkoutSummary workout={selected} idPrefix={`${ids}-chosen`} />

          <section aria-labelledby={`${ids}-day`} className="flex flex-col gap-3">
            <h3 id={`${ids}-day`} className="text-sm font-medium text-[var(--text)]">Which day?</h3>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <label className="block w-full max-w-xs">
                <span className={formLabelClassName}>Day</span>
                <input type="date" required value={date} onChange={(event) => { setDate(event.target.value); setError(''); }} className={`${formFieldClassName} data max-md:min-h-11`} />
              </label>
              {parseCalendarDay(date) ? <p className="data pb-2.5 text-sm text-[var(--text-secondary)]">{format(fromDayKey(date), 'EEEE\u00A0d\u00A0MMMM')}</p> : null}
            </div>
            {!parseCalendarDay(date) && !extraDates.length ? <p className="text-[13px] text-[var(--text-muted)]">Choose a day to continue.</p> : null}
          </section>

          <details className="group rounded-xl border border-[var(--border)]">
            <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm hover:bg-[var(--raised)] [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-[var(--text)]">More options</span>
                <span className="text-[13px] text-[var(--text-muted)]">
                  {startTime || extraDates.length
                    ? [startTime ? `Starts ${startTime}` : null, extraDates.length ? `${extraDates.length} more ${extraDates.length === 1 ? 'day' : 'days'}` : null].filter(Boolean).join(', ')
                    : 'Optional: start time, more days'}
                </span>
              </span>
              <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-5 border-t border-[var(--border)] p-4">
              <label className="block max-w-xs">
                <span className={formLabelClassName}>Start time</span>
                <input type="time" value={startTime} onChange={(event) => { setStartTime(event.target.value); setError(''); }} className={`${formFieldClassName} data max-w-48 max-md:min-h-11`} />
                <span className="mt-1.5 block text-[13px] text-[var(--text-muted)]">Leave empty to plan it for the day.</span>
              </label>
              <div className="flex flex-col gap-2">
                <span className={formLabelClassName}>Also add on</span>
                {extraDates.length ? (
                  <ul className="flex flex-wrap gap-2" aria-label="More days">
                    {extraDates.map((entry) => (
                      <li key={entry} className="data inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--field-selected-border)] bg-[var(--brand-tint)] pl-3 pr-1 text-sm text-[var(--field-selected-text)]">
                        {formatPlacementDate(entry)}
                        <button type="button" aria-label={`Remove ${formatPlacementDate(entry)}`} onClick={() => setExtraDates((current) => removePlacementDate(current, entry))} className={`inline-flex size-8 items-center justify-center rounded-md hover:bg-[var(--raised)] max-md:size-11 ${buttonFocusClassName}`}>
                          <X aria-hidden="true" size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <label className="block max-w-xs">
                  <span className="sr-only">Add another day</span>
                  <input
                    type="date"
                    value=""
                    onChange={(event) => {
                      const picked = event.target.value;
                      // Adds as soon as a whole date is picked; the chip above confirms it.
                      if (parseCalendarDay(picked) && picked !== date) setExtraDates((current) => addPlacementDate(current, picked));
                    }}
                    className={`${formFieldClassName} data max-md:min-h-11`}
                  />
                  <span className="mt-1.5 block text-[13px] text-[var(--text-muted)]">Pick a day to add it. The button below counts every day.</span>
                </label>
              </div>
            </div>
          </details>

          <p className="text-[13px] text-[var(--text-muted)]">Each day gets its own copy, so you can change it there. The {selected.origin === 'library' ? 'library workout' : 'saved workout'} stays as it is.</p>
          <div role="alert" className="empty:hidden">{error ? <p className={dangerTextClassName}>{error}</p> : null}</div>
        </div>
      </AddDialogFrame>
    );
  }

  return (
    <AddDialogFrame
      title="Add workout"
      description={<>to <span className="data">{formatPlacementDate(day)}</span></>}
      steps={[{ label: 'Workout', state: 'current' }, { label: 'Day', state: 'next' }]}
      busy={false}
      onClose={close}
      footer={<button type="button" onClick={close} className={`${secondaryButtonClassName} max-md:min-h-11`}>Cancel</button>}
    >
      <WorkoutBrowser
        workouts={workouts}
        origin={origin}
        onOriginChange={(next) => { setOrigin(next); setFocus(null); setNotice(''); }}
        sport={sport}
        onSportChange={(next) => { setSport(next); setFocus(null); }}
        focus={focus}
        onFocusChange={setFocus}
        query={query}
        onQueryChange={setQuery}
        notice={notice}
        onChoose={(workout) => { setSelectedKey(workout.key); setNotice(''); }}
      />
    </AddDialogFrame>
  );
}

function WorkoutBrowser({
  workouts, origin, onOriginChange, sport, onSportChange, focus, onFocusChange, query, onQueryChange, notice, onChoose,
}: {
  workouts: AddableWorkout[];
  origin: Origin;
  onOriginChange: (origin: Origin) => void;
  sport: SportFilter;
  onSportChange: (sport: SportFilter) => void;
  focus: string | null;
  onFocusChange: (focus: string | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  notice: string;
  onChoose: (workout: AddableWorkout) => void;
}) {
  const ids = useId();
  const deferredQuery = useDeferredValue(query.trim());
  const inOrigin = useMemo(() => workouts.filter((workout) => workout.origin === origin), [workouts, origin]);
  const counts = (list: AddableWorkout[]) => {
    const result: Record<SportFilter, number> = { ALL: list.length, BIKING: 0, RUNNING: 0, SWIMMING: 0, OTHER: 0 };
    for (const workout of list) result[toWorkoutSport(workout.sport)] += 1;
    return result;
  };
  const sportCounts = counts(inOrigin);
  const sports: SportFilter[] = ['ALL', ...WORKOUT_SPORTS.map(({ id }) => id).filter((id) => sportCounts[id] > 0)];
  const activeSport = sports.includes(sport) ? sport : 'ALL';

  const inSport = inOrigin.filter((workout) => activeSport === 'ALL' || toWorkoutSport(workout.sport) === activeSport);
  const searched = deferredQuery
    ? inSport.filter((workout) => matchesSearch([workout.title, workout.summary ?? '', workout.focus ?? '', workout.level ?? ''], deferredQuery))
    : inSport;
  const focusOptions = origin === 'library'
    ? CATALOG_CATEGORIES.map((category) => ({ ...category, count: searched.filter((workout) => workout.focusId === category.id).length })).filter((category) => category.count > 0)
    : [];
  const activeFocus = focusOptions.some((option) => option.id === focus) ? focus : null;
  const results = activeFocus ? searched.filter((workout) => workout.focusId === activeFocus) : searched;
  const groups = origin === 'library' && !activeFocus
    ? focusOptions.map((option) => ({ id: option.id, label: option.label, workouts: results.filter((workout) => workout.focusId === option.id) })).filter((group) => group.workouts.length)
    : [{ id: 'all', label: '', workouts: results }];

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Show workouts from" className={`${switchTrackClassName} self-start`}>
        {ORIGINS.map((option) => {
          const count = workouts.filter((workout) => workout.origin === option.id).length;
          return (
            <button key={option.id} type="button" aria-pressed={origin === option.id} onClick={() => onOriginChange(option.id)} className={`${getSwitchOptionClassName(origin === option.id)} gap-1.5 max-md:min-h-11`}>
              {option.label}<span className="data text-[12px] text-[var(--text-muted)]">{count}</span>
            </button>
          );
        })}
      </div>

      {notice ? <p className="text-[13px] text-[var(--status-warning)]">{notice}</p> : null}

      {origin === 'mine' && inOrigin.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-[var(--border)] p-5">
          <p className="text-sm font-medium text-[var(--text)]">You have no saved workouts yet</p>
          <p className="text-[13px] text-[var(--text-secondary)]">Pick a ready-made one from the public library, or build your own in Workouts and come back.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onOriginChange('library')} className={`${primaryButtonClassName} max-md:min-h-11`}>Browse the public library</button>
            <Link href="/athlete/workouts" className={`${secondaryButtonClassName} max-md:min-h-11`}>Build a workout</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchField
              label={origin === 'library' ? 'Search the public library' : 'Search my workouts'}
              placeholder={origin === 'library' ? 'Search by name, focus or level' : 'Search my workouts'}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              labelClassName="min-w-0 flex-1"
              className="max-md:min-h-11"
            />
            {focusOptions.length > 1 ? (
              <label className="block sm:w-48">
                <span className="sr-only">Focus</span>
                <select value={activeFocus ?? ''} onChange={(event) => onFocusChange(event.target.value || null)} className={`${formSelectClassName} max-md:min-h-11`}>
                  <option value="">Any focus</option>
                  {focusOptions.map((option) => <option key={option.id} value={option.id}>{option.label} ({option.count})</option>)}
                </select>
              </label>
            ) : null}
          </div>
          <ChipRow label="Sport">
            {sports.map((id) => (
              <button key={id} type="button" aria-pressed={activeSport === id} onClick={() => onSportChange(id)} className={filterChipClassName(activeSport === id)}>
                {id === 'ALL' ? null : <SportIcon sport={id === 'OTHER' ? 'STRENGTH' : id} size={14} />}
                {id === 'ALL' ? 'All sports' : WORKOUT_SPORTS.find((entry) => entry.id === id)?.label}
                <span className="data text-[12px] text-[var(--text-muted)]">{sportCounts[id]}</span>
              </button>
            ))}
          </ChipRow>

          <p aria-live="polite" className="data text-[13px] text-[var(--text-muted)]">
            {results.length === 1 ? '1 workout' : `${results.length} workouts`}. Choose one to see it and pick the day.
          </p>

          {results.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-[var(--border)] p-5">
              <p className="text-sm text-[var(--text-secondary)]">No workouts match{query.trim() ? ` “${query.trim()}”` : ''}.</p>
              <button type="button" onClick={() => { onQueryChange(''); onSportChange('ALL'); onFocusChange(null); }} className={`${secondaryButtonClassName} max-md:min-h-11`}>Show all</button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <section key={group.id} aria-labelledby={group.label ? `${ids}-${group.id}` : undefined} className="flex flex-col gap-2">
                  {group.label ? (
                    <h3 id={`${ids}-${group.id}`} className="flex items-baseline gap-2 text-[13px] font-medium text-[var(--text-secondary)]">
                      {group.label}<span className="data font-normal text-[var(--text-muted)]">{group.workouts.length}</span>
                    </h3>
                  ) : null}
                  <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
                    {group.workouts.map((workout) => (
                      <li key={workout.key}>
                        <WorkoutOption workout={workout} idPrefix={`${ids}-${group.id}`} onChoose={() => onChoose(workout)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {children}
    </div>
  );
}

function metricsLine(workout: AddableWorkout) {
  return [
    workout.tss === null ? null : `${workout.tss} TSS`,
    workout.intensityFactor === null ? null : `IF ${workout.intensityFactor.toFixed(2)}`,
  ].filter(Boolean).join(' · ');
}

function WorkoutOption({ workout, idPrefix, onChoose }: { workout: AddableWorkout; idPrefix: string; onChoose: () => void }) {
  const metrics = metricsLine(workout);
  return (
    <button
      type="button"
      onClick={onChoose}
      className={`group grid w-full grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--raised)] sm:grid-cols-[7rem_minmax(0,1fr)_auto] ${buttonFocusClassName} focus-visible:ring-inset focus-visible:ring-offset-0`}
    >
      {workout.profile.length ? (
        <span aria-hidden="true" className="block"><CatalogProfile steps={workout.profile} idPrefix={`${idPrefix}-${workout.key}`} label="" className="h-9 rounded-sm" /></span>
      ) : <span aria-hidden="true" className="h-9 rounded-sm border-b border-dashed border-[var(--border)]" />}
      <span className="min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-[var(--text)]">{workout.title}</span>
          <span className="data shrink-0 text-[13px] text-[var(--text-secondary)]">{formatDuration(workout.durationSec)}</span>
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-x-2 overflow-hidden whitespace-nowrap text-[12px] text-[var(--text-muted)]">
          <SportBadge sport={workout.sport} />
          {workout.focus ? <span className="truncate">{workout.focus}</span> : null}
          {metrics ? <span className="data truncate max-sm:hidden">{metrics}</span> : null}
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text)]" />
    </button>
  );
}

/** The chosen workout: what kind of session it is, how long and hard, and its shape. */
function WorkoutSummary({ workout, idPrefix }: { workout: AddableWorkout; idPrefix: string }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--field-selected-border)] bg-[var(--brand-tint)] p-4">
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
          <SportBadge sport={workout.sport} />
          {workout.focus ? <span>{workout.focus}</span> : null}
          {workout.level ? <span>{workout.level}</span> : null}
          <span>{workout.origin === 'library' ? 'Public library' : 'My workouts'}</span>
        </p>
        <h3 className="text-base font-medium text-[var(--text)] [overflow-wrap:anywhere]">{workout.title}</h3>
      </div>
      {workout.profile.length ? (
        <CatalogProfile steps={workout.profile} idPrefix={idPrefix} label={`${workout.title} intensity profile, ${formatDuration(workout.durationSec)}`} className="h-20 rounded-md" />
      ) : null}
      <dl className="data flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[var(--text-muted)]">
        <div className="flex gap-1.5"><dt>Duration</dt><dd className="text-[var(--text)]">{formatDuration(workout.durationSec)}</dd></div>
        {workout.tss === null ? null : <div className="flex gap-1.5"><dt>TSS</dt><dd className="text-[var(--text)]">{workout.tss}</dd></div>}
        {workout.intensityFactor === null ? null : <div className="flex gap-1.5"><dt>IF</dt><dd className="text-[var(--text)]">{workout.intensityFactor.toFixed(2)}</dd></div>}
      </dl>
      {workout.summary ? <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">{workout.summary}</p> : null}
    </article>
  );
}
