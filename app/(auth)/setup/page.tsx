'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell, Surface, TopBar } from '@/components/ui';

export default function SetupPage() {
  const [role, setRole] = useState<'COACH' | 'ATHLETE'>('ATHLETE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { update } = useSession();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    router.push(role === 'COACH' ? '/coach' : '/athlete');
  }

  return (
    <PageShell size="narrow" className="min-h-[calc(100vh-3rem)] justify-center">
      <TopBar
        eyebrow="Almost there"
        title="Choose your role"
        description="This sets how you use the app."
        align="center"
      />
      <Surface className="mx-auto w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            {(['COACH', 'ATHLETE'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  role === r
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {r === 'COACH' ? 'I am a coach' : 'I am an athlete'}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </Surface>
    </PageShell>
  );
}
