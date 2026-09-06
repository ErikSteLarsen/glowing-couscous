import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ActionLink, EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { MetricText } from '@/components/tempo/MetricText';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { getSportLabel } from '@/lib/sport';

function formatDuration(durationSec: number) {
  const hours = Math.floor(durationSec / 3600);
  const minutes = Math.round((durationSec % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  return `${minutes}m`;
}

export default async function AthletePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const dashboard = await athleteService.loadHomeDashboard(user.id);
  if (!dashboard) redirect('/athlete/find-coach');

  return (
    <PageShell size="wide">
      <TopBar
        title={`Good morning, ${dashboard.athlete.name}`}
        actions={
          <ActionLink href="/athlete/calendar" tone="secondary">
            Open calendar
          </ActionLink>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_312px]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                Today
              </span>
              <span className="text-[12px] text-[#B6B0A4]">
                {dashboard.todaySessions.length} sessions
              </span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <div className="space-y-3">
              {dashboard.todaySessions.length > 0 ? (
                dashboard.todaySessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/athlete/session/${session.id}?from=home`}
                    aria-label={`Open ${session.title}`}
                    className="group block rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                  >
                    <Surface className="space-y-3 transition group-hover:border-[var(--field-focus)] group-hover:bg-[var(--field-surface)]">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[13px] font-semibold text-[var(--text-muted)]">
                          {session.timeLabel}
                        </span>
                        <h2 className="min-w-0 flex-1 break-words text-[15px] font-semibold text-[var(--text)]">
                          {session.title} · {getSportLabel(session.sport)}
                        </h2>
                      </div>
                      <SessionBlockBar segments={session.segments} />
                      <div className="flex flex-wrap items-center gap-4 text-[13px] text-[var(--text-secondary)]">
                        <MetricText>{formatDuration(session.durationSec)}</MetricText>
                        <MetricText>{session.tss} TSS</MetricText>
                        {session.targetLabel ? <span>{session.targetLabel}</span> : null}
                      </div>
                    </Surface>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="No sessions today"
                  description="View the calendar for upcoming work."
                />
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                Next days
              </span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {dashboard.nextDays.map((day) => (
                <Surface key={`${day.label}-${day.dateLabel}`} className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                      {day.label}
                    </p>
                    <p className="metric-text mt-1 text-[20px] font-semibold text-[var(--text)]">
                      {day.dateLabel}
                    </p>
                  </div>
                  {day.sessions.length > 0 ? (
                    <div className="space-y-2">
                      {day.sessions.map((session) => (
                        <Link
                          key={session.id}
                          href={`/athlete/session/${session.id}?from=home`}
                          aria-label={`Open ${session.title}`}
                          className="group block space-y-2 rounded-[10px] border border-[var(--border)] bg-[#FBFAF7] p-3 transition hover:border-[var(--field-focus)] hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                        >
                          <p className="break-words text-[13px] font-semibold text-[var(--text)]">{session.title}</p>
                          <p className="text-[12px] text-[var(--text-secondary)]">
                            {session.timeLabel} · {getSportLabel(session.sport)}
                          </p>
                          <SessionBlockBar segments={session.segments} compact />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[var(--text-muted)]">Rest</p>
                  )}
                </Surface>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {dashboard.overviewCards.includes('coachNote') && dashboard.coachNote && dashboard.coach ? (
            <Surface>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-[var(--brand-tint)]" />
                <span className="text-[12.5px] font-semibold text-[#57654E]">
                  Coach {dashboard.coach.name}
                </span>
              </div>
              <p className="text-[13.5px] leading-[1.5] text-[var(--text)]">{dashboard.coachNote}</p>
            </Surface>
          ) : null}

          {dashboard.overviewCards.includes('lastActivity') && dashboard.lastActivity ? (
            <Surface>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Last activity
              </p>
              <p className="mt-3 text-[13.5px] font-semibold text-[var(--text)]">
                {dashboard.lastActivity.title}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                <MetricText>{formatDuration(dashboard.lastActivity.durationSec)}</MetricText> ·{' '}
                <MetricText>{dashboard.lastActivity.tss} TSS</MetricText>
              </p>
            </Surface>
          ) : null}

          {dashboard.overviewCards.includes('weekLoad') ? (
            <Surface>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                This week
              </p>
              <p className="metric-text mt-3 text-[22px] font-semibold tracking-[-0.01em] text-[var(--text)]">
                {formatDuration(dashboard.weekTotals.durationSec)}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                <MetricText>{dashboard.weekTotals.tss} TSS</MetricText>
              </p>
            </Surface>
          ) : null}

          {dashboard.overviewCards.includes('trend') ? (
            <Surface>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Fitness trend
              </p>
              <div className="mt-3 flex items-end gap-2">
                {dashboard.trend.length > 0 ? (
                  dashboard.trend.map((point) => (
                    <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-[4px] bg-[#9DB0C2]"
                        style={{ height: `${Math.max(12, Math.min(52, point.tss / 3))}px` }}
                      />
                      <span className="text-[10px] text-[var(--text-muted)]">{point.label}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">No completed sessions yet.</p>
                )}
              </div>
            </Surface>
          ) : null}

          <ActionLink href="/settings" tone="ghost">
            Customise overview in Settings
          </ActionLink>
        </aside>
      </div>
    </PageShell>
  );
}
