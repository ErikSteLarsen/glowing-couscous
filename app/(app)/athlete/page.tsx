import { redirect } from 'next/navigation';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { ActionLink, PageShell, sectionHeadingClassName, Surface, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionRow } from '@/components/tempo/SessionRow';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser } from '@/lib/auth-session';
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
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const dashboard = await athleteService.loadHomeDashboard(user.id);
  if (!dashboard) redirect('/athlete/find-coach');

  const nextAction = dashboard.todaySessions.find((session) => session.status !== 'completed') ?? dashboard.todaySessions[0] ?? null;
  const nextActionLabel = nextAction?.status === 'completed' ? 'Review outcome' : nextAction?.status === 'missed' ? 'Review session' : 'Open session';
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  return (
    <PageShell size="wall" className="ink-home">
      <TopBar
        title={`Good morning, ${dashboard.athlete.name}`}
      />

      <div className="space-y-6 xl:space-y-8">
        <section aria-labelledby="next-action-heading" className="ink-next-action ink-next-action--quiet-tone ink-next-action--summary rounded-[14px] border border-[var(--border)] px-4 py-5 xl:px-6 xl:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="next-action-heading" className={sectionHeadingClassName}>Today</h2>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Next session</p>
            </div>
            {nextAction ? (
              <div className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-3xl">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[15px] font-semibold text-[var(--text)]">{nextAction.title}</p>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{nextAction.timeLabel} · {formatDuration(nextAction.durationSec)} · <MetricText>{nextAction.tss} TSS</MetricText></p>
                </div>
                <StatusBadge status={nextAction.status} />
                <ActionLink href={`/athlete/session/${nextAction.id}?from=home`} size="compact">
                  {nextActionLabel}
                </ActionLink>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--text-secondary)]">No session scheduled today.</p>
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

          <div className="ink-week-ribbon">
            <div className="ink-week-track grid gap-3 p-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 xl:gap-4 xl:p-4">
              {dashboard.weekDays.map((day) => (
                <section key={day.isoDate} aria-labelledby={`home-day-${day.isoDate}`} className={`ink-day-channel min-w-0 border-t pt-3 2xl:border-t-0 2xl:border-l 2xl:pl-3 ${day.isToday ? 'ink-day-channel--today border-[var(--brand)] bg-[var(--brand-tint)] px-3 2xl:rounded-[8px]' : 'border-[var(--border)]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 id={`home-day-${day.isoDate}`} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{day.label}</h3>
                      <p className="metric-text mt-1 text-[20px] font-semibold text-[var(--text)]">{day.dateLabel}</p>
                    </div>
                    {day.isToday ? <span className="rounded-full bg-[var(--brand)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--signal-ink)]">Today</span> : null}
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
          {dashboard.overviewCards.includes('coachNote') && dashboard.coachNote && dashboard.coach ? (
            <Surface className="ink-readout ink-study-tile ink-study-tile--feature">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-[var(--brand-tint)]" />
                <span className="text-[12.5px] font-semibold text-[var(--field-selected-text)]">
                  Coach {dashboard.coach.name}
                </span>
              </div>
              <p className="text-[13.5px] leading-[1.5] text-[var(--text)]">{dashboard.coachNote}</p>
            </Surface>
          ) : null}

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
                <MetricText>{dashboard.lastActivity.tss} TSS</MetricText>
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
                        className="w-full rounded-[4px] bg-[var(--color-liquid)] opacity-80"
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

        </div>
      </div>
    </PageShell>
  );
}
