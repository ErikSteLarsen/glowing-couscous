'use client';

import { useId, useState } from 'react';
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
import type { PerformanceProfile } from '@/lib/performance-profile';

type Account = {
  id: number;
  name: string | null;
  email: string | null;
  role: string | null;
  performanceProfile: PerformanceProfile;
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
  const [performanceProfile, setPerformanceProfile] = useState(account.performanceProfile);
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
      body: JSON.stringify({ name, performanceProfile }),
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
            <label htmlFor="profile-display-name" className={formLabelClassName}>Display name</label>
            <input
              id="profile-display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={formFieldClassName}
            />
          </div>
           <div className="rounded-[12px] border border-[var(--field-border)] bg-[var(--field-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            <p>Email: {account.email}</p>
            <p>Role: {account.role}</p>
           </div>
           {account.role === 'ATHLETE' ? <fieldset className="space-y-4 border-t border-[var(--border)] pt-5"><legend className="text-base font-semibold text-[var(--text)]">Training metrics</legend><p className="text-sm text-[var(--text-secondary)]">These current values resolve relative workout previews. They are never copied into workouts or shared links.</p><div className="grid gap-3 sm:grid-cols-2"><MetricInput label="Cycling FTP (W)" value={performanceProfile.cycling.ftpWatts} onChange={(ftpWatts) => setPerformanceProfile((current) => ({ ...current, cycling: { ...current.cycling, ftpWatts } }))} /><MetricInput label="Cycling threshold HR (bpm)" value={performanceProfile.cycling.thresholdHrBpm} onChange={(thresholdHrBpm) => setPerformanceProfile((current) => ({ ...current, cycling: { ...current.cycling, thresholdHrBpm } }))} /><MetricInput label="Running threshold pace (sec/km)" value={performanceProfile.running.thresholdPaceSecPerKm} onChange={(thresholdPaceSecPerKm) => setPerformanceProfile((current) => ({ ...current, running: { ...current.running, thresholdPaceSecPerKm } }))} /><MetricInput label="Running threshold HR (bpm)" value={performanceProfile.running.thresholdHrBpm} onChange={(thresholdHrBpm) => setPerformanceProfile((current) => ({ ...current, running: { ...current.running, thresholdHrBpm } }))} /><MetricInput label="Swimming CSS (sec/100 m)" value={performanceProfile.swimming.cssSecPer100m} onChange={(cssSecPer100m) => setPerformanceProfile((current) => ({ ...current, swimming: { ...current.swimming, cssSecPer100m } }))} /><MetricInput label="Swimming threshold HR (bpm)" value={performanceProfile.swimming.thresholdHrBpm} onChange={(thresholdHrBpm) => setPerformanceProfile((current) => ({ ...current, swimming: { ...current.swimming, thresholdHrBpm } }))} /></div></fieldset> : null}
          {error && <p role="alert" className={dangerTextClassName}>{error}</p>}
          {message && <p role="status" className={successTextClassName}>{message}</p>}
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

function MetricInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  const inputId = useId();
  return <div className="block space-y-2"><label htmlFor={inputId} className={formLabelClassName}>{label}</label><input id={inputId} className={formFieldClassName} type="number" min="1" step="0.01" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} /></div>;
}
