'use client';

import { useId, useState } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, X } from 'lucide-react';

import { AddDialogFrame, usePlacementRequest } from '@/components/AddDialogFrame';
import { useWorkoutBrowser, WorkoutBrowser, WorkoutSummary } from '@/components/WorkoutPicker';
import {
  buttonFocusClassName,
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  ghostButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '@/components/ui';
import { getCalendarHref, parseCalendarDay, type CalendarView } from '@/lib/calendar-navigation';
import {
  addPlacementDate,
  formatPlacementDate,
  getPlacementReturnHref,
  getWorkoutButtonLabel,
  removePlacementDate,
  splitSourceKey,
} from '@/lib/calendar-placement';
import { parsePlannedTime } from '@/lib/planned-time';
import type { AddableWorkout } from '@/lib/placement-options';
import { fromDayKey } from '@/lib/training-load';

/**
 * Add workout: browse every workout you can place (your saved ones and the whole
 * public library), pick one, then confirm the day. Only the day is needed; start
 * time and extra days sit under More options.
 */
export function AddWorkoutDialog({
  view,
  day,
  workouts,
  initialKey,
  initialMessage,
  returnHref,
}: {
  view: CalendarView;
  /** The day the dialog was opened for. */
  day: string;
  workouts: AddableWorkout[];
  initialKey: string | null;
  initialMessage: string;
  /** Where Cancel goes when the dialog was opened from another page; Calendar otherwise. */
  returnHref: string | null;
}) {
  const router = useRouter();
  const ids = useId();
  const initial = workouts.find((workout) => workout.key === initialKey) ?? null;

  const [selectedKey, setSelectedKey] = useState<string | null>(initial?.key ?? null);
  const browser = useWorkoutBrowser(workouts, initial?.origin);
  const [date, setDate] = useState(day);
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const { send, isPending, error, setError } = usePlacementRequest();
  const [notice, setNotice] = useState(initialMessage);

  const selected = workouts.find((workout) => workout.key === selectedKey) ?? null;
  // Replace, so Back after closing does not reopen the dialog.
  const close = () => router.replace(returnHref ?? getCalendarHref(view, day), { scroll: false });

  if (selected) {
    const dates = [...new Set([date, ...extraDates].filter((entry) => parseCalendarDay(entry)))].sort();
    const plannedTime = parsePlannedTime(startTime.trim());
    const canAdd = dates.length > 0 && plannedTime.ok && !isPending;

    function add() {
      if (!selected || !dates.length) return;
      if (!plannedTime.ok) { setError(plannedTime.error); return; }
      const [kind, id] = splitSourceKey(selected.key);
      const endpoint = kind === 'catalog' ? `/api/athlete/library/${encodeURIComponent(id)}/schedule` : '/api/athlete/planner/assignments';
      const body = kind === 'catalog'
        ? { dates, timeLabel: plannedTime.timeLabel }
        : { sourceKind: 'workout', sourceId: Number(id), dates, timeLabel: plannedTime.timeLabel };
      send(endpoint, body, (sessionIds) => router.push(getPlacementReturnHref(view, dates, sessionIds.length || dates.length), { scroll: false }));
    }

    return (
      <AddDialogFrame
        title="Add workout"
        steps={[{ label: 'Workout', state: 'done' }, { label: 'Day', state: 'current' }]}
        busy={isPending}
        onClose={close}
        footer={<>
          <button type="button" onClick={close} disabled={isPending} className={`${secondaryButtonClassName} max-md:min-h-11`}>Cancel</button>
          <button type="button" onClick={add} disabled={!canAdd} className={`${primaryButtonClassName} max-md:min-h-11`}>
            {isPending ? 'Adding…' : getWorkoutButtonLabel(dates)}
          </button>
        </>}
      >
        <div className="flex flex-col gap-5">
          <button type="button" onClick={() => { setSelectedKey(null); setError(''); }} disabled={isPending} className={`${ghostButtonClassName('compact')} -ml-2 self-start max-md:min-h-11`}>
            <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.8} />Choose another workout
          </button>

          <WorkoutSummary workout={selected} idPrefix={`${ids}-chosen`} />

          <section aria-labelledby={`${ids}-day`} className="flex flex-col gap-3">
            <h3 id={`${ids}-day`} className="text-sm font-medium text-[var(--text)]">Which day?</h3>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <label className="block w-full max-w-xs">
                <span className={formLabelClassName}>Day</span>
                <input type="date" required value={date} onChange={(event) => { setDate(event.target.value); setError(''); }} className={`${formFieldClassName} data max-md:min-h-11`} />
              </label>
              {parseCalendarDay(date) ? <p className="data pb-2.5 text-sm text-[var(--text-secondary)]">{format(fromDayKey(date), 'EEEE\u00A0d\u00A0MMMM')}</p> : null}
            </div>
            {!parseCalendarDay(date) && !extraDates.length ? <p className="text-[13px] text-[var(--text-muted)]">Choose a day to continue.</p> : null}
          </section>

          <details className="group rounded-xl border border-[var(--border)]">
            <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm hover:bg-[var(--raised)] [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-[var(--text)]">More options</span>
                <span className="text-[13px] text-[var(--text-muted)]">
                  {startTime || extraDates.length
                    ? [startTime ? `Starts ${startTime}` : null, extraDates.length ? `${extraDates.length} more ${extraDates.length === 1 ? 'day' : 'days'}` : null].filter(Boolean).join(', ')
                    : 'Optional: start time, more days'}
                </span>
              </span>
              <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-5 border-t border-[var(--border)] p-4">
              <label className="block max-w-xs">
                <span className={formLabelClassName}>Start time</span>
                <input type="time" value={startTime} onChange={(event) => { setStartTime(event.target.value); setError(''); }} className={`${formFieldClassName} data max-w-48 max-md:min-h-11`} />
                <span className="mt-1.5 block text-[13px] text-[var(--text-muted)]">Leave empty to plan it for the day.</span>
              </label>
              <div className="flex flex-col gap-2">
                <span className={formLabelClassName}>Also add on</span>
                {extraDates.length ? (
                  <ul className="flex flex-wrap gap-2" aria-label="More days">
                    {extraDates.map((entry) => (
                      <li key={entry} className="data inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--field-selected-border)] bg-[var(--brand-tint)] pl-3 pr-1 text-sm text-[var(--field-selected-text)]">
                        {formatPlacementDate(entry)}
                        <button type="button" aria-label={`Remove ${formatPlacementDate(entry)}`} onClick={() => setExtraDates((current) => removePlacementDate(current, entry))} className={`inline-flex size-8 items-center justify-center rounded-md hover:bg-[var(--raised)] max-md:size-11 ${buttonFocusClassName}`}>
                          <X aria-hidden="true" size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <label className="block max-w-xs">
                  <span className="sr-only">Add another day</span>
                  <input
                    type="date"
                    value=""
                    onChange={(event) => {
                      const picked = event.target.value;
                      // Adds as soon as a whole date is picked; the chip above confirms it.
                      if (parseCalendarDay(picked) && picked !== date) setExtraDates((current) => addPlacementDate(current, picked));
                    }}
                    className={`${formFieldClassName} data max-md:min-h-11`}
                  />
                  <span className="mt-1.5 block text-[13px] text-[var(--text-muted)]">Pick a day to add it. The button below counts every day.</span>
                </label>
              </div>
            </div>
          </details>

          <p className="text-[13px] text-[var(--text-muted)]">Each day gets its own copy, so you can change it there. The {selected.origin === 'library' ? 'library workout' : 'saved workout'} stays as it is.</p>
          <div role="alert" className="empty:hidden">{error ? <p className={dangerTextClassName}>{error}</p> : null}</div>
        </div>
      </AddDialogFrame>
    );
  }

  return (
    <AddDialogFrame
      title="Add workout"
      description={<>to <span className="data">{formatPlacementDate(day)}</span></>}
      steps={[{ label: 'Workout', state: 'current' }, { label: 'Day', state: 'next' }]}
      busy={false}
      onClose={close}
      footer={<button type="button" onClick={close} className={`${secondaryButtonClassName} max-md:min-h-11`}>Cancel</button>}
    >
      <WorkoutBrowser
        workouts={workouts}
        state={browser}
        notice={notice}
        hint="Choose one to see it and pick the day."
        onChoose={(workout) => { setSelectedKey(workout.key); setNotice(''); }}
      />
    </AddDialogFrame>
  );
}
