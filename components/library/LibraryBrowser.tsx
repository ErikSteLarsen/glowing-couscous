'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Search, X } from 'lucide-react';
import { CatalogProfile } from '@/components/library/CatalogProfile';
import { useCatalogRide } from '@/components/library/useCatalogRide';
import { buttonFocusClassName, compactSecondaryButtonClassName, EmptyState, formFieldClassName, formSelectClassName, ghostButtonClassName } from '@/components/ui';
import { formatDuration } from '@/lib/format-duration';
import { expandCatalogItems } from '@/lib/workout-catalog/metrics';
import {
  CATALOG_CATEGORIES, CATALOG_LEVELS, CATALOG_SORTS, categoryLabel, DURATION_BUCKETS, EMPTY_CATALOG_QUERY, filterCatalog, isCatalogQueryFiltered, levelLabel, serializeCatalogQuery,
  type CatalogEntry, type CatalogQuery, type CatalogSort, type DurationBucket,
} from '@/lib/workout-catalog/query';
import type { CatalogCategory, CatalogLevel } from '@/lib/workout-catalog/types';

const chipClassName = (selected: boolean) => `inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors max-md:min-h-10 ${buttonFocusClassName} ${
  selected
    ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--text)]'
    : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--raised)] hover:text-[var(--text)]'
}`;

