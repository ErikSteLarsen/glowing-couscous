import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';
import { profileActions } from '@/lib/app-navigation';

export function AppProfileMenu({
  user,
  onNavigate,
}: {
  user: { name: string; email: string };
  onNavigate?: () => void;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[#FBFAF7] p-4">
      <p className="text-sm font-semibold text-[var(--text)]">{user.name}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{user.email}</p>
      <div className="mt-4 space-y-2">
        {profileActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            onClick={onNavigate}
            className="block rounded-[10px] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface)]"
          >
            {action.label}
          </Link>
        ))}
        <SignOutButton size="compact" />
      </div>
    </div>
  );
}
