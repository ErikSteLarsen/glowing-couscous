'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
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

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'COACH' | 'ATHLETE'>('ATHLETE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('Account created — please sign in.');
      router.push('/login');
    } else {
      router.push('/');
    }
  }

  return (
    <PageShell size="narrow" className="min-h-[calc(100vh-3rem)] justify-center">
      <TopBar eyebrow="Workout Planner" title="Create account" align="center" />
      <Surface className="mx-auto w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
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
          </div>
          <div>
            <label className={formLabelClassName}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              className={formFieldClassName}
            />
          </div>
          <div>
            <label className={formLabelClassName}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className={formFieldClassName}
            />
          </div>
          <div>
            <label className={formLabelClassName}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              className={formFieldClassName}
            />
          </div>
          {error && <p className={dangerTextClassName}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={`${primaryButtonClassName} w-full`}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-muted)]">or</span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className={`${secondaryButtonClassName} w-full`}
        >
          Continue with Google
        </button>
        <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
          Already have an account?{' '}
          <a href="/login" className="font-medium text-[var(--brand)] hover:text-[var(--text)]">
            Sign in
          </a>
        </p>
      </Surface>
    </PageShell>
  );
}
