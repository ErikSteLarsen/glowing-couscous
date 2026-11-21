import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { LibraryWorkoutMenu, catalogScheduleHref } from '@/components/library/LibraryWorkoutMenu';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { secondaryButtonClassName } from '@/components/ui';

export function LibraryWorkoutActions({ slug, name, durationSec, hasSteps, from }: { slug: string; name: string; durationSec: number; hasSteps: boolean; from: 'library' | 'ride' }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <WorkoutStartChooser
        workout={{ title: name, durationSec, sport: 'BIKING', status: 'planned', hasSteps }}
        source={{ kind: 'catalog', slug, from }}
      />
      <Link href={catalogScheduleHref(slug, from)} className={secondaryButtonClassName}>
        <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.6} />Schedule
      </Link>
      <LibraryWorkoutMenu slug={slug} name={name} from={from} />
    </div>
  );
}
