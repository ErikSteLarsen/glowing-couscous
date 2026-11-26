import { MetricPair } from '@/components/wattonaut/MetricPair';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, StatTile, Surface, TopBar, Badge } from '@/components/ui';
import { CoachRequestsPanel } from '@/components/CoachRequestsPanel';
import { getCurrentUser } from '@/lib/auth-session';
import { getCoachOverview } from '@/lib/coach-service';

export default async function CoachPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const coach = await getCoachOverview(user.id);

  if (!coach) {
    return (
      <PageShell>
        <TopBar title="Your athletes" />
        <EmptyState title="Couldn’t load your athletes" description="Reload the page to try again." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <TopBar
        title="Your athletes"
        description="Review your athletes and manage connection requests."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Athletes" value={String(coach.athletes.length)} detail="Active roster" />
        <StatTile
          label="Pending requests"
          value={String(coach.pendingRequests.length)}
          detail="Waiting for your answer"
        />
        <StatTile
          label="Planned workouts"
          value={String(coach.athletes.reduce((total, athlete) => total + athlete.plannedCount, 0))}
          detail="Current week"
        />
      </div>

      {coach.pendingRequests.length > 0 ? <CoachRequestsPanel /> : null}

      {coach.athletes.length === 0 ? (
        <EmptyState
          title="No athletes in your roster"
          description={coach.pendingRequests.length > 0 ? 'Review pending requests above to build your roster.' : 'Accepted athletes will appear here with their current training week.'}
        />
      ) : (
        <Surface>
          <div className="space-y-2">
            {coach.athletes.map((athlete) => (
              <article key={athlete.id} className="grid gap-4 border-b border-[var(--border)] py-4 last:border-b-0 lg:grid-cols-[1.4fr_0.8fr_1fr_auto] lg:items-center">
                <a
                  href={`/coach/athletes/${athlete.id}?from=roster`}
                  className="min-w-0 rounded-[8px] hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="break-words text-[15px] font-semibold text-[var(--text)]">{athlete.name}</h2>
                    <Badge tone={athlete.flag.tone}>{athlete.flag.label}</Badge>
                  </div>
                  <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{athlete.email}</p>
                </a>
                <div>
                  <dl>
                    <MetricPair label="This week" value={`${athlete.completedCount} / ${athlete.plannedCount}`} />
                  </dl>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{athlete.compliancePct}% complete</p>
                </div>
                <dl>
                  <MetricPair label="Next workout" value={athlete.nextSession} />
                </dl>
                <ActionLink href={`/coach/planner?athleteId=${athlete.id}`} tone="secondary" size="compact">Plan next workout</ActionLink>
              </article>
            ))}
          </div>
        </Surface>
      )}
    </PageShell>
  );
}
