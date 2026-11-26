'use client';

import { useDeferredValue, useId, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { CatalogProfile } from '@/components/library/CatalogProfile';
import { filterChipClassName } from '@/components/library/CollectionFilters';
import { SearchField } from '@/components/tempobuilder/SearchField';
import { SportBadge, SportIcon } from '@/components/tempobuilder/SportBadge';
import {
  buttonFocusClassName,
  formSelectClassName,
  getSwitchOptionClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  switchTrackClassName,
} from '@/components/ui';
import { formatDuration } from '@/lib/format-duration';
import type { AddableWorkout } from '@/lib/placement-options';
import { CATALOG_CATEGORIES, matchesSearch, toWorkoutSport, WORKOUT_SPORTS, type WorkoutSport } from '@/lib/workout-catalog/query';

type Origin = AddableWorkout['origin'];
type SportFilter = WorkoutSport | 'ALL';

const ORIGINS: { id: Origin; label: string }[] = [
  { id: 'mine', label: 'My workouts' },
  { id: 'library', label: 'Public library' },
];

/**
 * Browser filters for `WorkoutBrowser`, kept by the caller so they survive
 * going to the next step and back. Opens on `initialOrigin`, else My workouts
 * when there are any, else the public library.
 */
export function useWorkoutBrowser(workouts: AddableWorkout[], initialOrigin?: Origin) {
  const hasMine = workouts.some((workout) => workout.origin === 'mine');
  const [origin, setOrigin] = useState<Origin>(initialOrigin ?? (hasMine ? 'mine' : 'library'));
  const [sport, setSport] = useState<SportFilter>('ALL');
  const [focus, setFocus] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  return { origin, setOrigin, sport, setSport, focus, setFocus, query, setQuery };
}

type BrowserState = ReturnType<typeof useWorkoutBrowser>;

/**
 * Every workout you can use, as one structured list: My workouts or the public
 * library, with search, sport chips and (for the library) focus. Rows show the
 * intensity shape, duration, sport, focus, TSS and IF.
 */
export function WorkoutBrowser({ workouts, state, notice = '', hint, onChoose }: {
  workouts: AddableWorkout[];
  state: BrowserState;
  notice?: string;
  /** Read after the result count, e.g. "Choose one to see it and pick the day." */
  hint: string;
  onChoose: (workout: AddableWorkout) => void;
}) {
  const { origin, sport, focus, query } = state;
  const onOriginChange = (next: Origin) => { state.setOrigin(next); state.setFocus(null); };
  const onSportChange = (next: SportFilter) => { state.setSport(next); state.setFocus(null); };
  const onFocusChange = state.setFocus;
  const onQueryChange = state.setQuery;
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
            {results.length === 1 ? '1 workout' : `${results.length} workouts`}. {hint}
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
export function WorkoutSummary({ workout, idPrefix }: { workout: AddableWorkout; idPrefix: string }) {
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
