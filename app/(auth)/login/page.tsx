'use client';
import { useEffect, useState } from 'react';
import { getProviders, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { getSafeCallbackPath } from '@/lib/auth-callback';

export default function LoginPage() {
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
    if (loading) return;
    const callbackUrl = readCallbackUrl();
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false });
      if (result?.error) {
        setError('Invalid email or password. Check your details and try again.');
        return;
      }
      router.push(callbackUrl ?? '/');
    } catch {
      setError('We couldn’t sign you in. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell>
      <TopBar title="Sign in" align="center" />
      <Surface className="mx-auto w-full max-w-md">
        <div className="mb-5 rounded-xl border border-[var(--status-planned-border)] bg-[var(--brand-tint)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text)]">Demo athlete</p>
          <p className="mt-1">Use <span className="font-medium">mara@demo.local</span> with password <span className="font-medium">demo1234</span>.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className={formLabelClassName}>Email</label>
            <input
              id="login-email"
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
            <label htmlFor="login-password" className={formLabelClassName}>Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={formFieldClassName}
            />
            <p className="mt-2 text-right text-sm">
              <Link href="/forgot-password" className="font-medium text-[var(--brand)] underline-offset-4 hover:underline">Forgot password?</Link>
            </p>
          </div>
          {error && <p className={dangerTextClassName} role="alert">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={`${primaryButtonClassName} w-full`}
          >
            {loading ? 'Signing in…' : 'Sign in'}
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
              disabled={loading}
              className={`${secondaryButtonClassName} w-full`}
            >
              Continue with Google
            </button>
          </>
        )}
        <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
          No account?{' '}
           <a
             href="/signup"
             onClick={(event) => {
               const callbackUrl = readCallbackUrl();
               if (!callbackUrl) return;
               event.preventDefault();
               router.push(`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`);
             }}
             className="font-medium text-[var(--brand)] hover:text-[var(--text)]"
           >
            Sign up
          </a>
        </p>
      </Surface>
    </AuthPageShell>
  );
}

function readCallbackUrl() {
  if (typeof window === 'undefined') return null;
  return getSafeCallbackPath(new URLSearchParams(window.location.search).get('callbackUrl'));
}
