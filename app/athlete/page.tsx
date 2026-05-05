import { isSameDay } from 'date-fns';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { AthleteWeekView } from '@/components/AthleteWeekView';
import { groupSessionsByDay } from '@/lib/demo-data';
import { getCurrentAthleteUser } from '@/lib/demo-session';
import { plannerService } from '@/lib/planner-service';

export default async function AthletePage() {
  const athlete = await getCurrentAthleteUser();

  if (!athlete?.athleteProfile) {
    return (
      <PageShell>
        <EmptyState title="No athlete data found" description="Seed the database to load the demo athlete week view." />
      </PageShell>
    );
  }

  const plannerSnapshot = await plannerService.forWeek({ athleteId: athlete.athleteProfile.id, weekStart: new Date() }).load();

  if (!plannerSnapshot) {
    return (
      <PageShell>
        <EmptyState title="No athlete data found" description="Seed the database to load the demo athlete week view." />
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
        title={athlete.name}
        description={`Weekly plan from ${plannerSnapshot.athlete.coachName}. The athlete view prioritizes clear reading, weekly context, and lightweight completion feedback.`}
        actions={
          <>
            <ActionLink href="/" tone="secondary">
              Switch role
            </ActionLink>
            <ActionLink href="/coach">Open coach demo</ActionLink>
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
