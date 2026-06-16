'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

type SignOutButtonProps = {
  tone?: 'primary' | 'secondary';
};

export function SignOutButton({ tone = 'secondary' }: SignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage('');

    try {
      await signOut({ callbackUrl: '/login' });
    } catch {
      setIsSigningOut(false);
      setErrorMessage('Could not sign out. Please try again.');
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className={
          tone === 'primary'
            ? 'cursor-pointer rounded-2xl bg-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(59,90,245,0.35)] transition hover:bg-[var(--brand)] disabled:opacity-60'
            : 'cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-60'
        }
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
      {errorMessage ? <p className="text-xs text-amber-300">{errorMessage}</p> : null}
    </div>
  );
}
