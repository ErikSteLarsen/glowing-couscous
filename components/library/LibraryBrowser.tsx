'use client';

import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { LibraryCard } from '@/components/library/LibraryCard';
import { buttonFocusClassName, compactSecondaryButtonClassName, EmptyState, formFieldClassName, formLabelClassName, formSelectClassName, ghostButtonClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
import {
  CATALOG_CATEGORIES, CATALOG_LEVELS, CATALOG_SORTS, DURATION_BUCKETS, EMPTY_CATALOG_QUERY, filterCatalog, isCatalogQueryFiltered, listCatalogFilters, serializeCatalogQuery, withCatalogQuery,
  type CatalogEntry, type CatalogQuery, type CatalogSort, type DurationBucket,
} from '@/lib/workout-catalog/query';
import type { CatalogCategory, CatalogLevel } from '@/lib/workout-catalog/types';

const chipClassName = (selected: boolean) => `inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors max-md:min-h-11 ${buttonFocusClassName} ${
  selected
    ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--text)]'
    : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--raised)] hover:text-[var(--text)]'
}`;

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
  const clearFilters = () => update({ ...EMPTY_CATALOG_QUERY, sort: query.sort });
  const sortLabel = (sort: CatalogSort) => sort === 'name' ? 'By focus' : CATALOG_SORTS.find((entry) => entry.id === sort)?.label ?? sort;

  const groups = query.sort === 'name'
    ? CATALOG_CATEGORIES.map((category) => ({ ...category, entries: results.filter((entry) => entry.workout.category === category.id) })).filter((group) => group.entries.length > 0)
    : [{ id: 'all', label: '', entries: results }];

  if (entries.length === 0) {
    return <EmptyState title="The library is being written" description="Built-in workouts will appear here as soon as they ship." />;
  }

  return (
    <div className="@container flex min-w-0 flex-col gap-5">
      <div role="search" aria-label="Filter workouts" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1 @2xl:max-w-md">
            <span className="sr-only">Search by name, focus or tag</span>
            <Search aria-hidden="true" size={16} strokeWidth={1.6} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              value={query.q}
              onChange={(event) => update({ q: event.target.value })}
              placeholder="Search workouts"
              maxLength={80}
              className={`${formFieldClassName} pl-9 max-md:min-h-11`}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={activeFilters.length ? `Filters, ${activeFilters.length} active` : 'Filters'}
            className={`${secondaryButtonClassName} shrink-0 max-md:min-h-11`}
            onClick={() => filtersDialog.current?.showModal()}
          >
            <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={1.6} />
            Filters
            {activeFilters.length ? <span aria-hidden="true" className="data inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[12px] font-semibold leading-5 text-[var(--signal-ink)]">{activeFilters.length}</span> : null}
          </button>
        </div>
        {activeFilters.length ? (
          <ul aria-label="Active filters" className="flex flex-wrap gap-2">
            {activeFilters.map((chip) => (
              <li key={chip.key}>
                <button type="button" aria-label={`Remove ${chip.label} filter`} className={chipClassName(true)} onClick={() => update(chip.remove)}>
                  {chip.label}<X aria-hidden="true" size={13} strokeWidth={1.8} className="text-[var(--text-muted)]" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <dialog
        ref={filtersDialog}
        aria-labelledby="library-filters-title"
        className="fixed inset-0 z-50 m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-[var(--shadow-overlay)] backdrop:bg-[var(--overlay)]"
        onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <h2 id="library-filters-title" className="text-lg font-semibold text-[var(--text)]">Filters</h2>
          <button type="button" aria-label="Close filters" className={`inline-flex size-10 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--raised)] hover:text-[var(--text)] max-md:size-11 ${buttonFocusClassName}`} onClick={() => filtersDialog.current?.close()}>
            <X aria-hidden="true" size={18} strokeWidth={1.7} />
          </button>
        </div>
        <div className="flex flex-col gap-6 px-5 py-5">
          <fieldset className="flex flex-col gap-2.5">
            <legend className={`${formLabelClassName} mb-2.5`}>Focus</legend>
            <div className="flex flex-wrap gap-2">
              {CATALOG_CATEGORIES.map((category) => {
                const count = categoryCounts.get(category.id) ?? 0;
                const selected = query.categories.includes(category.id);
                if (count === 0 && !selected) return null;
                return (
                  <button key={category.id} type="button" aria-pressed={selected} className={chipClassName(selected)} onClick={() => update({ categories: toggle(query.categories, category.id) })}>
                    {category.label}<span className="data text-[12px] text-[var(--text-muted)]">{count}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="flex flex-col">
            <legend className={`${formLabelClassName} mb-2.5`}>Length</legend>
            <div className="flex flex-wrap gap-2">
              {DURATION_BUCKETS.map((bucket) => (
                <button key={bucket.id} type="button" aria-pressed={query.durations.includes(bucket.id)} className={chipClassName(query.durations.includes(bucket.id))} onClick={() => update({ durations: toggle<DurationBucket>(query.durations, bucket.id) })}>{bucket.label}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col">
            <legend className={`${formLabelClassName} mb-2.5`}>Level</legend>
            <div className="flex flex-wrap gap-2">
              {CATALOG_LEVELS.map((level) => (
                <button key={level.id} type="button" aria-pressed={query.levels.includes(level.id)} className={chipClassName(query.levels.includes(level.id))} onClick={() => update({ levels: toggle<CatalogLevel>(query.levels, level.id) })}>{level.label}</button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-2.5">
            <span className={formLabelClassName}>Sort</span>
            <select className={`${formSelectClassName} max-md:min-h-11`} value={query.sort} onChange={(event) => update({ sort: event.target.value as CatalogSort })}>
              {CATALOG_SORTS.map((sort) => <option key={sort.id} value={sort.id}>{sortLabel(sort.id)}</option>)}
            </select>
          </label>
        </div>
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <button type="button" className={`${ghostButtonClassName('default')} max-md:min-h-11`} disabled={activeFilters.length === 0} onClick={() => update({ ...EMPTY_CATALOG_QUERY, q: query.q, sort: query.sort })}>Clear filters</button>
          <button type="button" className={`${primaryButtonClassName} max-md:min-h-11`} onClick={() => filtersDialog.current?.close()}>
            {`Show ${results.length} ${results.length === 1 ? 'workout' : 'workouts'}`}
          </button>
        </div>
      </dialog>

      <div className="flex min-h-8 items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <p aria-live="polite" className="data text-[13px] text-[var(--text-muted)]">
          {results.length === entries.length ? `${entries.length} workouts` : `${results.length} of ${entries.length} workouts`}
          {query.sort === 'name' ? null : ` · ${sortLabel(query.sort)}`}
        </p>
        {filtered ? (
          <button type="button" className={`${ghostButtonClassName('compact')} max-md:min-h-11`} onClick={clearFilters}>
            <X aria-hidden="true" size={14} strokeWidth={1.7} />Clear filters
          </button>
        ) : null}
      </div>


      {results.length === 0 ? (
        <EmptyState
          title="No workouts match"
          description="Try a broader length or level, or clear the search."
          action={<button type="button" className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={clearFilters}>Clear filters</button>}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={group.label ? `library-group-${group.id}` : undefined} className="flex flex-col gap-3">
              {group.label ? (
                <h2 id={`library-group-${group.id}`} className="flex items-baseline gap-2 text-base font-medium text-[var(--text)]">
                  {group.label}<span className="data text-[13px] font-normal text-[var(--text-muted)]">{group.entries.length}</span>
                </h2>
              ) : null}
              <ul className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
                {group.entries.map((entry) => (
                  <li key={entry.workout.slug} className="min-w-0">
                    <LibraryCard entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
