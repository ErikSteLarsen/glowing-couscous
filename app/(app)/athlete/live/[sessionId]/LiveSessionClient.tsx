'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  dangerTextClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  primaryButtonClassName,
  successTextClassName,
} from '@/components/ui';
import { Stepper } from '@/components/tempo/Stepper';
import {
  advanceExecution,
  createExecutionState,
  isExecutionComplete,
  previousExecution,
  restartExecution,
  type ExecutionState,
} from '@/lib/athlete-execution';
import { formatDuration } from '@/lib/format-duration';

type LiveBlock = {
  id: number;
  label: string;
  durationSec: number;
  targetLabel: string | null;
  note: string | null;
};

export function LiveSessionClient({ sessionId, blocks }: { sessionId: number; blocks: LiveBlock[] }) {
  const router = useRouter();
  const [state, setState] = useState<ExecutionState>(() => createExecutionState(blocks.length));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const hasBlocks = blocks.length > 0;
  const complete = hasBlocks && isExecutionComplete(state);

  async function completeSession() {
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/athlete/sessions/${sessionId}/completion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDone: true, notes: '' }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Failed to complete session.');
        return;
      }
      setMessage('Session marked complete.');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Stepper
        items={blocks.map((block, index) => ({
          id: block.id,
          title: `${block.label} · ${formatDuration(block.durationSec)}`,
          detail: [block.targetLabel, block.note].filter(Boolean).join(' · ') || 'Stay smooth and controlled.',
          active: index === state.currentIndex && !complete,
          done: state.completed[index],
        }))}
      />
      {blocks.length === 0 ? <p role="alert" className={dangerTextClassName}>No workout blocks are available for this session.</p> : null}
      {hasBlocks ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            aria-label="Previous block"
             className={compactSecondaryButtonClassName}
            disabled={pending || state.currentIndex === 0}
            onClick={() => setState(previousExecution)}
          >
            Previous
          </button>
          {!complete ? (
            <button
              type="button"
              aria-label="Next block"
               className={compactPrimaryButtonClassName}
              disabled={pending}
              onClick={() => setState(advanceExecution)}
            >
              Next block
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Restart workout"
             className={compactSecondaryButtonClassName}
            disabled={pending || state.completed.every((value) => !value) && state.currentIndex === 0}
            onClick={() => setState(restartExecution)}
          >
            Restart
          </button>
        </div>
      ) : null}
      {complete ? (
        <p role="status" className="text-sm font-semibold text-[var(--text)]">All blocks complete. Save the outcome to finish.</p>
      ) : null}
      {complete ? (
        <button type="button" className={primaryButtonClassName} disabled={pending} onClick={() => void completeSession()}>
          {pending ? 'Saving…' : 'Mark session complete'}
        </button>
      ) : null}
      <p className="text-[12px] text-[var(--text-secondary)]">Progress is local to this device and restarts if you refresh.</p>
      {message ? <p role="status" aria-live="polite" className={successTextClassName}>{message}</p> : null}
      {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
    </div>
  );
}
