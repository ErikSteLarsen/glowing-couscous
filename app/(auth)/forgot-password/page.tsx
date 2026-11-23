'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AuthPageShell, Surface, TopBar, formFieldClassName, formLabelClassName, primaryButtonClassName, dangerTextClassName, successTextClassName } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) {
        setError(result.error ?? 'We couldn’t send a reset link. Try again later.');
        return;
      }
      setMessage(result.message ?? 'If this email has a Tempo password, we’ll send you a reset link shortly.');
    } catch {
      setError('We couldn’t send a reset link. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell>
      <TopBar title="Reset your password" description="If you sign in with an email and password, we’ll email you a link to set a new one." align="center" />
      <Surface className="mx-auto w-full max-w-md">
        {message ? (
          <div className="space-y-4">
            <p role="status" className={successTextClassName}>{message}</p>
            <p className="text-sm text-[var(--text-secondary)]">The link expires after 30 minutes. If it doesn’t arrive, check your spam folder or request another.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="recovery-email" className={formLabelClassName}>Email</label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className={formFieldClassName}
              />
            </div>
            {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
            <button type="submit" disabled={loading} className={`${primaryButtonClassName} w-full`}>
              {loading ? 'Sending link…' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
          Remembered it? <Link href="/login" className="font-medium text-[var(--brand)] underline-offset-4 hover:underline">Sign in</Link>
        </p>
      </Surface>
    </AuthPageShell>
  );
}
