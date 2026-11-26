'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarDays, Ellipsis } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempobuilder/Menu';
import {
  overlayPanelClassName, dialogActionsClassName,
  compactSecondaryButtonClassName,
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  iconButtonClassName,
  secondaryButtonClassName,
  successTextClassName,
} from '@/components/ui';
import { fromDayKey } from '@/lib/training-load';

type ActionProps = {
  sessionId: number;
  title: string;
  onMoved?: (title: string, date: string) => void;
} & (
  | { mode: 'quick'; targetDay: string }
  | {
      mode: 'dialog';
      currentDay: string;
      today: string;
      /** Controlled from another control, such as a menu item; no trigger is rendered. */
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }
);

type MoveResult = { ok: true } | { ok: false; error: string };

async function moveSession(sessionId: number, date: string): Promise<MoveResult> {
  try {
    const response = await fetch(`/api/athlete/planner/sessions/${sessionId}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true };

    const error = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'Could not move this workout.';
    return { ok: false, error };
  } catch {
    return { ok: false, error: 'Could not reach TempoBuilder. Check your connection and try again.' };
  }
}

function formatDay(day: string) {
  return format(fromDayKey(day), 'EEE\u00A0d\u00A0MMM');
}

function QuickMoveAction({ sessionId, title, targetDay, onMoved }: ActionProps & { mode: 'quick'; targetDay: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  async function moveToToday() {
    setIsPending(true);
    setError('');
    const result = await moveSession(sessionId, targetDay);
    setIsPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    onMoved?.(title, targetDay);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Menu>
        <MenuTrigger className={iconButtonClassName} aria-label={`More actions for ${title}`} disabled={isPending}>
          <Ellipsis size={16} aria-hidden="true" />
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem onSelect={moveToToday}>
            <CalendarDays size={16} aria-hidden="true" />
            {isPending ? 'Moving…' : 'Move to today'}
          </MenuItem>
        </MenuContent>
      </Menu>
      {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
    </div>
  );
}

function RescheduleDialog({ sessionId, title, currentDay, today, open, onOpenChange }: ActionProps & { mode: 'dialog' }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(today);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const controlled = open !== undefined;

  function showDialog() {
    setDate(today);
    setError('');
    dialogRef.current?.showModal();
  }

  // The native dialog is an external system: mirror the controlled open state into it.
  useEffect(() => {
    if (!controlled) return;
    const dialog = dialogRef.current;
    if (open && !dialog?.open) showDialog();
    if (!open && dialog?.open) dialog.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled, open]);

  async function moveTo(day: string) {
    if (day === currentDay) {
      setError('Choose a different day.');
      return;
    }

    setIsPending(true);
    setError('');
    const result = await moveSession(sessionId, day);
    setIsPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    dialogRef.current?.close();
    setNotice(`Moved ${title} to ${formatDay(day)}.`);
    router.refresh();
  }

  return (
    <>
      {controlled ? null : (
        <button type="button" className={`${secondaryButtonClassName} min-h-11`} onClick={showDialog}>
          Move to another day…
        </button>
      )}
      {notice ? <p role="status" className={successTextClassName}>{notice}</p> : null}
      <dialog
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby={`reschedule-session-title-${sessionId}`}
        aria-describedby={`reschedule-session-description-${sessionId}`}
        className={`${overlayPanelClassName} fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--border)] p-5 backdrop:bg-black/60`}
        onCancel={(event) => {
          if (isPending) event.preventDefault();
        }}
        onClose={() => onOpenChange?.(false)}
      >
        <div className="space-y-2">
          <h2 id={`reschedule-session-title-${sessionId}`} className="text-base font-medium">Move workout</h2>
          <p id={`reschedule-session-description-${sessionId}`} className="text-sm text-[var(--text-secondary)]">
            Choose when to do “{title}”. The blocks and start time stay the same.
          </p>
        </div>
        <label className="mt-5 block">
          <span className={formLabelClassName}>New date</span>
          <input
            autoFocus
            type="date"
            className={formFieldClassName}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={isPending}
          />
        </label>
        {error ? <p role="alert" className={`${dangerTextClassName} mt-3`}>{error}</p> : null}
        <div className={`mt-5 ${dialogActionsClassName}`}>
          <button type="button" className={`${compactSecondaryButtonClassName} min-h-11 sm:min-h-8`} disabled={isPending} onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="button" className={`${compactSecondaryButtonClassName} min-h-11 sm:min-h-8`} disabled={isPending || today === currentDay} onClick={() => void moveTo(today)}>
            Move to today
          </button>
          <button type="button" className={`${secondaryButtonClassName} min-h-11`} disabled={isPending || !date || date === currentDay} onClick={() => void moveTo(date)}>
            {isPending ? 'Moving…' : 'Move workout'}
          </button>
        </div>
      </dialog>
    </>
  );
}

export function SessionRescheduleAction(props: ActionProps) {
  return props.mode === 'quick'
    ? <QuickMoveAction {...props} />
    : <RescheduleDialog {...props} />;
}
