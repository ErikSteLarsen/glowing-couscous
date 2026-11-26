'use client';

import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Menu, MenuContent, MenuItemIndicator, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/wattonaut/Menu';
import { SearchField } from '@/components/wattonaut/SearchField';
import { ActiveFilterChips, FilterChipGroup, FiltersButton, FiltersDialog, SortSelect } from '@/components/library/CollectionFilters';
import { CollectionSummary, CollectionToolbar } from '@/components/library/CollectionToolbar';
import { LibraryCard } from '@/components/library/LibraryCard';
import { WorkoutCardGrid } from '@/components/library/WorkoutCard';
import { buttonFocusClassName, compactSecondaryButtonClassName, EmptyState, ghostButtonClassName, sectionHeadingClassName } from '@/components/ui';
import {
  CATALOG_CATEGORIES, CATALOG_LEVELS, CATALOG_SORTS, CATALOG_SPORTS, catalogSportLabel, countCatalogBySport, DURATION_BUCKETS, filterCatalog, isCatalogQueryFiltered, isCatalogSport, listCatalogFilters, serializeCatalogQuery, switchCatalogSport, withCatalogQuery,
  type CatalogEntry, type CatalogQuery, type CatalogSort, type DurationBucket,
} from '@/lib/workout-catalog/query';
import type { CatalogCategory, CatalogLevel, CatalogSport } from '@/lib/workout-catalog/types';

