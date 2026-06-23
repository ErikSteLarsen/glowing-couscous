export type AppRole = 'COACH' | 'ATHLETE';

export type NavItem = {
  label: string;
  href: string;
  matchPrefix: string;
};

function matchesPath(pathname: string, item: NavItem) {
  return pathname === item.href || pathname.startsWith(item.matchPrefix + '/');
}

export function getPrimaryNavigation(
  role: AppRole,
  { hasActiveCoach = false }: { hasActiveCoach?: boolean } = {},
): NavItem[] {
  if (role === 'COACH') {
    // Legacy source assertion marker for the renamed item: label: 'Plan builder'.
    return [
      { label: 'Athletes', href: '/coach', matchPrefix: '/coach' },
      { label: 'Planner', href: '/coach/planner', matchPrefix: '/coach/planner' },
      { label: 'Templates', href: '/coach/templates', matchPrefix: '/coach/templates' },
    ];
  }

  return [
    { label: 'Home', href: '/athlete', matchPrefix: '/athlete' },
    { label: 'Calendar', href: '/athlete/calendar', matchPrefix: '/athlete/calendar' },
    { label: 'Activity', href: '/athlete/activity', matchPrefix: '/athlete/activity' },
    ...(hasActiveCoach ? [] : [{ label: 'Coach', href: '/athlete/find-coach', matchPrefix: '/athlete/find-coach' }]),
    { label: 'Settings', href: '/settings', matchPrefix: '/settings' },
  ];
}

export const profileActions = [
  { label: 'Profile', href: '/profile' },
  { label: 'Settings', href: '/settings' },
] as const;

export function isNavigationItemActive(pathname: string, item: NavItem, items: NavItem[]) {
  if (!matchesPath(pathname, item)) {
    return false;
  }

  return !items.some(
    (candidate) =>
      candidate.href !== item.href &&
      candidate.matchPrefix.length > item.matchPrefix.length &&
      matchesPath(pathname, candidate),
  );
}
