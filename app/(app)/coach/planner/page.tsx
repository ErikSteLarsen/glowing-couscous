import { redirect } from 'next/navigation';

import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { coachPlannerService } from '@/lib/coach-planner-service';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { todayInZone } from '@/lib/user-time';

import { PlannerClient } from './PlannerClient';

export default async function CoachPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; athleteId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const { date, athleteId } = await searchParams;
  const today = todayInZone(await getRequestTimeZone());
  const workspace = await coachPlannerService.loadWorkspace(user.id, date ?? today);
  const parsedAthleteId = Number(athleteId);

  return (
    <PageShell>
      <TopBar
        title="Planner"
        description="Schedule workouts and plans for your athletes."
      />
      <PlannerClient
        athletes={workspace.athletes}
        librarySessions={workspace.librarySessions}
        trainingPlans={workspace.trainingPlans}
        calendarDays={workspace.calendarDays}
        calendarLabel={workspace.calendar.label}
        initialAthleteId={
          Number.isInteger(parsedAthleteId) && workspace.athletes.some((a) => a.id === parsedAthleteId)
            ? parsedAthleteId
            : workspace.athletes[0]?.id ?? null
        }
        initialDate={date ?? today}
        today={today}
      />
    </PageShell>
  );
}
