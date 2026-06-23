import { notFound } from 'next/navigation';
import { ActionLink, PageShell, TopBar } from '@/components/ui';
import { CoachPlannerClient } from './CoachPlannerClient';
import { plannerService } from '@/lib/planner-service';

export default async function CoachAthletePlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ weekStart?: string }>;
}) {
  const { athleteId } = await params;
  const { weekStart: weekStartParam } = await searchParams;
  const planner = plannerService.forWeek({ athleteId: Number(athleteId), weekStart: weekStartParam ?? new Date() });
  const plannerSnapshot = await planner.load({ includeTemplates: true, includePreviousWeekPrefill: true });

  if (!plannerSnapshot) {
    notFound();
  }

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Coach planner"
        title={plannerSnapshot.athlete.name}
        description={`Hybrid week planner with a compact week strip and a focused day view. Coach: ${plannerSnapshot.athlete.coachName}.`}
        actions={
          <>
            <ActionLink href="/coach" tone="secondary">
              Back to dashboard
            </ActionLink>
            <ActionLink href={`/coach/athletes/${plannerSnapshot.athlete.profileId}?weekStart=${plannerSnapshot.week.previousStart}`} tone="secondary">
              Previous week
            </ActionLink>
            <ActionLink href={`/coach/athletes/${plannerSnapshot.athlete.profileId}?weekStart=${plannerSnapshot.week.nextStart}`}>Next week</ActionLink>
          </>
        }
      />

      <CoachPlannerClient
        athleteId={plannerSnapshot.athlete.profileId}
        athleteName={plannerSnapshot.athlete.name}
        coachName={plannerSnapshot.athlete.coachName}
        weekStart={plannerSnapshot.week.start}
        weeklyNote={plannerSnapshot.week.weeklyNote}
        sessions={plannerSnapshot.sessions}
        templates={plannerSnapshot.templates}
        previousSessions={plannerSnapshot.previousWeekSessions.map((session) => ({ ...session, completion: null }))}
      />
    </PageShell>
  );
}
