'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  dangerTextClassName,
  formTextareaClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  successTextClassName,
  Surface,
} from '@/components/ui';

export function SessionDetailClient({
  sessionId,
  initialDone,
  initialNotes,
}: {
  sessionId: number;
  initialDone: boolean;
  initialNotes: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [isDone, setIsDone] = useState(initialDone);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isPending, startTransition] = useTransition();

  function save(nextDone: boolean) {
    setMessage('');
    setMessageTone('success');
    startTransition(async () => {
      const response = await fetch(`/api/athlete/sessions/${sessionId}/completion`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isDone: nextDone,
          notes,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to update completion' }));
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to update completion');
        return;
      }

      setIsDone(nextDone);
      setMessageTone('success');
      setMessage(nextDone ? 'Session marked complete.' : 'Session moved back to planned.');
      router.refresh();
    });
  }

  return (
    <Surface className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Completion
        </p>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
          Add a short note, then mark the session complete when you finish it.
        </p>
      </div>

      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        className={`${formTextareaClassName} min-h-28`}
        placeholder="How did the session feel?"
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => save(true)}
          disabled={isPending}
          className={primaryButtonClassName}
        >
          {isDone ? 'Update completion' : 'Mark complete'}
        </button>
        {isDone ? (
          <button
            type="button"
            onClick={() => save(false)}
            disabled={isPending}
            className={secondaryButtonClassName}
          >
            Mark planned again
          </button>
        ) : null}
      </div>

      {message ? <p className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}
    </Surface>
  );
}
