import { formatISO, isValid, parseISO } from 'date-fns';
import { redirect } from 'next/navigation';

import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athletePlannerService } from '@/lib/athlete-planner-service';
import { workoutLibraryService } from '@/lib/workout-library-service';

import { AthletePlannerClient } from './AthletePlannerClient';

export default async function AthletePlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const { date } = await searchParams;
  const [workspace, workouts] = await Promise.all([
    athletePlannerService.loadWorkspace(user.id, date),
    workoutLibraryService.listForOwner('athlete', user.id),
  ]);
  const requestedDate = date ? parseISO(date) : new Date();
  const resolvedDate = isValid(requestedDate) ? requestedDate : new Date();
  const initialDate = formatISO(resolvedDate, { representation: 'date' });

  return (
    <PageShell>
      <TopBar title="Planner" description="Schedule workouts and templates on your calendar." />
      <AthletePlannerClient
        templates={workspace.templates}
        workouts={workouts}
        calendarDays={workspace.calendarDays}
        calendarLabel={workspace.calendar.label}
        initialDate={initialDate}
      />
    </PageShell>
  );
}
