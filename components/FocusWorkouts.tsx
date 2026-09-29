import type { ComponentProps } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { MobileLibrarySwitch } from '@/components/MobileLibrarySwitch';
import { WorkoutLibraryClient } from '@/components/WorkoutLibraryClient';

type LibraryProps = ComponentProps<typeof WorkoutLibraryClient>;

export function FocusWorkouts(libraryProps: LibraryProps) {
  return (
    <main className="study-workouts study-workouts--nocturne">
      <header className="study-workouts__header">
        <div>
          <h1>Workouts</h1>
          <p>Create once. Refine when you need to. Add a copy to Planner when it is ready.</p>
        </div>
        <div className="study-workouts__header-count"><strong>{libraryProps.workouts.length}</strong><span>saved {libraryProps.workouts.length === 1 ? 'workout' : 'workouts'}</span><ArrowUpRight size={18} aria-hidden="true" /></div>
      </header>
      <MobileLibrarySwitch active="workouts" />
      <WorkoutLibraryClient {...libraryProps} designDirection="nocturne" />
    </main>
  );
}
