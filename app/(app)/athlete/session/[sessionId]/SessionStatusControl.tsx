'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { dangerTextClassName, successTextClassName } from '@/components/ui';

export type SessionStatusAction = 'skip' | 'plan-again';

/** Skips an open session or plans a skipped one again, with feedback for the page. */
export function useSessionStatusAction(sessionId: number) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isPending, startTransition] = useTransition();

  function run(action: SessionStatusAction) {
    setMessage('');
    setMessageTone('success');
    startTransition(async () => {
      try {
        const response = await fetch(`/api/athlete/planner/sessions/${sessionId}/${action}`, { method: 'POST' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: 'Failed to update session status' }));
          setMessageTone('danger');
          setMessage(payload.error ?? 'Failed to update session status');
          return;
        }

        setMessageTone('success');
        setMessage(action === 'skip'
          ? 'Session skipped. It no longer counts as planned or completed.'
          : 'Session planned again. It counts toward your planned load.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  return { run, isPending, message, messageTone };
}

export function SessionStatusMessage({ status }: { status: ReturnType<typeof useSessionStatusAction> }) {
  if (!status.message) return null;
  return (
    <p role={status.messageTone === 'success' ? 'status' : 'alert'} aria-live="polite" className={status.messageTone === 'success' ? successTextClassName : dangerTextClassName}>
      {status.message}
    </p>
  );
}
