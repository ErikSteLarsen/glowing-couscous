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

export function getPrimaryNavigation(
  role: AppRole,
  { hasActiveCoach = false }: { hasActiveCoach?: boolean } = {},
): NavItem[] {
  if (role === 'COACH') {
    return [
      { label: 'Athletes', description: 'Support your roster', href: '/coach', matchPrefix: '/coach' },
      { label: 'Workouts', description: 'Create & manage', href: '/coach/workouts', matchPrefix: '/coach/workouts' },
      { label: 'Planner', description: 'Place on dates', href: '/coach/planner', matchPrefix: '/coach/planner' },
      { label: 'Templates', description: 'Reuse & assign', href: '/coach/templates', matchPrefix: '/coach/templates' },
    ];
  }

  return [
    { label: 'Home', description: "Today's overview", href: '/athlete', matchPrefix: '/athlete' },
    {
      label: 'Workouts',
      description: 'Create & manage',
      href: '/athlete/workouts',
      matchPrefix: '/athlete/workouts',
      activeMatchPrefixes: ['/athlete/session', '/athlete/live'],
    },
    { label: 'Planner', description: 'Place on dates', href: '/athlete/planner', matchPrefix: '/athlete/planner' },
    { label: 'Templates', description: 'Reuse & assign', href: '/athlete/templates', matchPrefix: '/athlete/templates' },
    { label: 'Calendar', description: 'See scheduled work', href: '/athlete/calendar', matchPrefix: '/athlete/calendar' },
    { label: 'Activity', description: 'Review completed', href: '/athlete/activity', matchPrefix: '/athlete/activity' },
    ...(hasActiveCoach ? [] : [{ label: 'Coach', description: 'Find or manage', href: '/athlete/find-coach', matchPrefix: '/athlete/find-coach' }]),
  ];
}

export function getMobileNavigation(
  role: AppRole,
  options: { hasActiveCoach?: boolean } = {},
): NavItem[] {
  const items = getPrimaryNavigation(role, options);
  const priorityLabels = role === 'ATHLETE' ? ['Home', 'Calendar', 'Workouts', 'Activity'] : ['Athletes', 'Planner', 'Workouts', 'Templates'];

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
  calendar: { href: '/athlete/calendar', label: 'Back to calendar' },
  activity: { href: '/athlete/activity', label: 'Back to Activity' },
  workouts: { href: '/athlete/workouts', label: 'Back to Workouts' },
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
