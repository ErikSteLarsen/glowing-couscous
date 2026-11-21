'use client';

import type { ComponentProps, KeyboardEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { LibraryBrowser } from '@/components/library/LibraryBrowser';
import { WorkoutLibraryClient } from '@/components/WorkoutLibraryClient';
import { getSwitchOptionClassName, switchTrackClassName } from '@/components/ui';
import { athleteWorkoutsHref, resolveWorkoutTab, type WorkoutTab } from '@/lib/athlete-workouts-navigation';
import { parseCatalogQuery, type CatalogEntry } from '@/lib/workout-catalog/query';

const labels = {
  mine: { title: 'My workouts', hint: 'Yours to edit, schedule and share.' },
  library: { title: 'Public library', hint: 'Ready-made workouts for everyone. Customize one to make it yours.' },
} satisfies Record<WorkoutTab, { title: string; hint: string }>;

type Props = Omit<ComponentProps<typeof WorkoutLibraryClient>, 'role' | 'listIntro' | 'collections' | 'designDirection'> & {
  catalogEntries: CatalogEntry[] | null;
};

export function FocusWorkouts({ catalogEntries, ...libraryProps }: Props) {
  const searchParams = useSearchParams();
  const tab = resolveWorkoutTab(searchParams.get('tab'), libraryProps.workouts.length);
  const tabs = [
    { id: 'mine', count: libraryProps.workouts.length },
    { id: 'library', count: catalogEntries?.length ?? 0 },
  ] satisfies { id: WorkoutTab; count: number }[];

  function selectTab(next: WorkoutTab, focus = false) {
    if (next !== tab) {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', next);
      window.history.pushState(null, '', athleteWorkoutsHref(params));
    }
    if (focus) requestAnimationFrame(() => document.getElementById(`workout-tab-${next}`)?.focus());
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next = {
      ArrowLeft: (index + last) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[next].id, true);
  }

  const listIntro = (
    <>
      <header className="study-workouts__header">
        <div>
          <h1>Workouts</h1>
          <p>{catalogEntries
            ? 'Manage your workouts and browse ready-made bike sessions.'
            : 'Reusable workouts. Scheduling one adds a copy to your Calendar and keeps this version unchanged.'}</p>
        </div>
      </header>
      {catalogEntries ? <div className="space-y-2 max-md:mb-3">
        <div role="tablist" aria-label="Workout collections" className={`${switchTrackClassName} w-full sm:w-fit`}>
          {tabs.map(({ id, count }, index) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`workout-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`workout-panel-${id}`}
              aria-describedby={tab === id ? 'workout-tab-hint' : undefined}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => selectTab(id)}
              onKeyDown={(event) => handleTabKey(event, index)}
              className={`${getSwitchOptionClassName(tab === id)} flex-1 cursor-pointer gap-2 whitespace-nowrap min-h-11`}
            >
              {labels[id].title}
              <span className="data text-xs font-medium text-[var(--text-secondary)]">{count}</span>
            </button>
          ))}
        </div>
        <p id="workout-tab-hint" className="text-sm text-[var(--text-secondary)]">{labels[tab].hint}</p>
      </div> : null}
    </>
  );

  return (
    <main className="study-workouts study-workouts--nocturne">
      <WorkoutLibraryClient
        {...libraryProps}
        role="ATHLETE"
        designDirection="nocturne"
        listIntro={listIntro}
        collections={catalogEntries ? {
          tab,
          onBrowse: () => selectTab('library', true),
          otherPanels: [{
            id: 'library',
            content: <LibraryBrowser entries={catalogEntries} urlQuery={parseCatalogQuery(new URLSearchParams(searchParams))} />,
          }],
        } : null}
      />
    </main>
  );
}