export function LibraryBrowser({
  entries,
  initialQuery,
  variant = 'page',
}: {
  entries: CatalogEntry[];
  initialQuery: CatalogQuery;
  /** `hub` adds Ride now to every card and opens rides from the Ride home. */
  variant?: 'page' | 'hub';
}) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => filterCatalog(entries, deferredQuery), [entries, deferredQuery]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<CatalogCategory, number>();
    for (const entry of filterCatalog(entries, { ...deferredQuery, categories: [] })) counts.set(entry.workout.category, (counts.get(entry.workout.category) ?? 0) + 1);
    return counts;
  }, [entries, deferredQuery]);
  const from = variant === 'hub' ? 'ride' : 'library';
  const rides = useCatalogRide(from);
  const filtered = isCatalogQueryFiltered(query);
  const firstRender = useRef(true);

  // Keep filters in the URL without a server round trip, so reload and Back restore them.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const timer = window.setTimeout(() => {
      const search = serializeCatalogQuery(query);
      const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
      if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, '', url);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const update = (patch: Partial<CatalogQuery>) => setQuery((current) => ({ ...current, ...patch }));
  const toggleCategory = (category: CatalogCategory) => update({
    categories: query.categories.includes(category) ? query.categories.filter((value) => value !== category) : [...query.categories, category],
  });

  const groups = query.sort === 'name'
    ? CATALOG_CATEGORIES.map((category) => ({ ...category, entries: results.filter((entry) => entry.workout.category === category.id) })).filter((group) => group.entries.length > 0)
    : [{ id: 'all', label: '', entries: results }];
  const detailQuery = from === 'ride' ? '?from=ride' : '';

  if (entries.length === 0) {
    return <EmptyState title="The library is being written" description="Built-in workouts will appear here as soon as they ship." />;
  }

  return (
    <div className="@container flex min-w-0 flex-col gap-5">
      <div role="search" aria-label="Filter workouts" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 @2xl:flex-row @2xl:items-center">
          <label className="relative min-w-0 flex-1 @2xl:max-w-sm">
            <span className="sr-only">Search workouts</span>
            <Search aria-hidden="true" size={16} strokeWidth={1.6} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              value={query.q}
              onChange={(event) => update({ q: event.target.value })}
              placeholder="Search name, focus or tag"
              className={`${formFieldClassName} pl-9`}
              autoComplete="off"
            />
          </label>
          <div className="grid grid-cols-3 gap-2 @2xl:flex">
            <label className="min-w-0">
              <span className="sr-only">Duration</span>
              <select className={`${formSelectClassName} @2xl:w-auto`} value={query.durations[0] ?? ''} onChange={(event) => update({ durations: event.target.value ? [event.target.value as DurationBucket] : [] })}>
                <option value="">Any length</option>
                {DURATION_BUCKETS.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.label}</option>)}
              </select>
            </label>
            <label className="min-w-0">
              <span className="sr-only">Level</span>
              <select className={`${formSelectClassName} @2xl:w-auto`} value={query.levels[0] ?? ''} onChange={(event) => update({ levels: event.target.value ? [event.target.value as CatalogLevel] : [] })}>
                <option value="">Any level</option>
                {CATALOG_LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
              </select>
            </label>
            <label className="min-w-0">
              <span className="sr-only">Sort</span>
              <select className={`${formSelectClassName} @2xl:w-auto`} value={query.sort} onChange={(event) => update({ sort: event.target.value as CatalogSort })}>
                {CATALOG_SORTS.map((sort) => <option key={sort.id} value={sort.id}>{sort.id === 'name' ? 'By focus' : sort.label}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 @3xl:flex-wrap @3xl:overflow-visible" aria-label="Focus">
          <button type="button" aria-pressed={query.categories.length === 0} className={chipClassName(query.categories.length === 0)} onClick={() => update({ categories: [] })}>All</button>
          {CATALOG_CATEGORIES.map((category) => {
            const count = categoryCounts.get(category.id) ?? 0;
            const selected = query.categories.includes(category.id);
            if (count === 0 && !selected) return null;
            return (
              <button key={category.id} type="button" aria-pressed={selected} className={chipClassName(selected)} onClick={() => toggleCategory(category.id)}>
                {category.label}<span className="data text-[12px] text-[var(--text-muted)]">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <p aria-live="polite" className="data text-[13px] text-[var(--text-muted)]">
          {results.length === entries.length ? `${entries.length} workouts` : `${results.length} of ${entries.length} workouts`}
        </p>
        {filtered ? (
          <button type="button" className={ghostButtonClassName('compact')} onClick={() => setQuery({ ...EMPTY_CATALOG_QUERY, sort: query.sort })}>
            <X aria-hidden="true" size={14} strokeWidth={1.7} />Clear filters
          </button>
        ) : null}
      </div>

      {rides.error ? <p role="alert" className="text-sm text-[var(--status-danger)]">{rides.error.message}</p> : null}

      {results.length === 0 ? (
        <EmptyState
          title="No workouts match"
          description="Try a broader length or level, or clear the search."
          action={<button type="button" className={compactSecondaryButtonClassName} onClick={() => setQuery({ ...EMPTY_CATALOG_QUERY, sort: query.sort })}>Clear filters</button>}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={group.label ? `library-group-${group.id}` : undefined} className="flex flex-col gap-3">
              {group.label ? (
                <h2 id={`library-group-${group.id}`} className="flex items-baseline gap-2 text-[15px] font-medium text-[var(--text)]">
                  {group.label}<span className="data text-[13px] font-normal text-[var(--text-muted)]">{group.entries.length}</span>
                </h2>
              ) : null}
              <ul className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
                {group.entries.map((entry) => (
                  <li key={entry.workout.slug} className="min-w-0">
                    <LibraryCard
                      entry={entry}
                      href={`/athlete/library/${entry.workout.slug}${detailQuery}`}
                      ride={variant === 'hub' ? () => rides.ride(entry.workout.slug) : undefined}
                      riding={rides.pending?.slug === entry.workout.slug}
                      rideDisabled={rides.pending !== null}
                    />
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

function LibraryCard({ entry, href, ride, riding, rideDisabled }: { entry: CatalogEntry; href: string; ride?: () => void; riding: boolean; rideDisabled: boolean }) {
  const { workout, metrics } = entry;
  const steps = useMemo(() => expandCatalogItems(workout.items), [workout.items]);

  return (
    <article className="tile tile--interactive group relative flex h-full flex-col rounded-2xl p-4 [--profile-gap:var(--surface)] hover:[--profile-gap:var(--raised)] has-[a:focus-visible]:border-[var(--brand)]">
      <CatalogProfile steps={steps} idPrefix={`card-${workout.slug}`} label={`${workout.name} intensity profile, ${formatDuration(metrics.durationSec)}, peak ${Math.round(metrics.maxPct)}% FTP`} className="h-14" />
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-[15px] font-medium leading-snug text-[var(--text)]">
          <Link href={href} className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']">
            {workout.name}
          </Link>
        </h3>
        <span className="data shrink-0 text-[13px] text-[var(--text-secondary)]">{formatDuration(metrics.durationSec)}</span>
      </div>
      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{categoryLabel(workout.category)} · {levelLabel(workout.level)}</p>
      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{workout.summary}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
        <dl className="data flex gap-4 text-[12px] text-[var(--text-muted)]">
          <div className="flex gap-1"><dt>TSS</dt><dd className="text-[var(--text)]">{metrics.tss}</dd></div>
          <div className="flex gap-1"><dt>IF</dt><dd className="text-[var(--text)]">{metrics.intensityFactor.toFixed(2)}</dd></div>
        </dl>
        {ride ? (
          <button type="button" onClick={ride} disabled={rideDisabled} className={`${compactSecondaryButtonClassName} relative z-10`} aria-label={`Ride ${workout.name} now`}>
            <Play aria-hidden="true" size={13} strokeWidth={1.8} />{riding ? 'Starting…' : 'Ride now'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
