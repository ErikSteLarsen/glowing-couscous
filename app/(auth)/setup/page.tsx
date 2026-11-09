'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  dangerTextClassName,
  formLabelClassName,
  getSegmentedChoiceClassName,
  primaryButtonClassName,
  PageShell,
  Surface,
  TopBar,
} from '@/components/ui';
import { getSafeShareCallbackPath } from '@/lib/share-link';

export default function SetupPage() {
  const [role, setRole] = useState<'COACH' | 'ATHLETE'>('ATHLETE');
  const [loading, setLoading] = useState(false);
  const [savedRole, setSavedRole] = useState<'COACH' | 'ATHLETE' | null>(null);
  const [error, setError] = useState('');
  const { update } = useSession();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const callbackUrl = readCallbackUrl();
    const submittedRole = savedRole ?? role;
    setLoading(true);
    setError('');
    let roleSaved = savedRole !== null;
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: submittedRole }),
      });
      if (!res.ok) {
        setError('Could not save your role. Try again or sign in again.');
        return;
      }
      roleSaved = true;
      setSavedRole(submittedRole);
      const session = await update({ role: submittedRole });
      if (session?.user.role !== submittedRole) {
        setError('Your role was saved. Try again to finish signing in.');
        return;
      }
      router.push(callbackUrl ?? (submittedRole === 'COACH' ? '/coach' : '/athlete'));
    } catch {
      setError(roleSaved
        ? 'Your role was saved. Check your connection and try again to finish signing in.'
        : 'Could not save your role. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell size="narrow" className="mx-auto min-h-[calc(100vh-7rem)] justify-center">
      <TopBar
        title="Choose your role"
        description="Plan your own training, or manage athletes as a coach."
        align="center"
      />
      <Surface className="mx-auto w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={loading || savedRole !== null} className="flex gap-3">
            <legend className={`${formLabelClassName} w-full`}>Account type</legend>
            {(['ATHLETE', 'COACH'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={getSegmentedChoiceClassName(role === r)}
              >
                {r === 'COACH' ? 'I am a coach' : 'I plan my training'}
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
    </PageShell>
  );
}

function readCallbackUrl() {
  if (typeof window === 'undefined') return null;
  return getSafeShareCallbackPath(new URLSearchParams(window.location.search).get('callbackUrl'));
}
