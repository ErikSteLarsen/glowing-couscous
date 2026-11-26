'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { SearchField } from '@/components/tempobuilder/SearchField';
import { formSelectClassName } from '@/components/ui';
import { getActivityHref, type ActivityFilters } from '@/lib/activity-navigation';
import { getSportLabel, SPORT_OPTIONS, type SportType } from '@/lib/sport';

/** Search and sport for My activities. Both apply as you change them and stay in the URL. */
export function ActivityFilterBar({ filters }: { filters: ActivityFilters }) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.query);
  const [, startTransition] = useTransition();
  // A search typed here comes back as the URL's; any other change (Clear filters) replaces the field.
  const [applied, setApplied] = useState(filters.query);
  const [seen, setSeen] = useState(filters.query);
  if (seen !== filters.query) {
    setSeen(filters.query);
    if (filters.query !== applied) setQuery(filters.query);
  }

  function apply(next: Partial<ActivityFilters>) {
    if (next.query !== undefined) setApplied(next.query);
    startTransition(() => router.replace(getActivityHref({ ...filters, ...next }, 1), { scroll: false }));
  }

  // Typing settles for a moment before the list follows.
  useEffect(() => {
    if (query.trim() === filters.query) return;
    const timer = window.setTimeout(() => apply({ query: query.trim().slice(0, 100) }), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row max-md:[&_:is(input,select)]:min-h-11">
      <SearchField
        label="Search activities"
        placeholder="Search by name"
        maxLength={100}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        labelClassName="min-w-0 flex-1"
      />
      <label className="block sm:w-44">
        <span className="sr-only">Sport</span>
        <select value={filters.sport ?? ''} onChange={(event) => apply({ sport: (event.target.value || null) as SportType | null })} className={formSelectClassName}>
          <option value="">All sports</option>
          {SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}
        </select>
      </label>
    </div>
  );
}
