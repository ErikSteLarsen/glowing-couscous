'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AuthPageShell, Surface, TopBar, formFieldClassName, formLabelClassName, primaryButtonClassName, dangerTextClassName, successTextClassName } from '@/components/ui';

export function PasswordResetClient({ token }: { token: string | null }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This reset link is missing or invalid. Request a new one to continue.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords don’t match. Check them and try again.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/password-reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? 'We couldn’t update your password. Request a new link and try again.');
        return;
      }
      window.history.replaceState({}, '', window.location.pathname);
      setComplete(true);
    } catch {
      setError('We couldn’t update your password. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell>
      <TopBar title="Choose a new password" description="Use at least 8 characters. This one-time link expires after 30 minutes." align="center" />
      <Surface className="mx-auto w-full max-w-md">
        {complete ? (
          <div className="space-y-4">
            <p role="status" className={successTextClassName}>Your password has been updated. Sign in with your new password.</p>
            <Link href="/login" className={`${primaryButtonClassName} w-full`}>Go to sign in</Link>
          </div>
        ) : !token ? (
          <div className="space-y-4">
            <p role="alert" className={dangerTextClassName}>This reset link is missing or invalid. Request a new one to continue.</p>
            <Link href="/forgot-password" className={`${primaryButtonClassName} w-full`}>Request a new link</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-password" className={formLabelClassName}>New password</label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={formFieldClassName}
              />
            </div>
            <div>
              <label htmlFor="reset-password-confirmation" className={formLabelClassName}>Confirm new password</label>
              <input
                id="reset-password-confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className={formFieldClassName}
              />
            </div>
            {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
            <button type="submit" disabled={loading} className={`${primaryButtonClassName} w-full`}>
              {loading ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        )}
      </Surface>
    </AuthPageShell>
  );
}
