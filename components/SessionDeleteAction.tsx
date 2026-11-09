'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { compactDangerButtonClassName, compactSecondaryButtonClassName, dangerButtonClassName, dangerTextClassName } from '@/components/ui';

export function SessionDeleteAction({
  sessionId,
  title,
  returnHref,
  onDeleted,
  disabled = false,
}: {
  sessionId: number;
  title: string;
  returnHref?: string;
  onDeleted?: (title: string) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  async function removeSession() {
    setIsPending(true);
    setError('');
    try {
      const response = await fetch(`/api/athlete/planner/sessions/${sessionId}`, { method: 'DELETE' });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const reason = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : 'The session could not be removed.';
        setError(reason);
        return;
      }

      setIsOpen(false);
      if (onDeleted) onDeleted(title);
      else if (returnHref) router.replace(returnHref);
      else router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button type="button" className={dangerButtonClassName} disabled={disabled} onClick={() => { setError(''); setIsOpen(true); }}>
        Remove session
      </button>
      {error && !isOpen ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          role="presentation"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !isPending) setIsOpen(false);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`delete-session-title-${sessionId}`}
            aria-describedby={`delete-session-description-${sessionId}`}
            className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-overlay)]"
          >
            <div>
              <h2 id={`delete-session-title-${sessionId}`} className="text-base font-medium text-[var(--text)]">Remove this session?</h2>
              <p id={`delete-session-description-${sessionId}`} className="mt-2 text-sm text-[var(--text-secondary)]">
                “{title}” will be deleted from your plan. This cannot be undone.
              </p>
            </div>
            {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={`${compactSecondaryButtonClassName} min-h-11 sm:min-h-8`} autoFocus disabled={isPending} onClick={() => setIsOpen(false)}>
                Keep session
              </button>
              <button type="button" className={`${compactDangerButtonClassName} min-h-11 sm:min-h-8`} disabled={isPending} onClick={() => void removeSession()}>
                {isPending ? 'Removing…' : 'Remove session'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
