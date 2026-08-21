'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  dangerTextClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
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
  const complete = isExecutionComplete(state);

  async function completeSession() {
    setPending(true);
    setError('');
    const response = await fetch(`/api/athlete/sessions/${sessionId}/completion`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone: true, notes: '' }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? 'Failed to complete session.');
      return;
    }
    setMessage('Session marked complete.');
    router.refresh();
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
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          aria-label="Previous block"
          className={secondaryButtonClassName}
          disabled={pending || state.currentIndex === 0}
          onClick={() => setState(previousExecution)}
        >
          Previous
        </button>
        <button
          type="button"
          aria-label={complete ? 'Workout complete' : 'Next block'}
          className={primaryButtonClassName}
          disabled={pending || complete}
          onClick={() => setState(advanceExecution)}
        >
          {complete ? 'Workout complete' : 'Next block'}
        </button>
        <button
          type="button"
          aria-label="Restart workout"
          className={secondaryButtonClassName}
          disabled={pending || state.completed.every((value) => !value) && state.currentIndex === 0}
          onClick={() => setState(restartExecution)}
        >
          Restart
        </button>
      </div>
      {complete ? (
        <button type="button" className={primaryButtonClassName} disabled={pending} onClick={() => void completeSession()}>
          {pending ? 'Saving…' : 'Mark session complete'}
        </button>
      ) : null}
      <p className="text-[12px] text-[var(--text-secondary)]">Progress is local to this device and restarts if you refresh.</p>
      {message ? <p className={successTextClassName}>{message}</p> : null}
      {error ? <p className={dangerTextClassName}>{error}</p> : null}
    </div>
  );
}
