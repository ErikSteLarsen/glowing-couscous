export type AppRole = 'COACH' | 'ATHLETE';

export type NavItem = {
  label: string;
  description?: string;
  href: string;
  matchPrefix: string;
  activeMatchPrefixes?: readonly string[];
  exact?: boolean;
};

function getMatchPrefixes(item: NavItem) {
  return [item.matchPrefix, ...(item.activeMatchPrefixes ?? [])];
}

function matchesPath(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || getMatchPrefixes(item).some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function getMatchSpecificity(item: NavItem) {
  return Math.max(...getMatchPrefixes(item).map((prefix) => prefix.length));
}

export function getPrimaryNavigation(): NavItem[] {
  return [
    { label: 'Home', description: "Today's overview", href: '/athlete', matchPrefix: '/athlete', exact: true },
    { label: 'Calendar', description: 'Your planned workouts', href: '/athlete/calendar', matchPrefix: '/athlete/calendar' },
    { label: 'Workouts', description: 'Yours & public library', href: '/athlete/workouts', matchPrefix: '/athlete/workouts', activeMatchPrefixes: ['/athlete/library'] },
    { label: 'Training plans', description: 'Weekly training patterns', href: '/athlete/templates', matchPrefix: '/athlete/templates' },
    { label: 'My activities', description: 'Recorded, imported and logged', href: '/athlete/activity', matchPrefix: '/athlete/activity', activeMatchPrefixes: ['/athlete/import'] },
    { label: 'Events', description: 'Goals and results', href: '/athlete/events', matchPrefix: '/athlete/events' },
  ];
}

export const profileActions = [
  { label: 'Profile', href: '/profile', matchPrefix: '/profile' },
  { label: 'Settings', href: '/settings', matchPrefix: '/settings' },
] as const;

export function isNavigationItemActive(pathname: string, item: NavItem, items: NavItem[]) {
  if (!matchesPath(pathname, item)) {
    return false;
  }

  return !items.some(
    (candidate) =>
      candidate.href !== item.href &&
      getMatchSpecificity(candidate) > getMatchSpecificity(item) &&
      matchesPath(pathname, candidate),
  );
}

export function isProfileActionActive(
  pathname: string,
  action: (typeof profileActions)[number],
) {
  return pathname === action.href || pathname.startsWith(action.matchPrefix + '/');
}

/**
 * Back navigation: one resolver for every page below a top-level destination.
 * The target is the validated `from=` origin when the route allows it,
 * otherwise the route's hierarchical parent. Origins are an allowlist of keys,
 * never URLs, so `from=` cannot redirect off the app.
 */
const backDestinations = {
  home: { href: '/athlete', destination: 'Home' },
  calendar: { href: '/athlete/calendar', destination: 'Calendar' },
  // Planner merged into Calendar; links that still say from=planner return there.
  planner: { href: '/athlete/calendar', destination: 'Calendar' },
  activity: { href: '/athlete/activity', destination: 'My activities' },
  imports: { href: '/athlete/import', destination: 'Import' },
  library: { href: '/athlete/workouts?tab=library', destination: 'Workouts' },
  ride: { href: '/athlete/ride', destination: 'Ride' },
  profile: { href: '/profile', destination: 'Profile' },
  settings: { href: '/settings#connections', destination: 'Settings' },
  roster: { href: '/coach', destination: 'Athletes' },
} as const;

export type BackOrigin = keyof typeof backDestinations;

const sessionOrigins = ['calendar', 'home', 'planner', 'activity', 'imports', 'library', 'ride'] as const satisfies readonly BackOrigin[];

/** Allowed origins per route; the first entry is the hierarchical parent used without a valid origin. */
const backRoutes = {
  session: sessionOrigins,
  'session-live': sessionOrigins,
  'session-ride': sessionOrigins,
  'library-workout': ['library', 'ride'],
  import: ['activity', 'profile', 'settings'],
  'coach-athlete': ['roster', 'planner'],
} as const satisfies Record<string, readonly [BackOrigin, ...BackOrigin[]]>;

export type BackRoute = keyof typeof backRoutes;

export type BackRouteInput =
  | { route: 'session' | 'library-workout' | 'import'; from?: string }
  | { route: 'session-live' | 'session-ride'; sessionId: number; from?: string }
  | { route: 'coach-athlete'; athleteId: number; from?: string; date?: string };

export type BackTarget = { href: string; label: string; destination: string };

/** The origin when it is allowed for this route, otherwise null. */
export function parseBackOrigin<R extends BackRoute>(route: R, from: string | undefined): (typeof backRoutes)[R][number] | null {
  const allowed: readonly string[] = backRoutes[route];
  return from && allowed.includes(from) ? (from as (typeof backRoutes)[R][number]) : null;
}

/** Adds `from=` to an in-app link (before any hash) when an origin is known. */
export function withBackOrigin(href: string, origin: BackOrigin | null): string {
  if (!origin) return href;
  const hashIndex = href.indexOf('#');
  const [path, hash] = hashIndex === -1 ? [href, ''] : [href.slice(0, hashIndex), href.slice(hashIndex)];
  return `${path}${path.includes('?') ? '&' : '?'}from=${origin}${hash}`;
}

function target(href: string, destination: string): BackTarget {
  return { href, destination, label: `Back to ${destination}` };
}

export function resolveBackTarget(input: BackRouteInput): BackTarget {
  const origin = parseBackOrigin(input.route, input.from);

  if (input.route === 'session-live' || input.route === 'session-ride') {
    return target(withBackOrigin(`/athlete/session/${input.sessionId}`, origin), 'Workout');
  }

  if (input.route === 'coach-athlete' && origin === 'planner') {
    const params = new URLSearchParams({ athleteId: String(input.athleteId) });
    if (isCalendarDate(input.date)) params.set('date', input.date!);
    return target(`/coach/planner?${params.toString()}`, 'Planner');
  }

  const { href, destination } = backDestinations[origin ?? backRoutes[input.route][0]];
  return target(href, destination);
}

/** Back from a started workout that isn't in the Calendar yet, so it has no page of its own. */
export function resolveStartedBackTarget(from: string | undefined): BackTarget {
  const origin = parseBackOrigin('session', from);
  const { href, destination } = origin ? backDestinations[origin] : { href: '/athlete/workouts', destination: 'Workouts' };
  return target(href, destination);
}

function isCalendarDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
