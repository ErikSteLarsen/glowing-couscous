'use client';

import { useId, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { AddDialogFrame } from '@/components/AddDialogFrame';
import { filterChipClassName } from '@/components/library/CollectionFilters';
import { useWorkoutBrowser, WorkoutBrowser, WorkoutSummary } from '@/components/WorkoutPicker';
import { ghostButtonClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
import type { AddableWorkout } from '@/lib/placement-options';
import { ROUTINE_DAYS } from '@/lib/template-routine';

export type PlanWorkoutRequest =
  /** Add one workout on one or more weekdays, starting with `weekdays` ticked. */
  | { kind: 'add'; weekdays: number[] }
  /** Swap the workout on one day for another. */
  | { kind: 'replace'; weekday: number; currentKey: string; entryKey: number };

/**
 * The training plan editor's workout picker: the same browser as the Calendar's
 * Add workout, then the weekdays it goes on. Changing a day's workout skips the
 * days step.
 */
export function PlanWorkoutDialog({ workouts, request, room, onAdd, onReplace, onClose }: {
  workouts: AddableWorkout[];
  request: PlanWorkoutRequest;
  /** How many more workouts the plan can hold. */
  room: number;
  onAdd: (workout: AddableWorkout, weekdays: number[]) => void;
  onReplace: (workout: AddableWorkout) => void;
  onClose: () => void;
}) {
  const ids = useId();
  const current = request.kind === 'replace' ? workouts.find((workout) => workout.key === request.currentKey) : undefined;
  const browser = useWorkoutBrowser(workouts, current?.origin);
  const [selected, setSelected] = useState<AddableWorkout | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>(request.kind === 'add' ? request.weekdays : []);
  const dayName = request.kind === 'replace' ? ROUTINE_DAYS[request.weekday] : null;
  const title = dayName ? `Change ${dayName}’s workout` : 'Add a workout to your plan';
  const cancel = <button type="button" onClick={onClose} className={`${secondaryButtonClassName} max-md:min-h-11`}>Cancel</button>;

  if (!selected || request.kind === 'replace') {
    return (
      <AddDialogFrame
        title={title}
        description={current ? <>Now: {current.title}</> : undefined}
        steps={request.kind === 'add' ? [{ label: 'Workout', state: 'current' }, { label: 'Days', state: 'next' }] : undefined}
        busy={false}
        onClose={onClose}
        footer={cancel}
      >
        <WorkoutBrowser
          workouts={workouts}
          state={browser}
          hint={request.kind === 'add' ? 'Choose one to see it and pick the days.' : `Choose one to use on ${dayName}.`}
          onChoose={(workout) => (request.kind === 'replace' ? onReplace(workout) : setSelected(workout))}
        />
      </AddDialogFrame>
    );
  }

  const tooMany = weekdays.length > room;
  return (
    <AddDialogFrame
      title={title}
      steps={[{ label: 'Workout', state: 'done' }, { label: 'Days', state: 'current' }]}
      busy={false}
      onClose={onClose}
      footer={<>
        {cancel}
        <button type="button" disabled={!weekdays.length || tooMany} onClick={() => onAdd(selected, weekdays)} className={`${primaryButtonClassName} max-md:min-h-11`}>
          {weekdays.length ? `Add to ${weekdays.length} ${weekdays.length === 1 ? 'day' : 'days'}` : 'Choose a day'}
        </button>
      </>}
    >
      <div className="flex flex-col gap-5">
        <button type="button" onClick={() => setSelected(null)} className={`${ghostButtonClassName('compact')} -ml-2 self-start max-md:min-h-11`}>
          <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.8} />Choose another workout
        </button>
        <WorkoutSummary workout={selected} idPrefix={`${ids}-chosen`} />
        <section aria-labelledby={`${ids}-days`} className="flex flex-col gap-3">
          <h3 id={`${ids}-days`} className="text-sm font-medium text-[var(--text)]">Which days of the week?</h3>
          <div role="group" aria-label="Days" className="flex flex-wrap gap-2">
            {ROUTINE_DAYS.map((day, weekday) => {
              const on = weekdays.includes(weekday);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setWeekdays((list) => (on ? list.filter((value) => value !== weekday) : [...list, weekday].sort()))}
                  className={filterChipClassName(on)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {tooMany
            ? <p className="text-[13px] text-[var(--status-warning)]">A training plan holds at most 70 workouts. Choose {room === 0 ? 'fewer workouts elsewhere first' : `at most ${room} ${room === 1 ? 'day' : 'days'}`}.</p>
            : <p className="text-[13px] text-[var(--text-muted)]">Each day gets this workout every week the plan runs.</p>}
        </section>
      </div>
    </AddDialogFrame>
  );
}
