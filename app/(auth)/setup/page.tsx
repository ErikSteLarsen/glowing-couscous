'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  dangerTextClassName,
  formLabelClassName,
  getSegmentedChoiceClassName,
  primaryButtonClassName,
  AuthPageShell,
  Surface,
  TopBar,
} from '@/components/ui';
import { getSafeShareCallbackPath } from '@/lib/share-link';

export default function SetupPage() {
  const [role, setRole] = useState<'COACH' | 'ATHLETE'>('ATHLETE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { update } = useSession();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const callbackUrl = readCallbackUrl();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
      return;
    }
    await update({ role });
    router.push(callbackUrl ?? (role === 'COACH' ? '/coach' : '/athlete'));
  }

  return (
    <AuthPageShell>
      <TopBar
        title="Choose your role"
        description="This sets how you use the app."
        align="center"
      />
      <Surface className="mx-auto w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="flex gap-3">
            <legend className={`${formLabelClassName} w-full`}>Account type</legend>
            {(['COACH', 'ATHLETE'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={getSegmentedChoiceClassName(role === r)}
              >
                {r === 'COACH' ? 'I am a coach' : 'I am an athlete'}
              </button>
            ))}
          </fieldset>
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
