'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { clearClientRecovery } from '@/lib/client-recovery-cleanup';
import { SignOutButton } from '@/components/SignOutButton';
import { AccountDeletionControls } from '@/components/AccountDeletionControls';
import { secondaryButtonClassName, sectionHeadingClassName } from '@/components/ui';

type Controls = { email: string; hasPassword: boolean; providers: string[]; strava: { connected: boolean; athleteName: string | null } };

export function AccountControls({ userId, controls }: { userId: number; controls: Controls }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function endSessions() {
    if (!window.confirm('Sign out on all devices? Unsaved drafts in this browser will be removed.')) return;
    setPending(true); setError('');
    let revoked = false;
    try {
      const response = await fetch('/api/account/sessions', { method: 'DELETE' });
      if (!response.ok) throw new Error('request failed');
      revoked = true;
      clearClientRecovery(userId);
      await signOut({ redirect: false });
      window.location.assign('/login');
    } catch {
      if (revoked) { window.location.assign('/login'); return; }
      setPending(false); setError('Could not sign out everywhere. Please try again.');
    }
  }

  return <section aria-labelledby="account-heading" className="mt-8 space-y-5 border-t border-[var(--border)] pt-6">
    <div><h2 id="account-heading" className={sectionHeadingClassName}>Account</h2><p className="mt-2 text-sm text-[var(--text-secondary)]">Manage how you sign in and which services can access your account.</p></div>
    <dl className="space-y-4 text-sm">
      <div><dt className="text-[var(--text-secondary)]">Email</dt><dd className="mt-1 break-all">{controls.email}</dd></div>
      <div><dt className="text-[var(--text-secondary)]">Sign-in methods</dt><dd className="mt-1">{[...(controls.hasPassword ? ['Email and password'] : []), ...controls.providers.map((provider) => provider === 'google' ? 'Google' : provider)].join(', ') || 'No sign-in method available'}</dd></div>
      <div><dt className="text-[var(--text-secondary)]">Strava</dt><dd className="mt-1">{controls.strava.connected ? `Connected${controls.strava.athleteName ? ` as ${controls.strava.athleteName}` : ''}` : 'Not connected'}</dd></div>
    </dl>
    <div className="flex flex-wrap gap-3">
      {controls.hasPassword ? <Link href="/forgot-password" className={secondaryButtonClassName}>Reset password</Link> : null}
      <Link href="/athlete/import#strava" className={secondaryButtonClassName}>Manage Strava access</Link>
    </div>
    <p className="text-sm text-[var(--text-secondary)]">Disconnecting Strava removes its imported outcomes from Tempo and restores matched planned sessions. Review the connection controls before disconnecting.</p>
    <div className="flex flex-wrap items-start gap-3"><SignOutButton /><button type="button" disabled={pending} onClick={endSessions} className={secondaryButtonClassName}>{pending ? 'Signing out everywhere…' : 'Sign out everywhere'}</button></div>
    <p className="text-sm text-[var(--text-secondary)]">Signing out removes drafts kept in this browser. Signing out everywhere also invalidates other devices’ sessions when they next access Tempo.</p>
    {error ? <p role="alert" className="text-sm text-[var(--status-danger)]">{error}</p> : null}
    <AccountDeletionControls userId={userId} email={controls.email} hasPassword={controls.hasPassword} hasGoogle={controls.providers.includes('google')} />
  </section>;
}
