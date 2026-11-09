import { SPORT_OPTIONS, type SportType } from './sport.ts';

export const ACTIVITY_PAGE_SIZE = 12;

export type ActivityFilters = {
  page: number;
  query: string;
  sport: SportType | null;
};

export function parseActivityFilters(params: { page?: unknown; q?: unknown; sport?: unknown }): ActivityFilters {
  const page = typeof params.page === 'string' && /^[1-9]\d{0,8}$/.test(params.page) ? Number(params.page) : 1;
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const sport = SPORT_OPTIONS.find((option) => option === params.sport) ?? null;
  return { page, query, sport };
}

export function getActivityHref(filters: ActivityFilters, page = filters.page) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.sport) params.set('sport', filters.sport);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `/athlete/activity${query ? `?${query}` : ''}`;
}
