import { parseActivitySourceGroup, type ActivitySourceGroup } from './activity-source.ts';
import { SPORT_OPTIONS, type SportType } from './sport.ts';

export const ACTIVITY_PAGE_SIZE = 12;

export type ActivityFilters = {
  page: number;
  query: string;
  sport: SportType | null;
  /** Recorded here, imported, or logged by hand; null shows all. */
  source: ActivitySourceGroup | null;
};

export function parseActivityFilters(params: { page?: unknown; q?: unknown; sport?: unknown; source?: unknown }): ActivityFilters {
  const page = typeof params.page === 'string' && /^[1-9]\d{0,8}$/.test(params.page) ? Number(params.page) : 1;
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const sport = SPORT_OPTIONS.find((option) => option === params.sport) ?? null;
  return { page, query, sport, source: parseActivitySourceGroup(params.source) };
}

/** The feed URL for `filters`; changing a filter passes page 1. */
export function getActivityHref(filters: ActivityFilters, page = filters.page) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.sport) params.set('sport', filters.sport);
  if (filters.source) params.set('source', filters.source);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `/athlete/activity${query ? `?${query}` : ''}`;
}
