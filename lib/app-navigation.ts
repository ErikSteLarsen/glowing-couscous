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
    { label: 'Calendar', description: 'See scheduled work', href: '/athlete/calendar', matchPrefix: '/athlete/calendar' },
    { label: 'Planner', description: 'Place on dates', href: '/athlete/planner', matchPrefix: '/athlete/planner' },
    { label: 'Workouts', description: 'Create & manage', href: '/athlete/workouts', matchPrefix: '/athlete/workouts' },
    { label: 'Templates', description: 'Reuse & assign', href: '/athlete/templates', matchPrefix: '/athlete/templates' },
    { label: 'Activity', description: 'Review completed work', href: '/athlete/activity', matchPrefix: '/athlete/activity' },
    { label: 'Events', description: 'Goals and results', href: '/athlete/events', matchPrefix: '/athlete/events' },
  ];
}

export function getMobileNavigation(role: AppRole): NavItem[] {
  if (role === 'COACH') {
    return [
      { label: 'Home', description: 'Coach overview', href: '/coach', matchPrefix: '/coach' },
      { label: 'Plan', description: 'Assign training', href: '/coach/planner', matchPrefix: '/coach/planner' },
      { label: 'Workouts', description: 'Manage workouts', href: '/coach/workouts', matchPrefix: '/coach/workouts' },
    ];
  }

  return [
    { label: 'Home', description: "Today's overview", href: '/athlete', matchPrefix: '/athlete', exact: true },
    { label: 'Calendar', description: 'Schedule & view training', href: '/athlete/calendar', matchPrefix: '/athlete/calendar' },
    { label: 'Planner', description: 'Place on dates', href: '/athlete/planner', matchPrefix: '/athlete/planner' },
    { label: 'Workouts', description: 'Create & manage', href: '/athlete/workouts', matchPrefix: '/athlete/workouts', activeMatchPrefixes: ['/athlete/templates'] },
    { label: 'Activity', description: 'Review completed work', href: '/athlete/activity', matchPrefix: '/athlete/activity', activeMatchPrefixes: ['/athlete/import'] },
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
