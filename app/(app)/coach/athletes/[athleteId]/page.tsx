import { format } from 'date-fns';
import { notFound, redirect } from 'next/navigation';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { ActionLink, EmptyState, PageShell, StatTile, Surface, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { getCoachAthleteDetail } from '@/lib/coach-service';
import { getCoachAthleteReturnTarget } from '@/lib/app-navigation';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { SessionComparisonDialog } from '@/components/SessionComparisonDialog';
import { ShareLinkButton } from '@/components/ShareLinkButton';

export default async function CoachAthleteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ from?: string; date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const [{ athleteId }, { from, date }] = await Promise.all([params, searchParams]);
  const parsedAthleteId = Number(athleteId);
  if (!Number.isInteger(parsedAthleteId) || parsedAthleteId <= 0) {
    notFound();
  }

  const detail = await getCoachAthleteDetail(user.id, parsedAthleteId);

  if (!detail) {
    notFound();
  }

  const returnTarget = getCoachAthleteReturnTarget(from, parsedAthleteId, date);
  const todayIso = format(new Date(), 'yyyy-MM-dd');

  return (
    <PageShell>
      <TopBar
        title={detail.athlete.name}
        description={`Coach: ${detail.athlete.coachName}. ${detail.athlete.activePlan?.goalRace ? `Goal race: ${detail.athlete.activePlan.goalRace}.` : 'No goal race set yet.'}`}
        back={returnTarget}
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

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section aria-labelledby="coach-week-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="coach-week-heading" className="text-lg font-semibold text-[var(--text)]">
                Week of {format(detail.week.start, 'd MMM yyyy')}
              </h2>
            </div>
            {detail.athlete.activePlan?.name ? (
              <span className="rounded-full border border-[var(--border)] bg-[var(--field-surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-secondary)]">
                {detail.athlete.activePlan.name}
              </span>
            ) : null}
          </div>

          {detail.week.days.some((day) => day.sessions.length > 0) ? (
            <div className="grid gap-x-3 gap-y-6 md:grid-cols-2 2xl:grid-cols-7">
              {detail.week.days.map((day) => (
                <section key={day.fullLabel} aria-labelledby={`coach-day-${day.dayNumber}`} className={`min-w-0 border-t pt-3 2xl:border-t-0 2xl:border-l 2xl:pl-3 ${day.date && format(day.date, 'yyyy-MM-dd') === todayIso ? 'border-[var(--brand)] bg-[var(--brand-tint)] px-3 2xl:rounded-[8px]' : 'border-[var(--border)]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 id={`coach-day-${day.dayNumber}`} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{day.shortLabel}</h3>
                      <p className="mt-1 text-sm font-semibold text-[var(--text)]">{day.fullLabel}</p>
                    </div>
                    <ActionLink href={`/coach/planner?athleteId=${detail.athlete.id}&date=${format(day.date, 'yyyy-MM-dd')}`} tone="ghost" size="compact">Assign</ActionLink>
                  </div>

                  {day.sessions.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {day.sessions.map((session) => (
                        <article key={session.id} className="min-w-0 border-t border-[var(--border)] pt-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="break-words text-sm font-semibold text-[var(--text)]">{session.title}</h4>
                              <p className="mt-1 text-xs text-[var(--text-secondary)]">{getSportLabel(session.sport)}</p>
                            </div>
                             <div className="flex flex-wrap items-center justify-end gap-2">
                               <StatusBadge status={session.status} />
                                <SessionComparisonDialog
                                  sessionId={session.id}
                                  endpoint={`/api/coach/sessions/${session.id}/comparison`}
                           perspective="coach"
                                   label={`Compare ${session.title}`}
                                 />
                                  <ShareLinkButton sourceKind="session" sourceId={session.id} ariaLabel={`Create a share link for ${session.title}`} />
                             </div>
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
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No sessions planned this week"
              description="Assign a session in Planner."
              action={<ActionLink href={`/coach/planner?athleteId=${detail.athlete.id}`}>Plan next session</ActionLink>}
            />
          )}
        </section>

        <Surface className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Planned vs done</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Recent sessions</h2>
          </div>

          {detail.recentSessions.length > 0 ? (
            <div className="space-y-3">
              {detail.recentSessions.map((session) => (
                <article key={session.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--field-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text)]">{session.title}</h3>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {getSportLabel(session.sport)} · {format(session.date, 'EEE d MMM')}
                      </p>
                    </div>
                     <div className="flex flex-wrap items-center justify-end gap-2">
                       <StatusBadge status={session.status} />
                         <SessionComparisonDialog
                           sessionId={session.id}
                           endpoint={`/api/coach/sessions/${session.id}/comparison`}
                           perspective="coach"
                           label={`Compare ${session.title}`}
                         />
                          <ShareLinkButton sourceKind="session" sourceId={session.id} ariaLabel={`Create a share link for ${session.title}`} />
                     </div>
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
              description="No comparison data yet."
            />
          )}
        </Surface>
      </div>
    </PageShell>
  );
}
