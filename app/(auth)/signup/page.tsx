'use client';
import { useEffect, useState } from 'react';
import { getProviders, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  AuthPageShell,
  Surface,
  TopBar,
} from '@/components/ui';
import { getSafeShareCallbackPath } from '@/lib/share-link';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    const callbackUrl = readCallbackUrl();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        if (response.status === 409) {
          setError('An account with this email already exists. Sign in below or use another email.');
          return;
        }
        setError(payload.error ?? 'We couldn’t create your account. Please try again.');
        return;
      }

      try {
        const result = await signIn('credentials', { email, password, redirect: false });
        if (result?.error) {
          setError('Your account was created, but automatic sign-in did not finish. Use the Sign in link to continue.');
          return;
        }
        router.push(callbackUrl ?? '/');
      } catch {
        setError('Your account was created, but automatic sign-in did not finish. Use the Sign in link to continue.');
      }
    } catch {
      setError('We couldn’t create your account. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell>
      <TopBar
        title="Create account"
        description="Plan, follow, and review your own training. You can start without a coach."
        align="center"
      />
      <Surface className="mx-auto w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="signup-name" className={formLabelClassName}>Name</label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
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
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password"
              aria-describedby="signup-password-hint"
              minLength={8}
              maxLength={72}
              required
              className={formFieldClassName}
            />
              <p id="signup-password-hint" className="mt-1.5 text-xs leading-5 text-[var(--text-secondary)]">Use 8–72 characters.</p>
          </div>
          {error && <p className={dangerTextClassName} role="alert">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={`${primaryButtonClassName} w-full`}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        {googleEnabled && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)]">or</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <button
              onClick={() => signIn('google', { callbackUrl: readCallbackUrl() ?? '/' })}
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
    </AuthPageShell>
  );
}

function readCallbackUrl() {
  if (typeof window === 'undefined') return null;
  return getSafeShareCallbackPath(new URLSearchParams(window.location.search).get('callbackUrl'));
}
