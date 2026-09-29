import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';
import { isProfileActionActive, profileActions } from '@/lib/app-navigation';

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
    <div className="border-t border-[var(--nav-border)] px-2 pt-5">
      <p className="text-sm font-semibold text-[var(--nav-text)]">{user.name}</p>
      <p className="mt-1 truncate text-[11px] text-[var(--nav-muted)]">{user.email}</p>
      <div className="mt-4 space-y-1">
        {profileActions.map((action) => {
          const isActive = isProfileActionActive(pathname, action);

          return (
            <Link
              key={action.href}
              href={action.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={`relative block rounded-[10px] px-3 py-2 text-[12px] transition hover:bg-[var(--nav-active)] ${
                isActive ? 'bg-[var(--nav-active)] font-semibold text-[var(--nav-text)]' : 'text-[var(--nav-muted)]'
              }`}
            >
              {isActive ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--nav-signal)]" /> : null}
              {action.label}
            </Link>
          );
        })}
        {previewMode ? <p className="px-3 py-2 text-[12px] text-[var(--nav-muted)]">Sample workspace</p> : <SignOutButton size="compact" />}
      </div>
    </div>
  );
}
