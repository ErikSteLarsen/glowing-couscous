import type { ComponentProps } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LibraryBig } from 'lucide-react';
import { MobileLibrarySwitch } from '@/components/MobileLibrarySwitch';
import { WorkoutLibraryClient } from '@/components/WorkoutLibraryClient';

type LibraryProps = ComponentProps<typeof WorkoutLibraryClient>;

export function FocusWorkouts(libraryProps: LibraryProps) {
  // The page header belongs to the list: the editor replaces both when it opens.
  const listIntro = (
    <>
      <header className="study-workouts__header">
        <div>
          <h1>Workouts</h1>
          <p>Reusable workouts. Scheduling one adds a copy to your Calendar and keeps this version unchanged.</p>
          {libraryProps.role === 'ATHLETE' ? (
            <Link href="/athlete/library" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-[var(--brand)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]">
              <LibraryBig aria-hidden="true" size={15} strokeWidth={1.6} />Browse built-in bike workouts
            </Link>
          ) : null}
        </div>
        <div className="study-workouts__header-count"><strong>{libraryProps.workouts.length}</strong><span>saved {libraryProps.workouts.length === 1 ? 'workout' : 'workouts'}</span><ArrowUpRight size={18} aria-hidden="true" /></div>
      </header>
      <MobileLibrarySwitch active="workouts" />
    </>
  );

  return (
    <main className="study-workouts study-workouts--nocturne">
      <WorkoutLibraryClient {...libraryProps} designDirection="nocturne" listIntro={listIntro} />
    </main>
  );
}
