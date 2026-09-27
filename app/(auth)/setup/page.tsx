'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  dangerTextClassName,
  primaryButtonClassName,
  AuthPageShell,
  Surface,
  TopBar,
} from '@/components/ui';
import { getSafeShareCallbackPath } from '@/lib/share-link';

export default function SetupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { update } = useSession();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const callbackUrl = readCallbackUrl();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ATHLETE' }),
      });
      if (!response.ok) {
        setError('We couldn’t finish setting up your workspace. Please try again.');
        return;
      }
      await update({ role: 'ATHLETE' });
      router.push(callbackUrl ?? '/athlete');
    } catch {
      setError('We couldn’t finish setting up your workspace. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell>
      <TopBar
        title="Your workspace is ready"
        description="Create, plan, complete, and review your training in one place."
        align="center"
      />
      <Surface className="mx-auto w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className={dangerTextClassName} role="alert">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={`${primaryButtonClassName} w-full`}
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </Surface>
    </AuthPageShell>
  );
}

function readCallbackUrl() {
  if (typeof window === 'undefined') return null;
  return getSafeShareCallbackPath(new URLSearchParams(window.location.search).get('callbackUrl'));
}
