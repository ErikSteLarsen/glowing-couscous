import { isSameDay } from 'date-fns';
import { redirect } from 'next/navigation';
import { EmptyState, PageShell, TopBar } from '@/components/ui';
import { AthleteWeekView } from '@/components/AthleteWeekView';
import { groupSessionsByDay } from '@/lib/demo-data';
import { getCurrentUser } from '@/lib/auth-session';
import { plannerService } from '@/lib/planner-service';
import { prisma } from '@/lib/prisma';

export default async function AthletePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const athleteProfile = await prisma.athleteProfile.findUnique({
    where: { userId: user.id },
  });

  if (!athleteProfile) redirect('/athlete/profile');

  const plannerSnapshot = await plannerService
    .forWeek({ athleteId: athleteProfile.id, weekStart: new Date() })
    .load();

  if (!plannerSnapshot) {
    return (
      <PageShell>
        <EmptyState title="No plan yet" description="Your coach hasn't created a plan for this week." />
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
