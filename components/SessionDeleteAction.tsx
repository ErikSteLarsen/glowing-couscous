'use client';

import { useState } from 'react';
import { AlertDialog, AlertDialogTrigger } from '@ui-sdk/react/alert-dialog';
import { ConfirmationDialogContent } from '@/components/wattonaut/ConfirmationDialogContent';
import { useRouter } from 'next/navigation';
import { dangerButtonClassName, dangerTextClassName } from '@/components/ui';

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
          : 'Could not remove this workout.';
        setError(reason);
        return;
      }

      setIsOpen(false);
      if (onDeleted) onDeleted(title);
      else if (returnHref) router.replace(returnHref);
      else router.refresh();
    } catch {
      setError('Could not reach Wattonaut. Check your connection and try again.');
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
          Remove workout
        </AlertDialogTrigger>
      )}
      {error && !isOpen ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
      <ConfirmationDialogContent
        title="Remove this workout?"
        description={`“${title}” will be removed from your Calendar. This can’t be undone.`}
        cancelLabel="Keep workout"
        confirmLabel={isPending ? 'Removing…' : 'Remove workout'}
        pending={isPending}
        error={error}
        onConfirm={() => void removeSession()}
      />
    </AlertDialog>
  );
}
