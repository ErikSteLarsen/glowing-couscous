'use client';

import { useDeferredValue, useMemo, type ReactNode } from 'react';
import { FilterChipGroup } from '@/components/library/CollectionFilters';
import { CollectionControls, CollectionEmpty, sportWorkoutsLabel, toggleValue, type CollectionFilterKind, type CollectionQueryUpdate } from '@/components/library/CollectionToolbar';
import { LibraryCard } from '@/components/library/LibraryCard';
import { WorkoutCardGrid } from '@/components/library/WorkoutCard';
import { EmptyState } from '@/components/ui';
import {
  CATALOG_CATEGORIES, CATALOG_LEVELS, countCatalogBySport, filterCatalog,
  type CatalogEntry, type CatalogQuery,
} from '@/lib/workout-catalog/query';
import type { CatalogCategory, CatalogLevel } from '@/lib/workout-catalog/types';

const libraryFilters: readonly CollectionFilterKind[] = ['category', 'duration', 'level', 'tag', 'tss', 'if'];

/** Public library tab: the page's shared query applied to the catalog, grouped by focus when sorted by it. */
export function LibraryBrowser({
  entries,
  query,
  onChange,
  action,
}: {
  entries: CatalogEntry[];
  query: CatalogQuery;
  onChange: CollectionQueryUpdate;
  action?: ReactNode;
}) {
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => filterCatalog(entries, deferredQuery), [entries, deferredQuery]);
  const sportTotals = useMemo(() => countCatalogBySport(entries), [entries]);
  const searchCounts = useMemo(() => countCatalogBySport(entries, deferredQuery.q), [entries, deferredQuery.q]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<CatalogCategory, number>();
    for (const entry of filterCatalog(entries, { ...deferredQuery, categories: [] })) counts.set(entry.workout.category, (counts.get(entry.workout.category) ?? 0) + 1);
    return counts;
  }, [entries, deferredQuery]);

  const groups = deferredQuery.sort === 'name'
    ? CATALOG_CATEGORIES.map((category) => ({ ...category, entries: results.filter((entry) => entry.workout.category === category.id) })).filter((group) => group.entries.length > 0)
    : [{ id: 'all', label: '', entries: results }];

  if (entries.length === 0) {
    return <EmptyState title="No workouts here yet" description="Ready-made workouts will appear here soon." />;
  }

  return (
    <div className="@container flex min-w-0 flex-col gap-5">
      <CollectionControls
        id="library"
        query={query}
        onChange={onChange}
        filters={libraryFilters}
        searchLabel="Search by name, focus or tag"
        resultCount={results.length}
        total={sportTotals[deferredQuery.sport]}
        heading={sportWorkoutsLabel(deferredQuery.sport)}
        nameSortLabel="By focus"
        action={action}
        groups={<>
          <FilterChipGroup
            legend="Focus"
            options={CATALOG_CATEGORIES.flatMap((category) => {
              const count = categoryCounts.get(category.id) ?? 0;
              return count === 0 && !query.categories.includes(category.id) ? [] : [{ id: category.id, label: category.label, count }];
            })}
            selected={query.categories}
            onToggle={(id) => onChange({ categories: toggleValue(query.categories, id) })}
          />
          <FilterChipGroup legend="Level" options={CATALOG_LEVELS} selected={query.levels} onToggle={(id) => onChange({ levels: toggleValue<CatalogLevel>(query.levels, id) })} />
        </>}
      />

      {results.length === 0 ? (
        <CollectionEmpty
          query={query}
          onChange={onChange}
          filters={libraryFilters}
          searchCounts={searchCounts}
          title="No public workouts for this sport"
          description="The library has bike, run and swim workouts."
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
