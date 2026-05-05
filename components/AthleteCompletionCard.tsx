'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SessionCard } from '@/components/session-card';

type AthleteCompletionCardProps = {
  session: {
    id: number;
    title: string;
    summary: string | null;
    sportType: string;
    durationMinutes: number | null;
    intensity: string | null;
    scheduledDate: Date;
    blocks: Array<{
      id: number;
      blockType: string;
      title: string;
      instructions: string | null;
    }>;
    completion: {
      isDone: boolean;
      notes: string | null;
      completedAt: Date | null;
    } | null;
  };
};

export function AthleteCompletionCard({ session }: AthleteCompletionCardProps) {
  const router = useRouter();
  const [isDone, setIsDone] = useState(Boolean(session.completion?.isDone));
  const [notes, setNotes] = useState(session.completion?.notes ?? '');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  function saveCompletion() {
    setMessage('');
    startTransition(async () => {
      const response = await fetch(`/api/athlete/sessions/${session.id}/completion`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isDone, notes }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to save completion' }));
        setMessage(payload.error ?? 'Failed to save completion');
        return;
      }

      setMessage('Saved');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <SessionCard session={session} />
      <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-3 text-sm font-medium text-slate-200">
            <input
              type="checkbox"
              checked={isDone}
              onChange={(event) => setIsDone(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-transparent"
            />
            Mark session done
          </label>
        </div>
        <label className="mt-4 block space-y-2 text-sm text-slate-300">
          <span>Notes or adjustments</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-[#0f1729] px-4 py-3 text-white outline-none"
            placeholder="How did the session go? Did you adjust anything?"
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveCompletion}
            className="rounded-2xl bg-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white"
            disabled={isPending}
          >
            Save feedback
          </button>
          {message ? <p className="text-sm text-slate-300">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
