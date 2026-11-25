import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageShell } from '@/components/ui';
import { CalendarPlacement } from '@/app/(app)/athlete/calendar/CalendarPlacement';
import { loadPlacementWorkspace } from '@/app/(app)/athlete/calendar/placement-existing';
import { parseBackOrigin, withBackOrigin } from '@/lib/app-navigation';
import { getCurrentUser } from '@/lib/auth-session';
import { parseCalendarDay } from '@/lib/calendar-navigation';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { addDayKeys } from '@/lib/training-load';
import { todayInZone } from '@/lib/user-time';
import { workoutCatalog } from '@/lib/workout-catalog';
import { catalogWorkoutMetrics } from '@/lib/workout-catalog/metrics';
import { findCatalogWorkout } from '@/lib/workout-catalog/query';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string; date?: string }> };

export const metadata: Metadata = { title: 'Schedule workout' };

/** Library Schedule: the Calendar's Add workout flow with this built-in workout chosen, tomorrow by default. */
export default async function ScheduleLibraryWorkoutPage({ params, searchParams }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const [{ slug }, { from, date }] = await Promise.all([params, searchParams]);
  const workout = findCatalogWorkout(workoutCatalog, slug);
  if (!workout) notFound();

  const day = parseCalendarDay(date) ?? addDayKeys(todayInZone(await getRequestTimeZone()), 1);
  const { existing } = await loadPlacementWorkspace(user.id, day);
  const detailHref = withBackOrigin(`/athlete/library/${encodeURIComponent(workout.slug)}`, parseBackOrigin('library-workout', from));

  return (
    <PageShell>
      <CalendarPlacement
        view="week"
        placement="workout"
        workouts={[]}
        routines={[]}
        existing={existing}
        initialDate={day}
        initialSourceKey=""
        initialMessage=""
        catalog={{
          slug: workout.slug,
          title: workout.name,
          sport: workout.sport,
          durationSec: catalogWorkoutMetrics(workout).durationSec,
          back: { href: detailHref, destination: workout.name, label: `Back to ${workout.name}` },
        }}
      />
    </PageShell>
  );
}
