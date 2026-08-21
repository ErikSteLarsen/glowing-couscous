import { format } from 'date-fns';
import { notFound, redirect } from 'next/navigation';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { ActionLink, EmptyState, PageShell, StatTile, Surface, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { getCoachAthleteDetail } from '@/lib/coach-service';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';

export default async function CoachAthleteDetailPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const { athleteId } = await params;
  const parsedAthleteId = Number(athleteId);
  if (!Number.isInteger(parsedAthleteId) || parsedAthleteId <= 0) {
    notFound();
  }

  const detail = await getCoachAthleteDetail(user.id, parsedAthleteId);

  if (!detail) {
    notFound();
  }

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Athlete detail"
        title={detail.athlete.name}
        description={`Coach: ${detail.athlete.coachName}. ${detail.athlete.activePlan?.goalRace ? `Goal race: ${detail.athlete.activePlan.goalRace}.` : 'No goal race set yet.'}`}
        actions={
          <>
            <ActionLink href="/coach" tone="secondary">
              Back to dashboard
            </ActionLink>
            <ActionLink href={`/coach/planner?athleteId=${detail.athlete.id}`}>Open planner</ActionLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="This week"
          value={`${detail.stats.completedCount} / ${detail.stats.plannedCount}`}
          detail={`${detail.stats.compliancePct}% completed`}
        />
        <StatTile
          label="Planned load"
          value={formatDuration(detail.stats.plannedDurationSec)}
          detail={`${detail.stats.plannedTss} TSS planned`}
        />
        <StatTile
          label="Completed volume"
          value={formatDuration(detail.stats.completedDurationSec)}
          detail={detail.stats.completedCount > 0 ? 'Recorded from completed activities' : 'No completed activities yet'}
        />
        <StatTile label="Next session" value={detail.stats.nextSession} detail={detail.athlete.email} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">This week</p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">
                Week of {format(detail.week.start, 'd MMM yyyy')}
              </h2>
            </div>
            {detail.athlete.activePlan?.name ? (
              <span className="rounded-full border border-[var(--border)] bg-[#FBFAF7] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-secondary)]">
                {detail.athlete.activePlan.name}
              </span>
            ) : null}
          </div>

          {detail.week.days.some((day) => day.sessions.length > 0) ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {detail.week.days.map((day) => (
                <div key={day.fullLabel} className="rounded-[12px] border border-[var(--border)] bg-[#FBFAF7] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{day.shortLabel}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text)]">{day.fullLabel}</p>
                    </div>
                    <MetricText className="text-sm font-semibold text-[var(--text-secondary)]">
                      {day.sessions.length} {day.sessions.length === 1 ? 'session' : 'sessions'}
                    </MetricText>
                  </div>

                  {day.sessions.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {day.sessions.map((session) => (
                        <article key={session.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-[var(--text)]">{session.title}</h3>
                              <p className="mt-1 text-xs text-[var(--text-secondary)]">{getSportLabel(session.sport)}</p>
                            </div>
                            <StatusBadge status={session.status} />
                          </div>
                          <div className="mt-3">
                            <SessionBlockBar segments={session.segments} compact />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
                            <MetricText>{formatDuration(session.durationSec)}</MetricText>
                            <MetricText>{session.tss} TSS</MetricText>
                            <MetricText>
                              {session.completionPct === null ? 'Compliance unavailable' : `${session.completionPct}% compliance`}
                            </MetricText>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--text-secondary)]">No session scheduled.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No sessions planned this week"
              description="Use the planner to assign a template or create the athlete's next block."
            />
          )}
        </Surface>

        <Surface className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Planned vs done</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Recent sessions</h2>
          </div>

          {detail.recentSessions.length > 0 ? (
            <div className="space-y-3">
              {detail.recentSessions.map((session) => (
                <article key={session.id} className="rounded-[12px] border border-[var(--border)] bg-[#FBFAF7] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text)]">{session.title}</h3>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {getSportLabel(session.sport)} · {format(session.date, 'EEE d MMM')}
                      </p>
                    </div>
                    <StatusBadge status={session.status} />
                  </div>

                  <div className="mt-3">
                    <SessionBlockBar segments={session.segments} compact />
                  </div>

                  <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Planned</dt>
                      <dd className="mt-1 text-sm text-[var(--text)]">{formatDuration(session.durationSec)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Done</dt>
                      <dd className="mt-1 text-sm text-[var(--text)]">
                        {session.actualDurationSec ? formatDuration(session.actualDurationSec) : 'Pending'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Compliance</dt>
                      <dd className="mt-1 text-sm text-[var(--text)]">
                        {session.completionPct === null ? 'Unavailable' : `${session.completionPct}%`}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recent sessions"
              description="Once sessions are assigned or completed, this comparison list will appear here."
            />
          )}
        </Surface>
      </div>
    </PageShell>
  );
}
