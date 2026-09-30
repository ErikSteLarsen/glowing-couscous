import Link from 'next/link';
import { ArrowUpRight, CalendarDays, ChevronRight } from 'lucide-react';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import type { HomeDashboardData } from '@/components/AthleteHomeContent';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { HomeRecentLoad, HomeWeekSummary } from '@/components/HomeTrainingReadouts';

export function FocusHome({ dashboard }: { dashboard: HomeDashboardData }) {
  const nextAction = dashboard.todaySessions.find((session) => session.status !== 'completed') ?? dashboard.todaySessions[0] ?? null;
  const nextActionLabel = nextAction?.status === 'completed' ? 'Review outcome' : nextAction?.status === 'missed' ? 'Review session' : 'Open session';
  const scheduledCount = dashboard.weekDays.reduce((total, day) => total + day.sessions.length, 0);

  return (
    <main className="study-home study-home--nocturne">
      <header className="study-home__header">
        <div>
          <p className="study-home__date">{dashboard.dateLabels.today} <span aria-hidden="true">·</span> Week {dashboard.dateLabels.weekNumber}</p>
          <h1>Welcome, {dashboard.athlete.name}</h1>
          <p className="study-home__intro">Your next session and the shape of this training week.</p>
        </div>
        <Link className="study-home__planner-link" href="/athlete/planner"><CalendarDays size={17} aria-hidden="true" /> Open Planner <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </header>

      <div className="study-home__layout">
        <div className="study-home__primary">
          <section className="study-home__today" aria-labelledby="study-today-title">
            <div className="study-home__section-heading">
              <h2 id="study-today-title">Today</h2>
              <span>{dashboard.dateLabels.shortToday}</span>
            </div>
            {nextAction ? (
              <div className="study-home__next">
                <div className="study-home__next-title">
                  <p>{getSportLabel(nextAction.sport)} <span aria-hidden="true">/</span> {nextAction.timeLabel}</p>
                  <h3>{nextAction.title}</h3>
                </div>
                <div className="study-home__session-metrics">
                  <span><MetricText>{formatDuration(nextAction.durationSec)}</MetricText><small>Duration</small></span>
                  <span><MetricText>{nextAction.loadAvailable === false ? '—' : nextAction.tss}</MetricText><small>{nextAction.loadAvailable === false ? 'Load unavailable' : 'Estimated TSS'}</small></span>
                  <StatusBadge status={nextAction.status} />
                </div>
                <div className="study-home__shape"><SessionBlockBar segments={nextAction.segments} /><span>Session intensity</span></div>
                <Link className="study-home__session-link" href={`/athlete/session/${nextAction.id}?from=home`}>{nextActionLabel}<ArrowUpRight size={17} aria-hidden="true" /></Link>
              </div>
            ) : (
              <div className="study-home__empty">
                <p>Nothing is scheduled today. Your week is ready when you are.</p>
                <div><Link href="/athlete/workouts">Create workout</Link><Link href="/athlete/planner">Open Planner</Link></div>
              </div>
            )}
          </section>

          {dashboard.overviewCards.some((card) => card === 'weekLoad' || card === 'trend' || (card === 'lastActivity' && dashboard.lastActivity)) ? <div className="study-home__overview">
            {dashboard.overviewCards.includes('weekLoad') ? <section className="study-home__readout study-home__readout--load" aria-labelledby="study-load-title">
              <div className="study-home__section-heading"><h2 id="study-load-title">Training this week</h2></div>
              <HomeWeekSummary scheduled={dashboard.scheduledTotals} completed={dashboard.completedTotals} />
            </section> : null}

            {dashboard.overviewCards.includes('lastActivity') && dashboard.lastActivity ? <section className="study-home__readout study-home__readout--activity" aria-labelledby="study-activity-title">
              <div className="study-home__section-heading"><h2 id="study-activity-title">Last activity</h2><ArrowUpRight size={17} aria-hidden="true" /></div>
              <Link className="study-home__activity-title underline underline-offset-4" href={`/athlete/session/${dashboard.lastActivity.sessionId}?from=home`}>{dashboard.lastActivity.title}</Link>
              <p className="study-home__readout-detail">{dashboard.lastActivity.dateLabel} · {dashboard.lastActivity.sourceLabel}</p>
              <p className="study-home__readout-detail"><MetricText>{formatDuration(dashboard.lastActivity.durationSec)}</MetricText> <span aria-hidden="true">·</span> <MetricText>{dashboard.lastActivity.loadAvailable ? `${dashboard.lastActivity.tss} estimated TSS` : 'Load unavailable'}</MetricText></p>
            </section> : null}

            {dashboard.overviewCards.includes('trend') ? <section className="study-home__readout study-home__readout--trend" aria-labelledby="study-trend-title">
              <div className="study-home__section-heading"><h2 id="study-trend-title">Recent session load</h2><span>Latest four</span></div>
              <HomeRecentLoad points={dashboard.trend} />
            </section> : null}
          </div> : null}
        </div>
        <section className="study-home__week" aria-labelledby="study-week-title">
          <div className="study-home__section-heading">
            <div><h2 id="study-week-title">This week</h2><p>{dashboard.dateLabels.weekRange}</p></div>
            <span>{scheduledCount} {scheduledCount === 1 ? 'entry' : 'entries'}</span>
          </div>
          <div className="study-home__days">
            {dashboard.weekDays.map((day) => (
              <section key={day.isoDate} className={`study-home__day ${day.isToday ? 'study-home__day--today' : ''}`} aria-labelledby={`study-day-${day.isoDate}`}>
                <div className="study-home__day-label"><h3 id={`study-day-${day.isoDate}`}>{day.label}</h3><span aria-current={day.isToday ? 'date' : undefined}>{day.dateLabel}</span></div>
                <div className="study-home__day-content">
                  {day.sessions.length ? day.sessions.map((session) => (
                    <Link key={session.id} href={`/athlete/session/${session.id}?from=home`} className="study-home__day-session">
                      <span className="study-home__day-session-title">{session.title}</span>
                      <span className="study-home__day-session-meta"><MetricText>{formatDuration(session.durationSec)}</MetricText> <span aria-hidden="true">·</span> {session.status}</span>
                      <ChevronRight size={15} aria-hidden="true" />
                    </Link>
                  )) : <span className="study-home__rest">Nothing scheduled</span>}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
