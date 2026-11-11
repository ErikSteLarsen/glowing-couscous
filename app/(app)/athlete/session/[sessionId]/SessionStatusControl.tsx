'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  dangerTextClassName,
  secondaryButtonClassName,
  successTextClassName,
} from '@/components/ui';

export function SessionStatusControl({
  sessionId,
  action,
}: {
  sessionId: number;
  action: 'skip' | 'plan-again' | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isPending, startTransition] = useTransition();

  if (!action) return null;

  const isSkip = action === 'skip';
  const endpoint = `/api/athlete/planner/sessions/${sessionId}/${isSkip ? 'skip' : 'plan-again'}`;

  function runAction() {
    setMessage('');
    setMessageTone('success');
    startTransition(async () => {
      try {
        const response = await fetch(endpoint, { method: 'POST' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: 'Failed to update session status' }));
          setMessageTone('danger');
          setMessage(payload.error ?? 'Failed to update session status');
          return;
        }

        setMessageTone('success');
        setMessage(isSkip ? 'Session skipped.' : 'Session planned again.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  return (
    <div className="space-y-2 border-t border-[var(--border)] pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={`${secondaryButtonClassName} min-h-11`} onClick={runAction} disabled={isPending}>
          {isPending ? 'Saving...' : isSkip ? 'Skip session' : 'Plan again'}
        </button>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {isSkip
            ? 'Skipped sessions are not counted as planned or completed.'
            : 'Planning this session again returns it to your planned load.'}
        </p>
      </div>
      {message ? (
        <p role={messageTone === 'success' ? 'status' : 'alert'} aria-live="polite" className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
