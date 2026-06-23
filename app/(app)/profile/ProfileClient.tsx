'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ActionLink,
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  primaryButtonClassName,
  successTextClassName,
  Surface,
} from '@/components/ui';

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
            <label className={formLabelClassName}>Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={formFieldClassName}
            />
          </div>
          <div className="rounded-[12px] border border-[var(--field-border)] bg-[var(--field-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            <p>Email: {account.email}</p>
            <p>Role: {account.role}</p>
          </div>
          {error && <p className={dangerTextClassName}>{error}</p>}
          {message && <p className={successTextClassName}>{message}</p>}
          <button
            type="submit"
            disabled={saving}
            className={primaryButtonClassName}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </Surface>
      <Surface>
        {athleteState !== null ? (
          athleteState.latestRequest?.status === 'PENDING' ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Request pending: Waiting for {athleteState.latestRequest.coach.name} to accept your request.
              </p>
              <ActionLink href="/athlete/find-coach" tone="secondary">Open coach discovery</ActionLink>
            </div>
          ) : athleteState.latestRequest?.status === 'REJECTED' ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {athleteState.latestRequest.coach.name} declined your last request. You can retry or find a different coach.
              </p>
              <ActionLink href="/athlete/find-coach" tone="secondary">Find a coach</ActionLink>
            </div>
          ) : athleteState.profile ? (
            <p className="text-sm text-[var(--text-secondary)]">You have an active coach.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                You don&apos;t have a coach yet. Find a coach to get your weekly training plan.
              </p>
              <ActionLink href="/athlete/find-coach" tone="secondary">Find a coach</ActionLink>
            </div>
          )
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            Coach profile details will expand here later.
          </p>
        )}
      </Surface>
    </div>
  );
}
