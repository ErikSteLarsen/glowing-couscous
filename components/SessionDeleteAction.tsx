'use client';

import { useState } from 'react';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogClose } from '@ui-sdk/react/alert-dialog';
import { useRouter } from 'next/navigation';
import { centeredDialogClassName, dialogActionsClassName, compactDangerButtonClassName, compactSecondaryButtonClassName, dangerButtonClassName, dangerTextClassName } from '@/components/ui';

export function SessionDeleteAction({
  sessionId,
  title,
  returnHref,
  onDeleted,
  disabled = false,
  open,
  onOpenChange,
}: {
  sessionId: number;
  title: string;
  returnHref?: string;
  onDeleted?: (title: string) => void;
  disabled?: boolean;
  /** Controlled from another control, such as a menu item; no trigger is rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : uncontrolledOpen;
  const setIsOpen = (next: boolean) => {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
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
    <AlertDialog open={isOpen} onOpenChange={(open, details) => {
      if (isPending) { details.cancel(); return; }
      setError('');
      setIsOpen(open);
    }}>
      {controlled ? null : (
        <AlertDialogTrigger className={dangerButtonClassName} disabled={disabled}>
          Remove session
        </AlertDialogTrigger>
      )}
      {error && !isOpen ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
      <AlertDialogContent className={`${centeredDialogClassName} max-w-md space-y-4`}>
        <div>
          <AlertDialogTitle className="text-base font-medium text-[var(--text)]">Remove this session?</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm text-[var(--text-secondary)]">
            “{title}” will be deleted from your plan. This cannot be undone.
          </AlertDialogDescription>
        </div>
        {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
        <div className={dialogActionsClassName}>
          <AlertDialogClose className={`${compactSecondaryButtonClassName} min-h-11 sm:min-h-8`} disabled={isPending}>
            Keep session
          </AlertDialogClose>
          <button type="button" className={`${compactDangerButtonClassName} min-h-11 sm:min-h-8`} disabled={isPending} onClick={() => void removeSession()}>
            {isPending ? 'Removing…' : 'Remove session'}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
