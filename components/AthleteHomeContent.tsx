import { ActionLink, PageShell, sectionHeadingClassName, Surface, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionRow, type SessionRowData } from '@/components/tempo/SessionRow';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { HomeRecentLoad, HomeWeekSummary } from '@/components/HomeTrainingReadouts';
import type { HomeTotals, homeActivityReadout } from '@/lib/home-summary';

export type HomeDashboardData = {
  athlete: { name: string };
  overviewCards: string[];
  todaySessions: SessionRowData[];
  weekDays: Array<{ label: string; dateLabel: string; isoDate: string; isToday: boolean; sessions: SessionRowData[] }>;
  dateLabels: { today: string; shortToday: string; weekNumber: string; weekRange: string };
  lastActivity: ReturnType<typeof homeActivityReadout> | null;
  scheduledTotals: HomeTotals;
  completedTotals: HomeTotals;
  trend: Array<ReturnType<typeof homeActivityReadout>>;
};

function formatDuration(durationSec: number) {
  const hours = Math.floor(durationSec / 3600);
  const minutes = Math.round((durationSec % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  return `${minutes}m`;
}

export function AthleteHomeContent({ dashboard }: { dashboard: HomeDashboardData }) {
  const nextAction = dashboard.todaySessions.find((session) => session.status !== 'completed') ?? dashboard.todaySessions[0] ?? null;
  const nextActionLabel = nextAction?.status === 'completed' ? 'Review outcome' : nextAction?.status === 'missed' ? 'Review session' : 'Open session';

  return (
    <PageShell className="ink-home">
      <TopBar
        title={`Welcome, ${dashboard.athlete.name}`}
        description="See what's scheduled and how your training week is going. Training load (shown as TSS) estimates session effort and duration."
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
                  <ActionLink href="/athlete/calendar?add=1" size="compact">Plan training</ActionLink>
                </div>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="week-glance-heading" className="space-y-4 xl:space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="week-glance-heading" className={sectionHeadingClassName}>Week at a glance</h2>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{dashboard.dateLabels.weekRange} · Monday-first</p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)] md:hidden">Swipe to browse your week.</p>
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
                    )) : <p className="py-2 text-[13px] text-[var(--text-muted)]">Nothing scheduled</p>}
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
              <HomeWeekSummary scheduled={dashboard.scheduledTotals} completed={dashboard.completedTotals} />
            </Surface>
          ) : null}

          {dashboard.overviewCards.includes('trend') ? (
            <Surface className="ink-readout ink-study-tile ink-study-tile--flow">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Recent session load
              </p>
              <HomeRecentLoad points={dashboard.trend} />
            </Surface>
          ) : null}

        </div>
      </div>
    </PageShell>
  );
}
