'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { parseApplicationUserId } from '@/lib/auth-principal';
import { clearClientRecovery } from '@/lib/client-recovery-cleanup';
import {
  buttonFocusClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '@/components/ui';

type SignOutButtonProps = {
  tone?: 'primary' | 'secondary';
  size?: 'default' | 'compact';
  /** `menu` renders as a sidebar row that collapses to its icon on the rail. */
  variant?: 'button' | 'menu';
};

export function SignOutButton({ tone = 'secondary', size = 'default', variant = 'button' }: SignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { data: session } = useSession();

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage('');

    try {
      await signOut({ redirect: false });
      const userId = parseApplicationUserId(session?.user?.id);
      if (userId !== null) clearClientRecovery(userId);
      window.location.assign('/login');
    } catch {
      setIsSigningOut(false);
      setErrorMessage('Could not sign out. Please try again.');
    }
  }

  if (variant === 'menu') {
    return (
      <div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          title="Sign out"
          className={`rail:justify-center flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-[var(--nav-muted)] transition-colors hover:bg-[var(--nav-active)] hover:text-[var(--text)] disabled:opacity-50 md:min-h-9 ${buttonFocusClassName}`}
        >
          <LogOut aria-hidden="true" size={16} strokeWidth={1.5} className="shrink-0" />
          <span className="rail:sr-only">{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
        {errorMessage ? <p role="alert" className="px-2.5 text-xs text-[var(--status-danger)]">{errorMessage}</p> : null}
      </div>
    );
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
      {errorMessage ? <p role="alert" className="text-xs text-[var(--status-danger)]">{errorMessage}</p> : null}
    </div>
  );
}
