export type AppRole = 'COACH' | 'ATHLETE';

export type NavItem = {
  label: string;
  description?: string;
  href: string;
  matchPrefix: string;
  activeMatchPrefixes?: readonly string[];
};

function getMatchPrefixes(item: NavItem) {
  return [item.matchPrefix, ...(item.activeMatchPrefixes ?? [])];
}

function matchesPath(pathname: string, item: NavItem) {
  return pathname === item.href || getMatchPrefixes(item).some((prefix) => pathname.startsWith(prefix + '/'));
}

function getMatchSpecificity(item: NavItem) {
  return Math.max(...getMatchPrefixes(item).map((prefix) => prefix.length));
}

export function getPrimaryNavigation(): NavItem[] {
  return [
    { label: 'Home', description: "Today's overview", href: '/athlete', matchPrefix: '/athlete' },
    {
      label: 'Workouts',
      description: 'Create & manage',
      href: '/athlete/workouts',
      matchPrefix: '/athlete/workouts',
    },
    { label: 'Planner', description: 'Place on dates', href: '/athlete/planner', matchPrefix: '/athlete/planner' },
    { label: 'Templates', description: 'Reuse & assign', href: '/athlete/templates', matchPrefix: '/athlete/templates' },
    { label: 'Calendar', description: 'See scheduled work', href: '/athlete/calendar', matchPrefix: '/athlete/calendar' },
    { label: 'Activity', description: 'Review completed', href: '/athlete/activity', matchPrefix: '/athlete/activity' },
    {
      label: 'Import',
      description: 'Review Strava and activity files',
      href: '/athlete/import',
      matchPrefix: '/athlete/import',
    },
  ];
}

export function getMobileNavigation(): NavItem[] {
  const items = getPrimaryNavigation();
  const priorityLabels = ['Home', 'Calendar', 'Workouts', 'Planner'];

  return priorityLabels
    .map((label) => items.find((item) => item.label === label))
    .filter((item): item is NavItem => Boolean(item));
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

const sessionReturnTargets = {
  home: { href: '/athlete', label: 'Back to Home' },
  calendar: { href: '/athlete/calendar', label: 'Back to Calendar' },
  activity: { href: '/athlete/activity', label: 'Back to Activity' },
  imports: { href: '/athlete/import', label: 'Back to Import' },
  planner: { href: '/athlete/planner', label: 'Back to Planner' },
} as const;

export type SessionOrigin = keyof typeof sessionReturnTargets;

export function getSessionOrigin(origin?: string): SessionOrigin {
  if (origin && Object.prototype.hasOwnProperty.call(sessionReturnTargets, origin)) {
    return origin as SessionOrigin;
  }

  return 'calendar';
}

export function getSessionReturnTarget(origin?: string) {
  return sessionReturnTargets[getSessionOrigin(origin)];
}

export function getCoachAthleteReturnTarget(origin: string | undefined, athleteId: number, date?: string) {
  if (origin !== 'planner') {
    return { href: '/coach', label: 'Back to your athletes' };
  }

  const params = new URLSearchParams({ athleteId: String(athleteId) });
  if (date && isCalendarDate(date)) params.set('date', date);

  return { href: `/coach/planner?${params.toString()}`, label: 'Back to Planner' };
}

function isCalendarDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
