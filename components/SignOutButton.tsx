'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import {
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '@/components/ui';

type SignOutButtonProps = {
  tone?: 'primary' | 'secondary';
  size?: 'default' | 'compact';
};

export function SignOutButton({ tone = 'secondary', size = 'default' }: SignOutButtonProps) {
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
          size === 'compact'
            ? tone === 'primary'
              ? compactPrimaryButtonClassName
              : compactSecondaryButtonClassName
            : tone === 'primary'
              ? primaryButtonClassName
              : secondaryButtonClassName
        }
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
      {errorMessage ? <p className="text-xs text-[#B45516]">{errorMessage}</p> : null}
    </div>
  );
}
