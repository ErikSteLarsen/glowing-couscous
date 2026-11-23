'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { clearClientRecovery, loadSignedOutDocument } from '@/lib/client-recovery-cleanup';
import { SignOutButton } from '@/components/SignOutButton';
import { AccountDeletionControls } from '@/components/AccountDeletionControls';
import { dangerTextClassName, secondaryButtonClassName, sectionHeadingClassName } from '@/components/ui';

type Controls = { email: string; hasPassword: boolean; providers: string[]; strava: { connected: boolean; athleteName: string | null } };

export function AccountControls({ userId, controls }: { userId: number; controls: Controls }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function endSessions() {
    if (!window.confirm('Sign out on all devices? Unsaved changes on this device will be deleted.')) return;
    setPending(true); setError('');
    let revoked = false;
    try {
      const response = await fetch('/api/account/sessions', { method: 'DELETE' });
      if (!response.ok) throw new Error('request failed');
      revoked = true;
      clearClientRecovery(userId);
      await signOut({ redirect: false });
      loadSignedOutDocument('/login');
    } catch {
      if (revoked) { loadSignedOutDocument('/login'); return; }
      setPending(false); setError('Could not sign out everywhere. Try again.');
    }
  }

  return <section aria-labelledby="account-heading" className="mt-8 space-y-5 border-t border-[var(--border)] pt-6">
    <div><h2 id="account-heading" className={sectionHeadingClassName}>Account</h2><p className="mt-2 text-sm text-[var(--text-secondary)]">How you sign in, and which apps are connected to your account.</p></div>
    <dl className="space-y-4 text-sm">
      <div><dt className="text-[var(--text-secondary)]">Email</dt><dd className="mt-1 break-all">{controls.email}</dd></div>
      <div><dt className="text-[var(--text-secondary)]">Sign-in methods</dt><dd className="mt-1">{[...(controls.hasPassword ? ['Email and password'] : []), ...controls.providers.map((provider) => provider === 'google' ? 'Google' : provider)].join(', ') || 'None'}</dd></div>
      <div><dt className="text-[var(--text-secondary)]">Strava</dt><dd className="mt-1">{controls.strava.connected ? `Connected${controls.strava.athleteName ? ` as ${controls.strava.athleteName}` : ''}` : 'Not connected'}</dd></div>
    </dl>
    <div className="flex flex-wrap gap-3">
      {controls.hasPassword ? <Link href="/forgot-password" className={secondaryButtonClassName}>Reset password</Link> : null}
      <Link href="/athlete/import?from=profile#strava" className={secondaryButtonClassName}>Manage Strava access</Link>
    </div>
    <p className="text-sm text-[var(--text-secondary)]">Disconnecting Strava removes the activities you imported from it. Planned workouts they were matched to go back to how they were.</p>
    <div className="flex flex-wrap items-start gap-3"><SignOutButton /><button type="button" disabled={pending} onClick={endSessions} className={secondaryButtonClassName}>{pending ? 'Signing out everywhere…' : 'Sign out everywhere'}</button></div>
    <p className="text-sm text-[var(--text-secondary)]">Signing out deletes unsaved changes on this device. Sign out everywhere also signs out your other devices the next time they open Tempo.</p>
    {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
    <AccountDeletionControls userId={userId} email={controls.email} hasPassword={controls.hasPassword} hasGoogle={controls.providers.includes('google')} />
  </section>;
}
