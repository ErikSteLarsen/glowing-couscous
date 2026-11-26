import type { BackTarget } from './app-navigation.ts';
import { EMPTY_CATALOG_QUERY, isCatalogSport, parseCatalogQuery, serializeCatalogQuery, toWorkoutSport, type CatalogQuery } from './workout-catalog/query.ts';
import type { CatalogSport } from './workout-catalog/types.ts';

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

/** A back target to the public library opens it on the workout's own sport; other targets stay as they are. */
export function backToLibrarySport(back: BackTarget, sport: string): BackTarget {
  return back.href === publicLibraryHref() && isCatalogSport(sport)
    ? { ...back, href: publicLibraryHref({ ...EMPTY_CATALOG_QUERY, sport }) }
    : back;
}

export function legacyLibraryRedirectHref(params: Record<string, string | string[] | undefined>) {
  return publicLibraryHref(parseCatalogQuery(params));
}

/** Keeps the sport in the URL, so closing the editor returns to the list the workout came from. */
export function customizeWorkoutHref(slug: string, sport: CatalogSport) {
  return athleteWorkoutsHref(new URLSearchParams([
    ['customize', slug], ...new URLSearchParams(serializeCatalogQuery({ ...EMPTY_CATALOG_QUERY, sport })),
  ]));
}

/** Detail page of one saved workout, the owned counterpart of `/athlete/library/<slug>`. */
export function myWorkoutHref(id: number) {
  return `/athlete/workouts/${id}`;
}

/** My workouts; with a sport, on that sport so the workout you came from is in the list. */
export function myWorkoutsHref(sport?: string) {
  const filters = sport ? serializeCatalogQuery({ ...EMPTY_CATALOG_QUERY, sport: toWorkoutSport(sport) }) : '';
  return athleteWorkoutsHref(new URLSearchParams([['tab', 'mine'], ...new URLSearchParams(filters)]));
}

/** Opens the editor; `from: 'detail'` makes its Back return to the workout's detail page. */
export function editWorkoutHref(id: number, from?: 'detail') {
  const params = new URLSearchParams({ edit: String(id) });
  if (from) params.set('from', from);
  return athleteWorkoutsHref(params);
}
