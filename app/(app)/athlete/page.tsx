import { redirect } from 'next/navigation';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { ActionLink, PageShell, sectionHeadingClassName, Surface, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionRow } from '@/components/tempo/SessionRow';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';

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
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const dashboard = await athleteService.loadHomeDashboard(user.id);
  if (!dashboard) redirect('/login');

  const nextAction = dashboard.todaySessions.find((session) => session.status !== 'completed') ?? dashboard.todaySessions[0] ?? null;
  const nextActionLabel = nextAction?.status === 'completed' ? 'Review outcome' : nextAction?.status === 'missed' ? 'Review session' : 'Open session';
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  return (
    <PageShell className="ink-home">
      <TopBar
        title={`Welcome, ${dashboard.athlete.name}`}
        description="See your next session and review your training week."
      />

      <div className="space-y-6 xl:space-y-8">
        <section aria-labelledby="next-action-heading" className="ink-next-action ink-next-action--quiet-tone ink-next-action--summary rounded-[5px] border border-[var(--border)] px-4 py-5 xl:px-6 xl:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="next-action-heading" className={sectionHeadingClassName}>Today</h2>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Next session</p>
            </div>
            {nextAction ? (
              <div className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-3xl">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[15px] font-semibold text-[var(--text)]">{nextAction.title}</p>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{nextAction.timeLabel} · {formatDuration(nextAction.durationSec)} · <MetricText>{nextAction.loadAvailable === false ? 'Load unavailable' : `${nextAction.tss} TSS`}</MetricText></p>
                </div>
                <StatusBadge status={nextAction.status} />
                <ActionLink href={`/athlete/session/${nextAction.id}?from=home`} size="compact">
                  {nextActionLabel}
                </ActionLink>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
                <p className="text-[13px] text-[var(--text-secondary)]">Nothing is scheduled today. Create a workout or place saved training on your calendar.</p>
                <div className="flex flex-wrap gap-2">
                  <ActionLink href="/athlete/workouts" tone="secondary" size="compact">Create workout</ActionLink>
                  <ActionLink href="/athlete/planner" size="compact">Open Planner</ActionLink>
                </div>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="week-glance-heading" className="space-y-4 xl:space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="week-glance-heading" className={sectionHeadingClassName}>Week at a glance</h2>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM')} · Monday-first</p>
            </div>
          </div>

          <div className="ink-week-ribbon overflow-x-auto pb-2">
            <div className="ink-week-track flex snap-x snap-mandatory gap-3 p-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 xl:gap-4 xl:p-4">
              {dashboard.weekDays.map((day) => (
                <section key={day.isoDate} aria-labelledby={`home-day-${day.isoDate}`} className={`ink-day-channel w-[min(82vw,320px)] shrink-0 snap-start border-t pt-3 md:w-auto md:min-w-0 2xl:border-l 2xl:border-t-0 2xl:pl-3 ${day.isToday ? 'ink-day-channel--today calendar-day--today border-[var(--brand)] px-3 2xl:rounded-[3px]' : 'border-[var(--border)]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 id={`home-day-${day.isoDate}`} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{day.label}</h3>
                      <p aria-current={day.isToday ? 'date' : undefined} className={`metric-text mt-1 text-[20px] font-semibold text-[var(--text)] ${day.isToday ? 'calendar-day-date--today' : ''}`}>{day.dateLabel}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {day.sessions.length > 0 ? day.sessions.map((session) => (
                      <SessionRow key={session.id} session={session} href={`/athlete/session/${session.id}?from=home`} variant="compact" />
                    )) : <p className="py-2 text-[13px] text-[var(--text-muted)]">Rest</p>}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        <div className="ink-study-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          {dashboard.overviewCards.includes('lastActivity') && dashboard.lastActivity ? (
            <Surface className="ink-readout ink-study-tile">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Last activity
              </p>
              <p className="mt-3 text-[13.5px] font-semibold text-[var(--text)]">
                {dashboard.lastActivity.title}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                <MetricText>{formatDuration(dashboard.lastActivity.durationSec)}</MetricText> ·{' '}
                <MetricText>{dashboard.lastActivity.loadAvailable ? `${dashboard.lastActivity.tss} TSS` : 'Load unavailable'}</MetricText>
              </p>
            </Surface>
          ) : null}

          {dashboard.overviewCards.includes('weekLoad') ? (
            <Surface className="ink-readout ink-study-tile">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                This week
              </p>
              <p className="metric-text mt-3 text-[22px] font-semibold tracking-[-0.01em] text-[var(--text)]">
                {formatDuration(dashboard.weekTotals.durationSec)}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                <MetricText>{dashboard.weekTotals.tss} TSS</MetricText>
                {dashboard.weekTotals.loadUnavailableCount > 0 ? (
                  <span className="ml-2 text-[11px] text-[var(--text-muted)]">
                    Partial · unavailable for {dashboard.weekTotals.loadUnavailableCount} imported {dashboard.weekTotals.loadUnavailableCount === 1 ? 'activity' : 'activities'}
                  </span>
                ) : null}
              </p>
            </Surface>
          ) : null}

          {dashboard.overviewCards.includes('trend') ? (
            <Surface className="ink-readout ink-study-tile ink-study-tile--flow">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Fitness trend
              </p>
              <div className="mt-3 flex items-end gap-2">
                {dashboard.trend.length > 0 ? (
                  dashboard.trend.map((point) => (
                    <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        role="img"
                        aria-label={point.loadAvailable ? `${point.tss} TSS` : 'Load unavailable'}
                        title={point.loadAvailable ? `${point.tss} TSS` : 'Load unavailable'}
                        className={`w-full rounded-[4px] ${point.loadAvailable ? 'bg-[var(--color-liquid)] opacity-80' : 'bg-[var(--border)]'}`}
                        style={{ height: `${point.loadAvailable ? Math.max(12, Math.min(52, point.tss / 3)) : 12}px` }}
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

        </div>
      </div>
    </PageShell>
  );
}
