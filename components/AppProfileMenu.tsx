import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';
import { isProfileActionActive, profileActions } from '@/lib/app-navigation';

export function AppProfileMenu({
  user,
  pathname,
  onNavigate,
}: {
  user: { name: string; email: string };
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--nav-border)] bg-[var(--nav-active)] p-4">
      <p className="text-sm font-semibold text-[var(--nav-text)]">{user.name}</p>
      <p className="mt-1 text-xs text-[var(--nav-muted)]">{user.email}</p>
      <div className="mt-4 space-y-2">
        {profileActions.map((action) => {
          const isActive = isProfileActionActive(pathname, action);

          return (
            <Link
              key={action.href}
              href={action.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={`relative block rounded-[10px] px-3 py-2 text-sm transition hover:bg-[var(--nav-active)] ${
                isActive ? 'bg-[var(--nav-active)] font-semibold text-[var(--nav-text)]' : 'text-[var(--nav-muted)]'
              }`}
            >
              {isActive ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--nav-signal)]" /> : null}
              {action.label}
            </Link>
          );
        })}
        <SignOutButton size="compact" />
      </div>
    </div>
  );
}
