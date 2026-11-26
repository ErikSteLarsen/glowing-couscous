'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarDays, Ellipsis } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempobuilder/Menu';
import { AddDialogFrame } from '@/components/AddDialogFrame';
import { filterChipClassName } from '@/components/library/CollectionFilters';
import {
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  iconButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  successTextClassName,
} from '@/components/ui';
import { parseCalendarDay } from '@/lib/calendar-navigation';
import { addDayKeys, fromDayKey } from '@/lib/training-load';

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
  const [internalOpen, setInternalOpen] = useState(false);
  const tomorrow = addDayKeys(today, 1);
  // Today, or tomorrow when the workout is already on today.
  const suggestedDay = today === currentDay ? tomorrow : today;
  const [date, setDate] = useState(suggestedDay);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const quickDays = [
    { day: today, label: 'Today' },
    { day: tomorrow, label: 'Tomorrow' },
  ];

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  // Each opening starts fresh on the suggested day.
  const [seenOpen, setSeenOpen] = useState(isOpen);
  if (seenOpen !== isOpen) {
    setSeenOpen(isOpen);
    if (isOpen) { setDate(suggestedDay); setError(''); }
  }

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

    setOpen(false);
    setNotice(`Moved ${title} to ${formatDay(day)}.`);
    router.refresh();
  }

  const canMove = Boolean(parseCalendarDay(date)) && date !== currentDay && !isPending;
  return (
    <>
      {controlled ? null : (
        <button type="button" className={`${secondaryButtonClassName} min-h-11`} onClick={() => setOpen(true)}>
          Move to another day…
        </button>
      )}
      {notice ? <p role="status" className={successTextClassName}>{notice}</p> : null}
      {isOpen ? (
        <AddDialogFrame
          size="compact"
          title="Move workout"
          description={<>“{title}” is on <span className="data">{formatDay(currentDay)}</span>. Its blocks and start time stay the same.</>}
          busy={isPending}
          onClose={() => setOpen(false)}
          footer={<>
            <button type="button" className={`${secondaryButtonClassName} max-md:min-h-11`} disabled={isPending} onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className={`${primaryButtonClassName} max-md:min-h-11`} disabled={!canMove} onClick={() => void moveTo(date)}>
              {isPending ? 'Moving…' : canMove ? `Move to ${formatDay(date)}` : 'Choose a new day'}
            </button>
          </>}
        >
          <div className="flex flex-col gap-4">
            <div role="group" aria-label="Quick days" className="flex flex-wrap gap-2">
              {quickDays.map(({ day, label }) => (
                <button key={day} type="button" aria-pressed={date === day} disabled={day === currentDay || isPending} onClick={() => { setDate(day); setError(''); }} className={filterChipClassName(date === day)}>
                  {label}<span className="data text-[12px] text-[var(--text-muted)]">{formatDay(day)}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <label className="block w-full max-w-xs">
                <span className={formLabelClassName}>Or pick a day</span>
                <input
                  type="date"
                  className={`${formFieldClassName} data max-md:min-h-11`}
                  value={date}
                  onChange={(event) => { setDate(event.target.value); setError(''); }}
                  disabled={isPending}
                />
              </label>
              {parseCalendarDay(date) ? <p className="data pb-2.5 text-sm text-[var(--text-secondary)]">{format(fromDayKey(date), 'EEEE\u00A0d\u00A0MMMM')}</p> : null}
            </div>
            {date === currentDay ? <p className="text-[13px] text-[var(--text-muted)]">That is the day it is on now.</p> : null}
            <div role="alert" className="empty:hidden">{error ? <p className={dangerTextClassName}>{error}</p> : null}</div>
          </div>
        </AddDialogFrame>
      ) : null}
    </>
  );
}

export function SessionRescheduleAction(props: ActionProps) {
  return props.mode === 'quick'
    ? <QuickMoveAction {...props} />
    : <RescheduleDialog {...props} />;
}
