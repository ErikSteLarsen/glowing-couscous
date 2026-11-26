'use client';

import { useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { filterChipClassName } from '@/components/library/CollectionFilters';
import { SportIcon } from '@/components/tempobuilder/SportBadge';
import {
  buttonFocusClassName,
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '@/components/ui';
import { getCalendarHref, parseCalendarDay, type CalendarView } from '@/lib/calendar-navigation';
import {
  formatPlacementDate,
  getDateRangeLabel,
  getPlacementReturnHref,
  getPlanButtonLabel,
  getPlanDates,
  PLAN_WEEK_CHOICES,
  splitSourceKey,
} from '@/lib/calendar-placement';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { selectPlanWorkouts } from '@/lib/plan-catalog/selection';
import { ROUTINE_DAYS } from '@/lib/template-routine';
import { MAX_PLACEMENTS_PER_REQUEST } from '@/lib/template-period';
import { addDayKeys, weekStartOf } from '@/lib/training-load';
import { AddDialogFrame, usePlacementRequest } from '@/components/AddDialogFrame';
import type { AddablePlan } from '@/lib/placement-options';

type Step = 'plan' | 'dates' | 'review';
const STEP_LABELS: { id: Step; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'dates', label: 'Dates' },
  { id: 'review', label: 'Review' },
];

function weekOf(plan: AddablePlan, choices: Record<string, string>) {
  const workouts = selectPlanWorkouts(plan.slots, choices);
  const sports = new Map<string, number>();
  for (const { option } of workouts) sports.set(option.sport, (sports.get(option.sport) ?? 0) + 1);
  return { workouts, durationSec: workouts.reduce((sum, { option }) => sum + option.durationSec, 0), sports: [...sports] };
}

/**
 * Add training plan: choose a plan, choose its start week and how many weeks,
 * review every dated workout, then add them all in one step.
 */
export function AddPlanDialog({
  view,
  day,
  today,
  plans,
  initialKey,
  initialStart,
  initialMessage,
  returnHref,
}: {
  view: CalendarView;
  day: string;
  today: string;
  plans: AddablePlan[];
  initialKey: string | null;
  /** Monday the plan starts on by default. */
  initialStart: string;
  initialMessage: string;
  /** Where Cancel goes when the dialog was opened from another page; Calendar otherwise. */
  returnHref: string | null;
}) {
  const router = useRouter();
  const ids = useId();
  const initial = plans.find((plan) => plan.key === initialKey) ?? null;
  const [step, setStep] = useState<Step>(initial ? 'dates' : 'plan');
  const [selectedKey, setSelectedKey] = useState<string | null>(initial?.key ?? null);
  const [start, setStart] = useState(initialStart);
  const [weeks, setWeeks] = useState(initial?.defaultWeeks ?? 1);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const { send, isPending, error, setError } = usePlacementRequest();

  const plan = plans.find((entry) => entry.key === selectedKey) ?? null;
  // Replace, so Back after closing does not reopen the dialog.
  const close = () => router.replace(returnHref ?? getCalendarHref(view, day), { scroll: false });
  const stepTrail = STEP_LABELS.map(({ id, label }) => {
    const order = STEP_LABELS.findIndex((entry) => entry.id === id) - STEP_LABELS.findIndex((entry) => entry.id === step);
    return { label, state: order < 0 ? 'done' as const : order === 0 ? 'current' as const : 'next' as const };
  });

  if (!plan || step === 'plan') {
    const mine = plans.filter((entry) => entry.origin === 'mine');
    const builtIn = plans.filter((entry) => entry.origin === 'built-in');
    const choose = (entry: AddablePlan) => {
      if (entry.key !== selectedKey) { setChoices({}); setWeeks(entry.defaultWeeks); }
      setSelectedKey(entry.key);
      setStep('dates');
      setError('');
    };
    return (
      <AddDialogFrame
        title="Add training plan"
        description="A plan is a week of workouts. Add it for one week or repeat it for several."
        steps={stepTrail}
        busy={false}
        onClose={close}
        footer={<button type="button" onClick={close} className={`${secondaryButtonClassName} max-md:min-h-11`}>Cancel</button>}
      >
        <div className="flex flex-col gap-6">
          {initialMessage ? <p className="text-[13px] text-[var(--status-warning)]">{initialMessage}</p> : null}
          <PlanList title="My training plans" plans={mine} selectedKey={selectedKey} onChoose={choose} empty={(
            <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
              No plans of your own yet. <Link href="/athlete/templates" className={`rounded-sm text-[var(--brand)] underline underline-offset-4 ${buttonFocusClassName}`}>Build one in Training plans</Link>, or start with a built-in week below.
            </p>
          )} />
          <PlanList title="Built-in plans" plans={builtIn} selectedKey={selectedKey} onChoose={choose} />
        </div>
      </AddDialogFrame>
    );
  }

  const week = weekOf(plan, choices);
  const monday = parseCalendarDay(start) ? weekStartOf(start) : null;
  const dates = monday ? getPlanDates(monday, weeks) : [];
  const placements = dates.length
    ? Array.from({ length: weeks }, (_, index) => week.workouts.map(({ weekday, option }) => ({ date: dates[index * 7 + weekday], title: option.title, sport: option.sport, durationSec: option.durationSec }))).flat()
    : [];
  const thisWeek = weekStartOf(today);
  const nextWeek = addDayKeys(thisWeek, 7);
  const alternatives = plan.slots.filter((slot) => slot.options.length > 1);
  const tooMany = placements.length > MAX_PLACEMENTS_PER_REQUEST;

  function add() {
    if (!plan || !dates.length || !placements.length) return;
    const [kind, id] = splitSourceKey(plan.key);
    const body = kind === 'built-in-plan'
      ? { sourceKind: 'built-in-plan', sourceId: id, version: plan.version, choices, dates }
      : { sourceKind: 'template', sourceId: Number(id), dates };
    send('/api/athlete/planner/assignments', body, (sessionIds) => router.push(getPlacementReturnHref(view, dates, sessionIds.length || placements.length), { scroll: false }));
  }

  const planHeader = (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--field-selected-border)] bg-[var(--brand-tint)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--text)] [overflow-wrap:anywhere]">{plan.name}</p>
        <p className="data text-[13px] text-[var(--text-secondary)]">{week.workouts.length} workouts a week · {formatDuration(week.durationSec)} a week</p>
      </div>
      <button type="button" disabled={isPending} onClick={() => setStep('plan')} className={`${secondaryButtonClassName} max-md:min-h-11`}>Change</button>
    </div>
  );

  if (step === 'dates') {
    return (
      <AddDialogFrame
        title="Add training plan"
        steps={stepTrail}
        busy={false}
        onClose={close}
        footer={<>
          <button type="button" onClick={() => setStep('plan')} className={`${secondaryButtonClassName} max-md:min-h-11`}>Back</button>
          <button type="button" disabled={!dates.length || tooMany} onClick={() => setStep('review')} className={`${primaryButtonClassName} max-md:min-h-11`}>
            Review {placements.length} workouts<ChevronRight aria-hidden="true" size={16} />
          </button>
        </>}
      >
        <div className="flex flex-col gap-6">
          {planHeader}

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-medium text-[var(--text)]">When should it start?</legend>
            <div className="flex flex-wrap gap-2">
              {[{ label: 'This week', value: thisWeek }, { label: 'Next week', value: nextWeek }].map((option) => (
                <button key={option.label} type="button" aria-pressed={monday === option.value} onClick={() => setStart(option.value)} className={filterChipClassName(monday === option.value)}>
                  {option.label}<span className="data text-[12px] text-[var(--text-muted)]">{formatPlacementDate(option.value)}</span>
                </button>
              ))}
            </div>
            <label className="block max-w-xs">
              <span className={formLabelClassName}>Or start in another week (pick any day in it)</span>
              <input type="date" required value={start} onChange={(event) => setStart(event.target.value)} className={`${formFieldClassName} data max-md:min-h-11`} />
            </label>
            {monday ? <p className="data text-[13px] text-[var(--text-secondary)]">Starts Monday {formatPlacementDate(monday).replace(/^Mon /, '')}</p> : <p className="text-[13px] text-[var(--text-muted)]">Choose a day to continue.</p>}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-medium text-[var(--text)]">For how many weeks?</legend>
            <div className="flex flex-wrap gap-2">
              {PLAN_WEEK_CHOICES.map((count) => (
                <button key={count} type="button" aria-pressed={weeks === count} onClick={() => setWeeks(count)} className={filterChipClassName(weeks === count)}>
                  {count === 1 ? '1 week' : `${count} weeks`}
                </button>
              ))}
            </div>
            {dates.length ? <p className="data text-[13px] text-[var(--text-secondary)]">{getDateRangeLabel(dates)} · the same week repeats each week</p> : null}
            {tooMany ? <p className="text-[13px] text-[var(--status-warning)]">That is {placements.length} workouts. Choose fewer weeks to add at most {MAX_PLACEMENTS_PER_REQUEST} at once.</p> : null}
          </fieldset>

          {alternatives.length ? (
            <details className="group rounded-xl border border-[var(--border)]">
              <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm hover:bg-[var(--raised)] [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-[var(--text)]">Workout choices</span>
                  <span className="text-[13px] text-[var(--text-muted)]">Optional: {alternatives.length} days let you pick another workout</span>
                </span>
                <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-[var(--border)] p-4">
                {alternatives.map((slot) => (
                  <label key={slot.id} className="block">
                    <span className={formLabelClassName}>{ROUTINE_DAYS[slot.weekday]}: {slot.label}</span>
                    <select
                      className={`${formSelectClassName} max-md:min-h-11`}
                      value={choices[slot.id] ?? slot.options[0].id}
                      onChange={(event) => setChoices({ ...choices, [slot.id]: event.target.value })}
                    >
                      {slot.options.map((option, index) => (
                        <option key={option.id} value={option.id}>
                          {option.title}{option.durationSec ? ` (${formatDuration(option.durationSec)})` : ''}{index === 0 ? ', suggested' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </AddDialogFrame>
    );
  }

  return (
    <AddDialogFrame
      title="Add training plan"
      steps={stepTrail}
      busy={isPending}
      onClose={close}
      footer={<>
        <button type="button" disabled={isPending} onClick={() => setStep('dates')} className={`${secondaryButtonClassName} max-md:min-h-11`}>Back</button>
        <button type="button" disabled={isPending || !placements.length || tooMany} onClick={add} className={`${primaryButtonClassName} max-md:min-h-11`}>
          {isPending ? 'Adding…' : getPlanButtonLabel(placements.length)}
        </button>
      </>}
    >
      <div className="flex flex-col gap-5">
        <div className="space-y-1">
          <h3 className="text-base font-medium text-[var(--text)]">{plan.name}</h3>
          <p className="data text-[13px] text-[var(--text-secondary)]">
            {getDateRangeLabel(dates)} · {weeks === 1 ? '1 week' : `${weeks} weeks`} · {placements.length} workouts · {formatDuration(week.durationSec * weeks)} in total
          </p>
        </div>

        <ol className="flex flex-col gap-3" aria-label="Workouts to add">
          {Array.from({ length: weeks }, (_, index) => {
            const weekDates = dates.slice(index * 7, index * 7 + 7);
            const weekPlacements = placements.filter((entry) => weekDates.includes(entry.date));
            return (
              <li key={weekDates[0]}>
                <details className="group rounded-xl border border-[var(--border)]" open={index === 0 || undefined}>
                  <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm hover:bg-[var(--raised)] [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-[var(--text)]">Week {index + 1}</span>
                      <span className="data text-[13px] text-[var(--text-muted)]">{getDateRangeLabel(weekDates)} · {weekPlacements.length} workouts</span>
                    </span>
                    <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                    {weekDates.map((date) => {
                      const onDay = weekPlacements.filter((entry) => entry.date === date);
                      return (
                        <li key={date} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-4 py-2 text-[13px]">
                          <span className="data text-[var(--text-muted)]">{formatPlacementDate(date)}</span>
                          <span className="flex min-w-0 flex-col gap-1">
                            {onDay.length ? onDay.map((entry, entryIndex) => (
                              <span key={entryIndex} className="flex min-w-0 items-center gap-2">
                                <span className="text-[var(--text-secondary)]"><SportIcon sport={entry.sport} size={14} /></span>
                                <span className="sr-only">{getSportLabel(entry.sport)}: </span>
                                <span className="min-w-0 truncate text-[var(--text)]">{entry.title}</span>
                                <span className="data ml-auto shrink-0 text-[var(--text-muted)]">{formatDuration(entry.durationSec)}</span>
                              </span>
                            )) : <span className="text-[var(--text-muted)]">Rest</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            );
          })}
        </ol>

        <p id={`${ids}-note`} className="text-[13px] text-[var(--text-muted)]">
          Workouts already on your Calendar stay. Each added workout is its own copy you can move, change or remove later.
        </p>
        <div role="alert" className="empty:hidden">{error ? <p className={dangerTextClassName}>{error}</p> : null}</div>
      </div>
    </AddDialogFrame>
  );
}

function PlanList({ title, plans, selectedKey, onChoose, empty }: {
  title: string;
  plans: AddablePlan[];
  selectedKey: string | null;
  onChoose: (plan: AddablePlan) => void;
  empty?: ReactNode;
}) {
  const ids = useId();
  if (!plans.length && !empty) return null;
  return (
    <section aria-labelledby={ids} className="flex flex-col gap-2">
      <h3 id={ids} className="text-[13px] font-medium text-[var(--text-secondary)]">{title}</h3>
      {plans.length ? (
        <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
          {plans.map((plan) => {
            const week = weekOf(plan, {});
            return (
              <li key={plan.key}>
                <button
                  type="button"
                  aria-current={plan.key === selectedKey || undefined}
                  onClick={() => onChoose(plan)}
                  className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--raised)] ${buttonFocusClassName} focus-visible:ring-inset focus-visible:ring-offset-0`}
                >
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-medium text-[var(--text)] [overflow-wrap:anywhere]">{plan.name}</span>
                    {plan.summary ? <span className="block text-[13px] text-[var(--text-secondary)]">{plan.summary}</span> : null}
                    <span className="data flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
                      <span>{week.workouts.length} workouts a week</span>
                      <span>{formatDuration(week.durationSec)} a week</span>
                      {week.sports.map(([sport, count]) => (
                        <span key={sport} className="inline-flex items-center gap-1">
                          <SportIcon sport={sport} size={13} />{count}<span className="sr-only"> {getSportLabel(sport)}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text)]" />
                </button>
                <WeekStrip workouts={week.workouts} />
              </li>
            );
          })}
        </ul>
      ) : empty}
    </section>
  );
}

/** Monday to Sunday at a glance: each day's sports, or a dot for rest. */
function WeekStrip({ workouts }: { workouts: Array<{ weekday: number; option: { sport: string; title: string } }> }) {
  return (
    <ol aria-label="Week preview" className="grid grid-cols-7 gap-1 px-4 pb-3">
      {ROUTINE_DAYS.map((name, weekday) => {
        const onDay = workouts.filter((entry) => entry.weekday === weekday);
        return (
          <li key={name} className="flex min-w-0 flex-col items-center gap-1 rounded-md bg-[var(--raised)] px-1 py-1.5 text-[11px] text-[var(--text-muted)]">
            <span aria-hidden="true">{name.slice(0, 3)}</span>
            <span className="sr-only">{name}: {onDay.length ? onDay.map((entry) => entry.option.title).join(', ') : 'rest'}</span>
            <span aria-hidden="true" className="flex min-h-4 flex-wrap justify-center gap-0.5 text-[var(--text-secondary)]">
              {onDay.length ? onDay.map((entry, index) => <SportIcon key={index} sport={entry.option.sport} size={13} />) : <span>–</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
