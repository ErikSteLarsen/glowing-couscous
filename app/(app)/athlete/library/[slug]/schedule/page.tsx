import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-session';
import { getCalendarPlacementHref, parseCalendarDay, parseCalendarReturn } from '@/lib/calendar-navigation';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { addDayKeys } from '@/lib/training-load';
import { todayInZone } from '@/lib/user-time';
import { workoutCatalog } from '@/lib/workout-catalog';
import { findCatalogWorkout } from '@/lib/workout-catalog/query';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ date?: string; back?: string }> };

/**
 * Library Add to Calendar: the Calendar's Add workout dialog with this public
 * workout chosen, tomorrow by default. Cancel returns to `back` or the workout.
 */
export default async function ScheduleLibraryWorkoutPage({ params, searchParams }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const [{ slug }, { date, back }] = await Promise.all([params, searchParams]);
  const workout = findCatalogWorkout(workoutCatalog, slug);
  if (!workout) notFound();

  const day = parseCalendarDay(date) ?? addDayKeys(todayInZone(await getRequestTimeZone()), 1);
  redirect(getCalendarPlacementHref(`catalog:${workout.slug}`, {
    date: day,
    back: parseCalendarReturn(back) ?? `/athlete/library/${encodeURIComponent(workout.slug)}`,
  }));
}
