import Link from 'next/link';
import { Settings, UserRound } from 'lucide-react';
import { SignOutButton } from '@/components/SignOutButton';
import { buttonFocusClassName } from '@/components/ui';
import { isProfileActionActive, profileActions } from '@/lib/app-navigation';

const actionIcons = { Profile: UserRound, Settings } as const;

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : (parts[0]?.slice(0, 2) ?? '?');
  return letters.toUpperCase();
}

export function AppProfileMenu({
  user,
  pathname,
  onNavigate,
  compact = false,
}: {
  user: { name: string; email: string };
  pathname: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <div className="border-t border-[var(--nav-border)] pt-3">
      <div className="rail:justify-center flex items-center gap-2.5 px-1.5 py-1.5" title={compact ? `${user.name} · ${user.email}` : undefined}>
        <span
          aria-hidden="true"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--raised)] text-[11px] font-semibold text-[var(--text)]"
        >
          {initialsFor(user.name)}
        </span>
        <span className="rail:hidden min-w-0">
          <span className="block truncate text-sm text-[var(--text)]">{user.name}</span>
          <span className="block truncate text-xs text-[var(--text-muted)]">{user.email}</span>
        </span>
      </div>
      <div className="mt-1 space-y-0.5">
        {profileActions.map((action) => {
          const isActive = isProfileActionActive(pathname, action);
          const Icon = actionIcons[action.label];

          return (
            <Link
              key={action.href}
              href={action.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              aria-label={compact ? action.label : undefined}
              title={compact ? action.label : undefined}
              className={`rail:justify-center flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors md:min-h-9 ${buttonFocusClassName} ${
                isActive
                  ? 'bg-[var(--nav-active)] text-[var(--text)]'
                  : 'text-[var(--nav-muted)] hover:bg-[var(--nav-active)] hover:text-[var(--text)]'
              }`}
            >
              <Icon aria-hidden="true" size={16} strokeWidth={1.5} className={`shrink-0 ${isActive ? 'text-[var(--nav-signal)]' : ''}`} />
              <span className="rail:hidden">{action.label}</span>
            </Link>
          );
        })}
        <SignOutButton size="compact" variant="menu" />
      </div>
    </div>
  );
}
