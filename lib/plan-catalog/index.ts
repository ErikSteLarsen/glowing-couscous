import { workoutCatalog } from '../workout-catalog/index.ts';
import { catalogWorkoutMetrics } from '../workout-catalog/metrics.ts';
import { findCatalogWorkout } from '../workout-catalog/query.ts';
import type { CatalogWorkout } from '../workout-catalog/types.ts';
import type { BuiltInPlanPreview, PlanSlot, PlanWorkoutOption } from './selection.ts';

/** A plan option's id is its public workout's slug; `workout` is that same catalog entry. */
type ScheduledOption = PlanWorkoutOption & { workout: CatalogWorkout };
type RestOption = PlanWorkoutOption & { workout: null };
type CatalogOption = ScheduledOption | RestOption;
type CatalogPlan = Omit<BuiltInPlanPreview, 'slots'> & { slots: PlanSlot<CatalogOption>[] };

const rest: RestOption = { id: 'rest', title: 'Rest day', sport: 'REST', durationSec: 0, workout: null };

function option(slug: string): ScheduledOption {
  const workout = findCatalogWorkout(workoutCatalog, slug);
  if (!workout) throw new Error(`Built-in plan references unknown public workout "${slug}".`);
  return { id: slug, workout, title: workout.name, sport: workout.sport, durationSec: catalogWorkoutMetrics(workout).durationSec };
}

function session(weekday: number, slug: string): PlanSlot<ScheduledOption> {
  const entry = option(slug);
  return { id: slug, weekday, label: entry.title, options: [entry] };
}

function options(weekday: number, label: string, id: string, [first, ...others]: [string, ...string[]]): PlanSlot<ScheduledOption> {
  return { id, weekday, label, options: [option(`${id}-${first}`), ...others.map((variant) => option(`${id}-${variant}`))] };
}

const runVariants: [string, ...string[]] = ['5x8-lt2', '8x4-lt2', '40-20-vo2'];
const bikeVariants: [string, ...string[]] = ['5x10-lt2', '6x10-lt2', '8-and-4-lt2', '45-15-vo2'];
const swimVariants: [string, ...string[]] = ['10x200', '20x100', '40x50'];

function recoveryDay(id: 'monday-recovery' | 'friday-recovery', weekday: 0 | 4): PlanSlot<CatalogOption> {
  return { id, weekday, label: 'Optional recovery', options: [rest, option('recovery-ride'), option('recovery-run')] };
}

export const builtInPlans: CatalogPlan[] = [
  {
    slug: 'triathlon-essentials',
    version: 1,
    name: 'Triathlon Essentials',
    volumeLabel: '3–3.5 hours',
    volumeNote: 'The three listed workouts add up to 3h 45m.',
    summary: 'One interval session per sport, with four open days.',
    slots: [
      options(1, 'Run intervals', 'run-intervals-75', runVariants),
      options(3, 'Bike intervals', 'bike-intervals-90', bikeVariants),
      options(6, 'Swim intervals', 'swim-intervals-60', swimVariants),
    ],
  },
  {
    slug: 'triathlon-build',
    version: 1,
    name: 'Triathlon Build',
    volumeLabel: '6–8 hours',
    summary: 'Two swims, run and bike intervals, and a long run or ride to end the week.',
    slots: [
      recoveryDay('monday-recovery', 0),
      options(1, 'Run intervals', 'run-intervals-75', runVariants),
      session(2, 'swim-technique'),
      options(3, 'Bike intervals', 'bike-intervals-90', bikeVariants),
      recoveryDay('friday-recovery', 4),
      options(5, 'Swim intervals', 'swim-intervals-60', swimVariants),
      { id: 'sunday-endurance', weekday: 6, label: 'Long endurance workout', options: [option('long-run'), option('long-ride')] },
    ],
  },
  {
    slug: 'triathlon-high-volume',
    version: 1,
    name: 'Triathlon High Volume',
    volumeLabel: '12–18 hours',
    summary: 'Three swims, three rides, and four runs, including a Saturday bike-to-run brick.',
    volumeNote: 'Wednesday’s Zone 1 run defaults to 55 minutes. The original plan leaves its duration open.',
    slots: [
      session(0, 'easy-ride'),
      options(1, 'Run intervals', 'run-intervals-90', runVariants),
      session(2, 'easy-run'),
      session(2, 'swim-technique'),
      options(3, 'Bike intervals', 'bike-intervals-120', bikeVariants),
      session(4, 'morning-swim'),
      session(5, 'brick-ride'),
      session(5, 'brick-run'),
      options(6, 'Swim intervals', 'swim-intervals-90', swimVariants),
      session(6, 'long-run'),
    ],
  },
];

export function getBuiltInPlan(slug: string) {
  return builtInPlans.find((plan) => plan.slug === slug);
}

/** Built-in plans that offer this public workout, as a default or an alternative. */
export function plansWithWorkout(slug: string) {
  return builtInPlans
    .filter((plan) => plan.slots.some((slot) => slot.options.some((entry) => entry.workout?.slug === slug)))
    .map(({ slug: planSlug, name }) => ({ slug: planSlug, name }));
}

export const builtInPlanPreviews: BuiltInPlanPreview[] = builtInPlans.map((plan) => ({
  ...plan,
  slots: plan.slots.map(({ id, weekday, label, options: [first, ...rest] }) => ({
    id, weekday, label,
    options: [previewOption(first), ...rest.map(previewOption)],
  })),
}));

function previewOption({ id, title, sport, durationSec }: CatalogOption): PlanWorkoutOption {
  return { id, title, sport, durationSec };
}
