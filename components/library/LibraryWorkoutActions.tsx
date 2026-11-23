import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { LibraryWorkoutMenu, catalogScheduleHref } from '@/components/library/LibraryWorkoutMenu';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';

/** On phones Start workout takes its own row, so detail actions line up the same for public and saved workouts. */
export const startTriggerClassName = `${primaryButtonClassName} max-md:min-h-11 max-sm:basis-full`;

export function LibraryWorkoutActions({ slug, name, durationSec, hasSteps, from }: { slug: string; name: string; durationSec: number; hasSteps: boolean; from: 'library' | 'ride' }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <WorkoutStartChooser
        workout={{ title: name, durationSec, sport: 'BIKING', status: 'planned', hasSteps }}
        source={{ kind: 'catalog', slug, from }}
        triggerClassName={startTriggerClassName}
      />
      <Link href={catalogScheduleHref(slug, from)} className={`${secondaryButtonClassName} max-md:min-h-11`}>
        <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.6} />Schedule
      </Link>
      <LibraryWorkoutMenu slug={slug} name={name} from={from} />
    </div>
  );
}
