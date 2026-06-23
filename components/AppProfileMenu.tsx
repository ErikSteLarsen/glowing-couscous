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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">{user.name}</p>
      <p className="mt-1 text-xs text-slate-400">{user.email}</p>
      <div className="mt-4 space-y-2">
        {profileActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            onClick={onNavigate}
            className="block rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            {action.label}
          </Link>
        ))}
        <SignOutButton />
      </div>
    </div>
  );
}
