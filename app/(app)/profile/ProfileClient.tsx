'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Surface } from '@/components/ui';

type Account = {
  id: number;
  name: string | null;
  email: string | null;
  role: string | null;
};

type AthleteState = {
  profile: { id: number } | null;
  latestRequest: {
    status: string;
    coach: { name: string | null };
  } | null;
} | null;

export function ProfileClient({
  account,
  athleteState,
}: {
  account: Account;
  athleteState: AthleteState;
}) {
  const [name, setName] = useState(account.name ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { update } = useSession();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: 'Could not save profile' }));
      setError(payload.error ?? 'Could not save profile');
      setSaving(false);
      return;
    }

    await update();
    router.refresh();
    setMessage('Profile updated.');
    setSaving(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Surface>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <p>Email: {account.email}</p>
            <p>Role: {account.role}</p>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </Surface>
      <Surface>
        {athleteState !== null ? (
          athleteState.latestRequest?.status === 'PENDING' ? (
            <p className="text-sm text-slate-300">
              Request pending: Waiting for {athleteState.latestRequest.coach.name} to accept your
              request.
            </p>
          ) : athleteState.latestRequest?.status === 'REJECTED' ? (
            <p className="text-sm text-slate-300">
              {athleteState.latestRequest.coach.name} declined your last request. You can retry or
              find a different coach.
            </p>
          ) : athleteState.profile ? (
            <p className="text-sm text-slate-300">You have an active coach.</p>
          ) : (
            <p className="text-sm text-slate-300">
              You don&apos;t have a coach yet. Find a coach to get your weekly training plan.
            </p>
          )
        ) : (
          <p className="text-sm text-slate-300">
            Coach profile details will expand here later.
          </p>
        )}
      </Surface>
    </div>
  );
}
