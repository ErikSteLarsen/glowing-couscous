import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { AthleteWeekView } from '@/components/AthleteWeekView';
import { SignOutButton } from '@/components/SignOutButton';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { groupSessionsByDay } from '@/lib/week';

export default async function AthletePage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { weekStart: weekStartParam } = await searchParams;
  const fallbackWeekStart = resolveWeekStartDate(weekStartParam);
  const previousWeekStart = format(addDays(fallbackWeekStart, -7), 'yyyy-MM-dd');
  const nextWeekStart = format(addDays(fallbackWeekStart, 7), 'yyyy-MM-dd');

  const athleteContext = await athleteService.loadWeekByUserId(user.id, weekStartParam ?? fallbackWeekStart);
  if (!athleteContext) redirect('/athlete/profile');

  const plannerSnapshot = athleteContext.snapshot;

  if (!plannerSnapshot) {
    return (
      <PageShell>
        <TopBar
          eyebrow="Athlete week"
          title={user.name}
          description="Your coach hasn't created a plan for this week yet."
          actions={
            <>
              <ActionLink href={`/athlete?weekStart=${previousWeekStart}`} tone="secondary">
                Previous week
              </ActionLink>
              <ActionLink href={`/athlete?weekStart=${nextWeekStart}`}>Next week</ActionLink>
              <SignOutButton />
            </>
          }
        />
        <EmptyState title="No plan yet" description="Try another week while your coach is still building your schedule." />
      </PageShell>
    );
  }

  const grouped = groupSessionsByDay(
    plannerSnapshot.sessions.map((session) => ({
      ...session,
      scheduledDate: new Date(session.scheduledDate),
      completion: session.completion
        ? {
            ...session.completion,
            completedAt: session.completion.completedAt ? new Date(session.completion.completedAt) : null,
          }
        : null,
    })),
    new Date(plannerSnapshot.week.start),
  );

  const today = new Date();
  const todayIndex = grouped.findIndex((day) => isSameDay(day.date, today));

  return (
    <PageShell>
      <TopBar
        eyebrow="Athlete week"
        title={user.name}
        description={`Weekly plan from ${plannerSnapshot.athlete.coachName}.`}
        actions={
          <>
            <ActionLink href={`/athlete?weekStart=${plannerSnapshot.week.previousStart}`} tone="secondary">
              Previous week
            </ActionLink>
            <ActionLink href={`/athlete?weekStart=${plannerSnapshot.week.nextStart}`}>Next week</ActionLink>
            <SignOutButton />
          </>
        }
      />
      <AthleteWeekView
        weeklyNote={plannerSnapshot.week.weeklyNote}
        weekStart={new Date(plannerSnapshot.week.start)}
        days={grouped}
        todayIndex={todayIndex}
      />
    </PageShell>
  );
}

function resolveWeekStartDate(weekStartParam?: string) {
  const requestedDate = weekStartParam ? new Date(weekStartParam) : new Date();
  const safeDate = Number.isNaN(requestedDate.getTime()) ? new Date() : requestedDate;
  return startOfWeek(safeDate, { weekStartsOn: 1 });
}
