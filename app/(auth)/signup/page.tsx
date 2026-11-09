'use client';
import { useEffect, useState } from 'react';
import { getProviders, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  getSegmentedChoiceClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  PageShell,
  Surface,
  TopBar,
} from '@/components/ui';
import { getSafeShareCallbackPath } from '@/lib/share-link';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'COACH' | 'ATHLETE'>('ATHLETE');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'creating' | 'signing-in' | 'created'>('idle');
  const loading = status === 'creating' || status === 'signing-in';
  const accountCreated = status === 'created';
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    getProviders()
      .then((providers) => {
        if (active) setGoogleEnabled(Boolean(providers?.google));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || accountCreated) return;
    const callbackUrl = readCallbackUrl();
    setStatus('creating');
    setError('');
    let created = false;
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        setError(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Could not create your account. Try again.');
        return;
      }
      created = true;
      setStatus('signing-in');
      const result = await signIn('credentials', { email, password, redirect: false });
      if (!result?.ok || result.error) {
        setError('Your account is ready. Sign in to continue.');
        return;
      }
      router.push(callbackUrl ?? '/');
    } catch {
      setError(created
        ? 'Your account is ready, but automatic sign-in failed. Sign in to continue.'
        : 'Could not create your account. Check your connection and try again.');
    } finally {
      setStatus(created ? 'created' : 'idle');
    }
  }

  async function continueWithGoogle() {
    if (loading || accountCreated) return;
    setStatus('signing-in');
    setError('');
    try {
      await signIn('google', { callbackUrl: readCallbackUrl() ?? '/' });
    } catch {
      setError('Could not start Google sign-in. Check your connection and try again.');
    } finally {
      setStatus('idle');
    }
  }

  const callbackUrl = accountCreated ? readCallbackUrl() : null;
  const signInHref = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login';

  return (
    <PageShell size="narrow" className="mx-auto min-h-[calc(100vh-7rem)] justify-center">
      <TopBar title="Create account" align="center" />
      <Surface className="mx-auto w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={loading || accountCreated} className="flex gap-3">
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
          <div>
            <label htmlFor="signup-name" className={formLabelClassName}>Name</label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              disabled={loading || accountCreated}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              className={formFieldClassName}
            />
          </div>
          <div>
            <label htmlFor="signup-email" className={formLabelClassName}>Email</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="username"
              disabled={loading || accountCreated}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className={formFieldClassName}
            />
          </div>
          <div>
            <label htmlFor="signup-password" className={formLabelClassName}>Password</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              disabled={loading || accountCreated}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              className={formFieldClassName}
            />
          </div>
          {error && <p className={dangerTextClassName} role="alert">{error}</p>}
          {accountCreated ? (
            <a
              href={signInHref}
              className={`${primaryButtonClassName} w-full`}
            >
              Sign in
            </a>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className={`${primaryButtonClassName} w-full`}
            >
              {status === 'signing-in' ? 'Signing in…' : loading ? 'Creating account…' : 'Create account'}
            </button>
          )}
        </form>
        {googleEnabled && !accountCreated && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)]">or</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <button
              onClick={() => void continueWithGoogle()}
              disabled={loading}
              className={`${secondaryButtonClassName} w-full`}
            >
              Continue with Google
            </button>
          </>
        )}
        <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
          Already have an account?{' '}
           <a
             href="/login"
             onClick={(event) => {
               const callbackUrl = readCallbackUrl();
               if (!callbackUrl) return;
               event.preventDefault();
               router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
             }}
             className="font-medium text-[var(--brand)] hover:text-[var(--text)]"
           >
            Sign in
          </a>
        </p>
      </Surface>
    </PageShell>
  );
}

function readCallbackUrl() {
  if (typeof window === 'undefined') return null;
  return getSafeShareCallbackPath(new URLSearchParams(window.location.search).get('callbackUrl'));
}
