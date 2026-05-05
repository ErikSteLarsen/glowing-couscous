import { format } from 'date-fns';
import { ActionLink, Badge, EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { AthleteCompletionCard } from '@/components/AthleteCompletionCard';
import { WeekStrip } from '@/components/week-strip';
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

      <Surface>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Weekly note</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Week of {format(new Date(plannerSnapshot.week.start), 'd MMM yyyy')}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">{plannerSnapshot.week.weeklyNote || 'No weekly note added yet.'}</p>
          </div>
          <Badge tone="brand">Done + notes</Badge>
        </div>

        <div className="mt-5">
          <WeekStrip days={grouped} />
        </div>
      </Surface>

      <div className="space-y-5">
        {grouped.map((day) => (
          <Surface key={day.fullLabel}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{day.shortLabel}</p>
                <h3 className="mt-1 text-xl font-semibold text-white">{day.fullLabel}</h3>
              </div>
              <Badge tone={day.sessions.length > 0 ? 'brand' : 'neutral'}>{day.sessions.length} sessions</Badge>
            </div>

            <div className="mt-4 space-y-4">
              {day.sessions.length > 0 ? (
                day.sessions.map((session) => <AthleteCompletionCard key={session.id} session={session} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300">
                  No session scheduled for this day.
                </div>
              )}
            </div>
          </Surface>
        ))}
      </div>
    </PageShell>
  );
}
