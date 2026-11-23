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
  previewMode = false,
}: {
  user: { name: string; email: string };
  pathname: string;
  onNavigate?: () => void;
  previewMode?: boolean;
}) {
  return (
    <div className="border-t border-[var(--nav-border)] pt-3">
      <div className="flex items-center gap-2.5 px-1.5 py-1.5">
        <span
          aria-hidden="true"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--raised)] text-[11px] font-semibold text-[var(--text)]"
        >
          {initialsFor(user.name)}
        </span>
        <span className="min-w-0">
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
              className={`flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors md:min-h-9 ${buttonFocusClassName} ${
                isActive
                  ? 'bg-[var(--nav-active)] text-[var(--text)] hover:bg-[var(--selection)]'
                  : 'text-[var(--nav-muted)] hover:bg-[var(--nav-active)] hover:text-[var(--text)]'
              }`}
            >
              <Icon aria-hidden="true" size={16} strokeWidth={1.5} className={`shrink-0 ${isActive ? 'text-[var(--nav-signal)]' : ''}`} />
              <span>{action.label}</span>
            </Link>
          );
        })}
        {previewMode ? <p className="px-2.5 py-2 text-xs text-[var(--nav-muted)]">Sample account</p> : <SignOutButton size="compact" variant="menu" />}
      </div>
    </div>
  );
}
