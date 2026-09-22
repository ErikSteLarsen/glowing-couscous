import { formatISO } from 'date-fns';
import { redirect } from 'next/navigation';

import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { coachPlannerService } from '@/lib/coach-planner-service';

import { PlannerClient } from './PlannerClient';

export default async function CoachPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; athleteId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const { date, athleteId } = await searchParams;
  const workspace = await coachPlannerService.loadWorkspace(user.id, date);
  const parsedAthleteId = Number(athleteId);

  return (
    <PageShell>
      <TopBar
        title="Planner"
      />
      <PlannerClient
        athletes={workspace.athletes}
        templates={workspace.templates}
        librarySessions={workspace.librarySessions}
        trainingPlans={workspace.trainingPlans}
        calendarDays={workspace.calendarDays}
        calendarLabel={workspace.calendar.label}
        initialAthleteId={
          Number.isInteger(parsedAthleteId) && workspace.athletes.some((a) => a.id === parsedAthleteId)
            ? parsedAthleteId
            : workspace.athletes[0]?.id ?? null
        }
        initialDate={date ?? formatISO(new Date(), { representation: 'date' })}
      />
    </PageShell>
  );
}
