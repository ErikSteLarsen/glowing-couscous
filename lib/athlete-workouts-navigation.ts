import { parseCatalogQuery, serializeCatalogQuery, type CatalogQuery } from './workout-catalog/query.ts';

export type WorkoutTab = 'mine' | 'library';

export function resolveWorkoutTab(tab: string | null, ownedCount: number): WorkoutTab {
  if (tab === 'mine' || tab === 'library') return tab;
  return ownedCount > 0 ? 'mine' : 'library';
}

export function athleteWorkoutsHref(params: URLSearchParams) {
  const query = params.toString();
  return query ? `/athlete/workouts?${query}` : '/athlete/workouts';
}

export function publicLibraryHref(query?: CatalogQuery) {
  const filters = new URLSearchParams(query ? serializeCatalogQuery(query) : undefined);
  return athleteWorkoutsHref(new URLSearchParams([['tab', 'library'], ...filters]));
}

export function legacyLibraryRedirectHref(params: Record<string, string | string[] | undefined>) {
  return publicLibraryHref(parseCatalogQuery(params));
}

export function customizeWorkoutHref(slug: string) {
  return athleteWorkoutsHref(new URLSearchParams({ customize: slug }));
}

/** Detail page of one saved workout, the owned counterpart of `/athlete/library/<slug>`. */
export function myWorkoutHref(id: number) {
  return `/athlete/workouts/${id}`;
}

export function myWorkoutsHref() {
  return athleteWorkoutsHref(new URLSearchParams({ tab: 'mine' }));
}

/** Opens the editor; `from: 'detail'` makes its Back return to the workout's detail page. */
export function editWorkoutHref(id: number, from?: 'detail') {
  const params = new URLSearchParams({ edit: String(id) });
  if (from) params.set('from', from);
  return athleteWorkoutsHref(params);
}
