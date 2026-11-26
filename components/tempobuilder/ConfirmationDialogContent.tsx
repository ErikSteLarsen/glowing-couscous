'use client';

import type { ComponentProps } from 'react';
import { AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@ui-sdk/react/alert-dialog';
import { centeredDialogClassName, compactDangerButtonClassName, compactSecondaryButtonClassName, dangerTextClassName, dialogActionsClassName } from '@/components/ui';

type ConfirmationDialogContentProps = Pick<ComponentProps<typeof AlertDialogContent>, 'finalFocus'> & {
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
};

export function ConfirmationDialogContent({
  title, description, cancelLabel, confirmLabel, pending, error, onConfirm, finalFocus,
}: ConfirmationDialogContentProps) {
  return (
    <AlertDialogContent className={`${centeredDialogClassName} max-w-md space-y-4`} finalFocus={finalFocus}>
      <div>
        <AlertDialogTitle className="text-base font-medium text-[var(--text)]">{title}</AlertDialogTitle>
        <AlertDialogDescription className="mt-2 text-sm text-[var(--text-secondary)]">{description}</AlertDialogDescription>
      </div>
      {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
      <div className={dialogActionsClassName}>
        <AlertDialogClose className={`${compactSecondaryButtonClassName} max-md:min-h-11`} disabled={pending}>
          {cancelLabel}
        </AlertDialogClose>
        <button type="button" className={`${compactDangerButtonClassName} max-md:min-h-11`} disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </AlertDialogContent>
  );
}
