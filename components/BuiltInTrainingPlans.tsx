import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import { ActionLink, buttonFocusClassName, compactSecondaryButtonClassName, sectionHeadingClassName, Surface } from '@/components/ui';
import { getCalendarPlacementHref } from '@/lib/calendar-navigation';
import { formatDurationExact } from '@/lib/format-duration';
import { selectPlanWorkouts, type BuiltInPlanPreview, type PlanWorkoutOption } from '@/lib/plan-catalog/selection';
import { CATALOG_SPORTS } from '@/lib/workout-catalog/query';
import { ROUTINE_DAYS } from '@/lib/template-routine';

function PreviewWorkout({ option, showDuration }: { option: PlanWorkoutOption; showDuration: boolean }) {
  const sport = CATALOG_SPORTS.find(item => item.id === option.sport);
  if (!sport) return <span>{option.title}</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <Link href={`/athlete/library/${option.id}`} className={`rounded-sm text-[var(--text)] underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--brand)] ${buttonFocusClassName}`}>
        {option.title}
      </Link>
      <span className="text-xs text-[var(--text-muted)]">
        {sport.label}{showDuration ? ` (${formatDurationExact(option.durationSec)})` : ''}
      </span>
    </span>
  );
}

export function BuiltInTrainingPlans({ plans, openSlug, onCustomize, busy }: {
  plans: BuiltInPlanPreview[];
  /** Plan whose week starts expanded, from a workout's "Used in plans" link. */
  openSlug: string | null;
  onCustomize: (plan: BuiltInPlanPreview) => void;
  busy: boolean;
}) {
  return (
    <section aria-labelledby="built-in-plans" className="space-y-3">
      <h2 id="built-in-plans" className={sectionHeadingClassName}>Built-in plans</h2>
      <Surface className="divide-y divide-[var(--border)]">
        {plans.map((plan) => {
          const workouts = selectPlanWorkouts(plan.slots, {});
          const durationSec = workouts.reduce((sum, { option }) => sum + option.durationSec, 0);
          return (
            <article key={plan.slug} id={`plan-${plan.slug}`} className="scroll-mt-20 space-y-3 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
                <div className="space-y-1">
                  <h3 className={sectionHeadingClassName}>{plan.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{plan.summary}</p>
                  <p className="data text-[13px] text-[var(--text-muted)]">
                    {workouts.length} workouts &nbsp;/&nbsp; {formatDurationExact(durationSec)} with default choices
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 max-md:[&>a]:min-h-11">
                  <ActionLink href={getCalendarPlacementHref(`built-in-plan:${plan.slug}`)} size="compact" tone="secondary">
                    Apply to Calendar<span className="sr-only"> for {plan.name}</span>
                  </ActionLink>
                  <button type="button" disabled={busy} className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => onCustomize(plan)}>
                    Customize<span className="sr-only"> {plan.name}</span>
                  </button>
                </div>
              </div>
              <details className="group" open={plan.slug === openSlug || undefined}>
                <summary className={`inline-flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] max-md:min-h-11 [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
                  Preview week<span className="sr-only"> for {plan.name}</span>
                  <ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 max-w-prose text-[13px] text-[var(--text-muted)]">
                  Original weekly range {plan.volumeLabel}.{plan.volumeNote ? ` ${plan.volumeNote}` : null}
                </p>
                <dl className="mt-3 divide-y divide-[var(--border)]">
                  {ROUTINE_DAYS.map((day, weekday) => {
                    const slots = plan.slots.filter((slot) => slot.weekday === weekday);
                    return (
                      <div key={day} className="grid gap-1 py-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
                        <dt className="font-medium">{day}</dt>
                        <dd className="space-y-2 text-[var(--text-secondary)]">
                          {slots.length ? slots.map((slot) => {
                            const [first] = slot.options;
                            if (slot.options.length === 1) return <p key={slot.id}><PreviewWorkout option={first} showDuration /></p>;
                            const sameDuration = first.durationSec > 0 && slot.options.every((option) => option.durationSec === first.durationSec);
                            return (
                              <div key={slot.id}>
                                <p>
                                  {slot.label}{sameDuration ? <span className="data text-[var(--text-muted)]"> &nbsp;/&nbsp; {formatDurationExact(first.durationSec)}</span> : null}
                                  <span className="text-[13px] text-[var(--text-muted)]">, choose one (first is the default)</span>
                                </p>
                                <ul className="mt-1 space-y-0.5 text-[13px] text-[var(--text-muted)]">
                                  {slot.options.map((option) => (
                                    <li key={option.id}><PreviewWorkout option={option} showDuration={!sameDuration} /></li>
                                  ))}
                                </ul>
                              </div>
                            );
                          }) : 'Rest day'}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </details>
            </article>
          );
        })}
      </Surface>
    </section>
  );
}
