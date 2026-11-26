'use client';

import { useState } from 'react';
import { serializeCatalogQuery, withCatalogQuery, type CatalogQuery } from '@/lib/workout-catalog/query';

/**
 * The Workouts page's one search, sport and filter state, shared by both tabs and
 * kept in the URL so Back and shared links return to the same list. A URL change
 * from outside (a link, browser Back) replaces it.
 */
export function useCollectionQuery(urlQuery: CatalogQuery, tab: string) {
  const urlFilters = serializeCatalogQuery(urlQuery);
  const [observedFilters, setObservedFilters] = useState(urlFilters);
  const [query, setQuery] = useState(urlQuery);
  if (urlFilters !== observedFilters) {
    setObservedFilters(urlFilters);
    if (urlFilters !== serializeCatalogQuery(query)) setQuery(urlQuery);
  }

  function update(patch: Partial<CatalogQuery>) {
    const next = { ...query, ...patch };
    setQuery(next);
    const { pathname, search, hash } = window.location;
    const params = withCatalogQuery(new URLSearchParams(search), next);
    params.set('tab', tab);
    const nextSearch = `?${params.toString()}`;
    if (nextSearch !== search) window.history.replaceState(null, '', `${pathname}${nextSearch}${hash}`);
  }

  return [query, update] as const;
}
