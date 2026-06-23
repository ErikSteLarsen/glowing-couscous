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
      <PageShell size="wide">
        <EmptyState title="No coach data found" description="The coach workspace could not be loaded." />
      </PageShell>
    );
  }

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Athletes"
        title="Your athletes"
        description={`${coach.athletes.length} active athletes${coach.pendingRequests.length ? ` · ${coach.pendingRequests.length} pending requests` : ''}.`}
        actions={
          <ActionLink href="/coach/templates" tone="secondary">
            Open templates
          </ActionLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Athletes" value={String(coach.athletes.length)} detail="Active roster" />
        <StatTile
          label="Pending requests"
          value={String(coach.pendingRequests.length)}
          detail="Awaiting coach response"
        />
        <StatTile
          label="Planned sessions"
          value={String(coach.athletes.reduce((total, athlete) => total + athlete.plannedCount, 0))}
          detail="Current week"
        />
      </div>

      {coach.pendingRequests.length > 0 ? <CoachRequestsPanel /> : null}

      <Surface>
        <div className="grid gap-3">
          {coach.athletes.map((athlete) => (
            <a
              key={athlete.id}
              href={`/coach/athletes/${athlete.id}`}
              className="grid gap-4 rounded-[12px] border border-[var(--border)] bg-[#FBFAF7] p-4 lg:grid-cols-[1.6fr_1fr_1fr]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-semibold text-[var(--text)]">{athlete.name}</h2>
                  <Badge tone={athlete.flag.tone}>{athlete.flag.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{athlete.email}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  This week
                </p>
                <p className="metric-text mt-2 text-[18px] font-semibold text-[var(--text)]">
                  {athlete.completedCount} / {athlete.plannedCount}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{athlete.compliancePct}% complete</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Next session
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{athlete.nextSession}</p>
              </div>
            </a>
          ))}
        </div>
      </Surface>
    </PageShell>
  );
}
