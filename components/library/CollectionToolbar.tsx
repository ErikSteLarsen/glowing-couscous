'use client';

import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { SearchField } from '@/components/tempobuilder/SearchField';
import { ActiveFilterChips, FilterChipGroup, FiltersButton, FiltersDialog, SortSelect } from '@/components/library/CollectionFilters';
import { compactSecondaryButtonClassName, EmptyState, ghostButtonClassName } from '@/components/ui';
import {
  CATALOG_SORTS, catalogSportLabel, DURATION_BUCKETS, listCatalogFilters, switchCatalogSport, WORKOUT_SPORTS,
  type CatalogQuery, type CatalogSort, type DurationBucket, type WorkoutSport,
} from '@/lib/workout-catalog/query';

export type CollectionQueryUpdate = (patch: Partial<CatalogQuery>) => void;
/** Filters a tab's workouts can answer; chips for the others stay hidden there. */
export type CollectionFilterKind = 'category' | 'duration' | 'level' | 'tag' | 'tss' | 'if';

export const toggleValue = <T extends string>(values: readonly T[], value: T): T[] => values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

export function sportWorkoutsLabel(sport: WorkoutSport, count?: number) {
  return `${catalogSportLabel(sport)} ${count === 1 ? 'workout' : 'workouts'}`;
}


/** Search or a filter this tab supports is narrowing the list. */
export function collectionFilters(query: CatalogQuery, filters: readonly CollectionFilterKind[], onChange: CollectionQueryUpdate) {
  const chips = listCatalogFilters(query).filter((chip) => filters.includes(chip.key.split(':')[0] as CollectionFilterKind));
  const active = chips.map((chip) => ({ key: chip.key, label: chip.label, onRemove: () => onChange(chip.remove) }));
  // Clearing touches only what this tab shows, so the other tab's hidden filters survive.
  const clearFilters: Partial<CatalogQuery> = Object.assign({}, ...chips.map((chip) => chip.remove));
  return { active, filtered: Boolean(query.q.trim()) || active.length > 0, clearFilters, clearAll: { ...clearFilters, q: '' } };
}

/**
 * The one toolbar both Workouts tabs use: search, Filters (icon only on phones)
 * and the tab's action at the right end of the same row, active filter chips,
 * the Filters dialog (the tab's own groups, then Length and Sort) and the count row.
 */
export function CollectionControls({
  id, query, onChange, filters, searchLabel, resultCount, total, heading, nameSortLabel = 'Name', groups, action,
}: {
  id: string;
  query: CatalogQuery;
  onChange: CollectionQueryUpdate;
  filters: readonly CollectionFilterKind[];
  searchLabel: string;
  resultCount: number;
  total: number;
  /** Names the list for assistive tech, as the parent of group and card headings. */
  heading: string;
  nameSortLabel?: string;
  groups?: ReactNode;
  action?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { active, filtered, clearFilters, clearAll } = collectionFilters(query, filters, onChange);
  const sortLabel = (sort: CatalogSort) => sort === 'name' ? nameSortLabel : CATALOG_SORTS.find((entry) => entry.id === sort)?.label ?? sort;

  return (
    <>
      <div role="search" aria-label="Filter workouts" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SearchField value={query.q} onChange={(event) => onChange({ q: event.target.value })} label={searchLabel} placeholder="Search workouts" labelClassName="min-w-0 flex-1 sm:max-w-md" className="max-md:min-h-11" maxLength={80} autoComplete="off" />
          <FiltersButton activeCount={active.length} onOpen={() => dialog.current?.showModal()} />
          {action ? <div className="ml-auto flex shrink-0 items-center">{action}</div> : null}
        </div>
        <ActiveFilterChips chips={active} />
      </div>

      <FiltersDialog
        dialogRef={dialog}
        titleId={`${id}-filters-title`}
        resultCount={resultCount}
        clearDisabled={active.length === 0}
        onClear={() => onChange(clearFilters)}
      >
        {groups}
        <FilterChipGroup legend="Length" options={DURATION_BUCKETS} selected={query.durations} onToggle={(bucket) => onChange({ durations: toggleValue<DurationBucket>(query.durations, bucket) })} />
        <SortSelect value={query.sort} options={CATALOG_SORTS.map((sort) => ({ id: sort.id, label: sortLabel(sort.id) }))} onChange={(sort) => onChange({ sort })} />
      </FiltersDialog>

      <CollectionSummary heading={heading} action={filtered && resultCount > 0 ? (
        <button type="button" className={`${ghostButtonClassName('compact')} max-md:min-h-11`} onClick={() => onChange(active.length ? clearAll : { q: '' })}>
          <X aria-hidden="true" size={14} strokeWidth={1.7} />{active.length ? 'Clear search and filters' : 'Clear search'}
        </button>
      ) : null}>
        {resultCount === total ? `${total} ${total === 1 ? 'workout' : 'workouts'}` : `${resultCount} of ${total} workouts`}
        {query.sort === 'name' ? null : ` – ${sortLabel(query.sort)}`}
      </CollectionSummary>
    </>
  );
}

/**
 * Empty list for the chosen sport. With search or filters on it offers to clear them;
 * either way it offers the other sports that have matching workouts.
 */
export function CollectionEmpty({ query, onChange, filters, searchCounts, title, description, action }: {
  query: CatalogQuery;
  onChange: CollectionQueryUpdate;
  filters: readonly CollectionFilterKind[];
  searchCounts: Record<WorkoutSport, number>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { filtered, clearAll } = collectionFilters(query, filters, onChange);
  const otherSports = WORKOUT_SPORTS.filter(({ id }) => id !== query.sport && searchCounts[id] > 0);
  return (
    <EmptyState
      title={filtered ? 'No workouts match' : title}
      description={filtered ? 'Try a different search or adjust your filters.' : description}
      action={(
        <div className="flex flex-wrap justify-center gap-2">
          {filtered ? <button type="button" className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => onChange(clearAll)}>Clear search and filters</button> : null}
          {otherSports.map(({ id }) => (
            <button key={id} type="button" className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => onChange(switchCatalogSport(query, id))}>
              {`Show ${searchCounts[id]} ${sportWorkoutsLabel(id, searchCounts[id]).toLowerCase()}`}
            </button>
          ))}
          {action}
        </div>
      )}
    />
  );
}

/** Result count under the toolbar, with an optional reset action on the right. */
export function CollectionSummary({ heading, children, action }: { heading: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--border)] pb-3">
      <h2 className="sr-only">{heading}</h2>
      <p aria-live="polite" className="data text-[13px] text-[var(--text-muted)]">{children}</p>
      {action}
    </div>
  );
}
