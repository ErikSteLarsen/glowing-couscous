import { redirect } from 'next/navigation';

import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { athletePlannerService } from '@/lib/athlete-planner-service';
import { parseCalendarDay } from '@/lib/calendar-navigation';
import { resolvePlannerSourceSelection } from '@/lib/planner-source-selection';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { todayInZone } from '@/lib/user-time';
import { workoutLibraryService } from '@/lib/workout-library-service';

import { AthletePlannerClient } from './AthletePlannerClient';

export default async function AthletePlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; source?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { date, source } = await searchParams;
  const today = todayInZone(await getRequestTimeZone());
  const initialDate = parseCalendarDay(date) ?? today;
  const [workspace, workouts] = await Promise.all([
    athletePlannerService.loadWorkspace(user.id, initialDate, { includeWeek: false }),
    workoutLibraryService.listForOwner('athlete', user.id),
  ]);
  const initialSource = resolvePlannerSourceSelection(source, {
    workoutIds: workouts.map((workout) => workout.id),
    templateIds: workspace.templates.map((template) => template.id),
  });
  const initialMessage = source && !initialSource ? 'That saved item is no longer available in your library.' : '';

  return (
    <PageShell size="wall">
      <TopBar title="Planner" />
      <AthletePlannerClient
        templates={workspace.templates}
        workouts={workouts}
        calendarDays={workspace.calendarDays}
        calendarLabel={workspace.calendar.label}
        initialDate={initialDate}
        today={today}
        initialSourceKey={initialSource?.key ?? ''}
        initialSourceTab={initialSource?.tab ?? 'workout'}
        initialMessage={initialMessage}
      />
    </PageShell>
  );
}
