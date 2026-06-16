import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, Badge, EmptyState, PageShell, StatTile, Surface, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { getCoachOverview } from '@/lib/coach-service';
import { CoachRequestsPanel } from '@/components/CoachRequestsPanel';
import { SignOutButton } from '@/components/SignOutButton';

export default async function CoachPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const coach = await getCoachOverview(user.id);

  if (!coach) {
    return (
      <PageShell>
        <EmptyState title="No data found" description="Something went wrong loading your dashboard." />
      </PageShell>
    );
  }

  const athleteRows = coach.coachedAthletes.map((athlete) => {
    const currentWeek = athlete.planWeeks[0];
    const sessionCount = currentWeek?.sessions.length ?? 0;
    const status = sessionCount >= 4 ? 'Well planned' : sessionCount > 0 ? 'Partially planned' : 'Empty week';
    return {
      id: athlete.id,
      athleteName: athlete.user.name,
      email: athlete.user.email,
      sessionCount,
      status,
      weekStart: currentWeek?.weekStart ?? null,
      weeklyNote: currentWeek?.weeklyNote ?? null,
    };
  });

  return (
    <PageShell>
      <TopBar
        eyebrow="Coach dashboard"
        title={coach.name}
        description="Athlete list and upcoming week status."
        actions={
          <>
            <ActionLink href="/coach/templates">Templates</ActionLink>
            <SignOutButton />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Athletes" value={String(athleteRows.length)} detail="Coach-owned roster" />
        <StatTile
          label="Planned sessions"
          value={String(athleteRows.reduce((total, row) => total + row.sessionCount, 0))}
          detail="Current week"
        />
        <StatTile
          label="Strong weeks"
          value={String(athleteRows.filter((row) => row.status === 'Well planned').length)}
          detail="4 or more sessions scheduled"
        />
      </div>

      <CoachRequestsPanel />

      <Surface>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Roster</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Athletes and week readiness</h2>
          </div>
          <Badge tone="brand">Week planner only</Badge>
        </div>

        <div className="mt-5 space-y-4">
          {athleteRows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{row.athleteName}</h3>
                    <Badge tone={row.status === 'Well planned' ? 'success' : row.status === 'Empty week' ? 'warning' : 'neutral'}>
                      {row.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-300">{row.email}</p>
                  <p className="text-sm text-slate-300">
                    {row.weekStart ? `Week of ${format(row.weekStart, 'd MMM yyyy')}` : 'No active week plan yet'}
                  </p>
                  {row.weeklyNote ? <p className="max-w-2xl text-sm text-slate-300">{row.weeklyNote}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Sessions</p>
                    <p className="mt-1 text-lg font-semibold text-white">{row.sessionCount}</p>
                  </div>
                  <ActionLink href={`/coach/athletes/${row.id}`}>Open planner</ActionLink>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </PageShell>
  );
}
