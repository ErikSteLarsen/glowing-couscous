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
            ? 'cursor-pointer rounded-[10px] bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60'
            : 'cursor-pointer rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[#FBFAF7] disabled:opacity-60'
        }
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
      {errorMessage ? <p className="text-xs text-[#B45516]">{errorMessage}</p> : null}
    </div>
  );
}