export function LibraryBrowser({
  entries,
  urlQuery,
}: {
  entries: CatalogEntry[];
  urlQuery: CatalogQuery;
}) {
  const urlFilters = serializeCatalogQuery(urlQuery);
  const [observedFilters, setObservedFilters] = useState(urlFilters);
  const [query, setQuery] = useState(urlQuery);
  if (urlFilters !== observedFilters) {
    setObservedFilters(urlFilters);
    if (urlFilters !== serializeCatalogQuery(query)) setQuery(urlQuery);
  }
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => filterCatalog(entries, deferredQuery), [entries, deferredQuery]);
  const sportTotals = useMemo(() => countCatalogBySport(entries), [entries]);
  const searchCounts = useMemo(() => countCatalogBySport(entries, deferredQuery.q), [entries, deferredQuery.q]);
  const total = sportTotals[deferredQuery.sport];
  const categoryCounts = useMemo(() => {
    const counts = new Map<CatalogCategory, number>();
    for (const entry of filterCatalog(entries, { ...deferredQuery, categories: [] })) counts.set(entry.workout.category, (counts.get(entry.workout.category) ?? 0) + 1);
    return counts;
  }, [entries, deferredQuery]);
  const filtered = isCatalogQueryFiltered(query);
  const activeFilters = listCatalogFilters(query);
  const filtersDialog = useRef<HTMLDialogElement>(null);

  function update(patch: Partial<CatalogQuery>) {
    const next = { ...query, ...patch };
    setQuery(next);
    const { pathname, search, hash } = window.location;
    const params = withCatalogQuery(new URLSearchParams(search), next);
    params.set('tab', 'library');
    const nextSearch = `?${params.toString()}`;
    if (nextSearch !== search) window.history.replaceState(null, '', `${pathname}${nextSearch}${hash}`);
  }

  const toggle = <T extends string>(values: T[], value: T) => values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
  const clearFilters = () => update({ ...switchCatalogSport(query, query.sport), q: '' });
  const sortLabel = (sort: CatalogSort) => sort === 'name' ? 'By focus' : CATALOG_SORTS.find((entry) => entry.id === sort)?.label ?? sort;

  const groups = query.sort === 'name'
    ? CATALOG_CATEGORIES.map((category) => ({ ...category, entries: results.filter((entry) => entry.workout.category === category.id) })).filter((group) => group.entries.length > 0)
    : [{ id: 'all', label: '', entries: results }];

  if (entries.length === 0) {
    return <EmptyState title="No workouts here yet" description="Ready-made workouts will appear here soon." />;
  }

  return (
    <div className="@container flex min-w-0 flex-col gap-5">
      <div role="search" aria-label="Filter workouts" className="flex flex-col gap-3">
        <CollectionToolbar search={<SearchField value={query.q} onChange={(event) => update({ q: event.target.value })} label="Search by name, focus or tag" placeholder="Search workouts" labelClassName="min-w-48 flex-1 @2xl:max-w-md" className="max-md:min-h-11" maxLength={80} autoComplete="off" />}>
          <FiltersButton activeCount={activeFilters.length} onOpen={() => filtersDialog.current?.showModal()} />
        </CollectionToolbar>
        <ActiveFilterChips chips={activeFilters.map((chip) => ({ key: chip.key, label: chip.label, onRemove: () => update(chip.remove) }))} />
      </div>

      <FiltersDialog
        dialogRef={filtersDialog}
        titleId="library-filters-title"
        resultCount={results.length}
        clearDisabled={activeFilters.length === 0}
        onClear={() => update(switchCatalogSport(query, query.sport))}
      >
        <FilterChipGroup
          legend="Focus"
          options={CATALOG_CATEGORIES.flatMap((category) => {
            const count = categoryCounts.get(category.id) ?? 0;
            return count === 0 && !query.categories.includes(category.id) ? [] : [{ id: category.id, label: category.label, count }];
          })}
          selected={query.categories}
          onToggle={(id) => update({ categories: toggle(query.categories, id) })}
        />
        <FilterChipGroup legend="Length" options={DURATION_BUCKETS} selected={query.durations} onToggle={(id) => update({ durations: toggle<DurationBucket>(query.durations, id) })} />
        <FilterChipGroup legend="Level" options={CATALOG_LEVELS} selected={query.levels} onToggle={(id) => update({ levels: toggle<CatalogLevel>(query.levels, id) })} />
        <SortSelect value={query.sort} options={CATALOG_SORTS.map((sort) => ({ id: sort.id, label: sortLabel(sort.id) }))} onChange={(sort) => update({ sort })} />
      </FiltersDialog>

      <CollectionSummary heading={<SportHeading sport={query.sport} counts={sportTotals} onChange={(sport) => update(switchCatalogSport(query, sport))} />} action={filtered && results.length > 0 ? (
        <button type="button" className={`${ghostButtonClassName('compact')} max-md:min-h-11`} onClick={clearFilters}>
          <X aria-hidden="true" size={14} strokeWidth={1.7} />Clear search and filters
        </button>
      ) : null}>
        {results.length === total ? total : `${results.length} of ${total}`}<span className="sr-only"> workouts</span>
        {query.sort === 'name' ? null : `\u00A0– ${sortLabel(query.sort)}`}
      </CollectionSummary>

      {results.length === 0 ? (
        <EmptyState
          title="No workouts match"
          description="Try a different search or adjust your filters."
          action={(
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={clearFilters}>Clear search and filters</button>
              {query.q ? CATALOG_SPORTS.filter(({ id }) => id !== query.sport && searchCounts[id] > 0).map(({ id }) => (
                <button key={id} type="button" className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => update(switchCatalogSport(query, id))}>
                  {`Show ${searchCounts[id]} ${sportWorkouts(id, searchCounts[id]).toLowerCase()}`}
                </button>
              )) : null}
            </div>
          )}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={group.label ? `library-group-${group.id}` : undefined} className="flex flex-col gap-3">
              {group.label ? (
                <h3 id={`library-group-${group.id}`} className="flex items-baseline gap-2 text-base font-medium text-[var(--text)]">
                  {group.label}<span className="data text-[13px] font-normal text-[var(--text-muted)]">{group.entries.length}</span>
                </h3>
              ) : null}
              <WorkoutCardGrid>
                {group.entries.map((entry) => (
                  <li key={entry.workout.slug} className="min-w-0">
                    <LibraryCard entry={entry} headingLevel={group.label ? 'h4' : 'h3'} />
                  </li>
                ))}
              </WorkoutCardGrid>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function sportWorkouts(sport: CatalogSport, count?: number) {
  return `${catalogSportLabel(sport)} ${count === 1 ? 'workout' : 'workouts'}`;
}

/** The list's heading names the sport and is also where you change it, so bike-only riders just read "Bike workouts". */
function SportHeading({ sport, counts, onChange }: { sport: CatalogSport; counts: Record<CatalogSport, number>; onChange: (sport: CatalogSport) => void }) {
  return (
    <h2 className={sectionHeadingClassName}>
      <Menu>
        <MenuTrigger
          aria-label={`${sportWorkouts(sport)}, change sport`}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 transition-colors control-hover:bg-[var(--raised)] max-md:min-h-11 ${buttonFocusClassName}`}
        >
          {sportWorkouts(sport)}
          <ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} className="text-[var(--text-muted)]" />
        </MenuTrigger>
        <MenuContent align="start">
          <MenuRadioGroup aria-label="Sport" value={sport} onValueChange={(value) => { if (isCatalogSport(value) && value !== sport) onChange(value); }}>
            {CATALOG_SPORTS.map(({ id }) => (
              <MenuRadioItem key={id} value={id} closeOnSelect>
                <MenuItemIndicator><Check aria-hidden="true" size={16} strokeWidth={1.8} /></MenuItemIndicator>
                <span className="flex-1">{sportWorkouts(id)}</span>
                <span className="data text-[13px] text-[var(--text-muted)]">{counts[id]}</span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
    </h2>
  );
}
