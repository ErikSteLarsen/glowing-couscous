import { CalendarPlus } from 'lucide-react';
import { LibraryWorkoutMenu, catalogScheduleHref } from '@/components/library/LibraryWorkoutMenu';
import { ReturnHereLink } from '@/components/ReturnHereLink';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
import { canStartWorkout, swimStartNote } from '@/lib/workout-start';
import type { CatalogSport } from '@/lib/workout-catalog/types';

/** On phones Start workout takes its own row, so detail actions line up the same for public and saved workouts. */
export const startTriggerClassName = `${primaryButtonClassName} max-md:min-h-11 max-sm:basis-full`;

/** Add to Calendar is the main action of a workout that can't be started; Cancel comes back here. */
export function ScheduleLink({ href, primary }: { href: string; primary: boolean }) {
  return (
    <ReturnHereLink href={href} className={`${primary ? primaryButtonClassName : secondaryButtonClassName} max-md:min-h-11`}>
      <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.6} />Add to Calendar
    </ReturnHereLink>
  );
}

export function SwimStartNote() {
  return <p className="max-w-[68ch] text-[13px] text-[var(--text-secondary)]">{swimStartNote}</p>;
}

export function LibraryWorkoutActions({ slug, name, sport, durationSec, hasSteps, from }: { slug: string; name: string; sport: CatalogSport; durationSec: number; hasSteps: boolean; from: 'library' | 'ride' }) {
  const workout = { title: name, durationSec, sport, status: 'planned', hasSteps };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <WorkoutStartChooser workout={workout} source={{ kind: 'catalog', slug, from }} triggerClassName={startTriggerClassName} />
        <ScheduleLink href={catalogScheduleHref(slug, from)} primary={!canStartWorkout(workout)} />
        <LibraryWorkoutMenu slug={slug} sport={sport} name={name} from={from} />
      </div>
      {sport === 'SWIMMING' ? <SwimStartNote /> : null}
    </div>
  );
}
