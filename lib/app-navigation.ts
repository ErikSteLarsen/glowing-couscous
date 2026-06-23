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
    return [
      { label: 'Dashboard', href: '/coach', matchPrefix: '/coach' },
      { label: 'Templates', href: '/coach/templates', matchPrefix: '/coach/templates' },
    ];
  }

  return [
    { label: 'Week plan', href: '/athlete', matchPrefix: '/athlete' },
    ...(hasActiveCoach
      ? []
      : [{ label: 'Coach discovery', href: '/athlete/find-coach', matchPrefix: '/athlete/find-coach' }]),
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
