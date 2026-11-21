import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format, getISOWeek } from 'date-fns';
import { ArrowRight, CalendarPlus } from 'lucide-react';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { WeeklyVolumeChart, type VolumeWeek } from '@/components/charts/WeeklyVolumeChart';
import { ComplianceMark } from '@/components/tempo/ComplianceMark';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { SessionRow } from '@/components/tempo/SessionRow';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { OverdueSessions } from '@/components/OverdueSessions';
import {
  ghostButtonClassName,
  PageShell,
  secondaryButtonClassName,
  sectionHeadingClassName,
  StatTile,
  TopBar,
} from '@/components/ui';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { accountService } from '@/lib/account-service';
import { HomeTrainingSetup } from '@/components/HomeTrainingSetup';
import { UnsavedRidesNotice } from '@/components/UnsavedRidesNotice';
import { parsePrefsJson } from '@/lib/overview-preferences';
import { parseTrainingSports } from '@/lib/training-setup';
import { athleteService } from '@/lib/athlete-service';
import { signed } from '@/lib/chart-format';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { trainingLoadService } from '@/lib/training-load-service';
import { formZoneLabels, fromDayKey, type FormZone } from '@/lib/training-load';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { hourInZone, todayInZone } from '@/lib/user-time';

export const metadata: Metadata = { title: 'Home' };

function greetingFor(hour: number) {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function restStateFor(doneToday: Array<{ title: string }>, skippedToday: Array<{ title: string }>) {
  if (doneToday.length > 0) {
    return {
      title: 'Done for today',
      description: `${doneToday.map((session) => session.title).join(', ')} completed.`,
    };
  }
  if (skippedToday.length > 0) {
    return {
      title: 'Skipped today',
      description: `${skippedToday.map((session) => session.title).join(', ')} skipped. Plan it again to bring it back into your load.`,
    };
  }
  return {
    title: 'Rest day',
    description: 'Nothing is planned today. Recovery is training too.',
  };
}

const formAdvice: Record<FormZone, string> = {
  fresh: 'Rested. A good day for quality.',
  neutral: 'Balanced load. Train as planned.',
  productive: 'Carrying fatigue that builds fitness.',
  overreaching: 'Deep fatigue. Consider an easier day.',
};

export default async function AthletePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const timeZone = await getRequestTimeZone();
  const [dashboard, load, account] = await Promise.all([
    athleteService.loadHomeDashboard(user.id, { timeZone }),
    trainingLoadService.loadOverview(user.id, { now: fromDayKey(todayInZone(timeZone)) }),
    accountService.getAccount(user.id),
  ]);
  if (!dashboard || !account) redirect('/login');

  const today = fromDayKey(dashboard.todayKey);
  const firstName = dashboard.athlete.name.split(' ')[0] || dashboard.athlete.name;
  const nextAction = dashboard.todaySessions.find((session) => session.status !== 'completed' && session.status !== 'skipped') ?? null;
  const doneToday = dashboard.todaySessions.filter((session) => session.status === 'completed');
  const skippedToday = dashboard.todaySessions.filter((session) => session.status === 'skipped');
  const restState = restStateFor(doneToday, skippedToday);
  const upcoming = dashboard.nextDays.flatMap((day) => day.sessions.map((session) => ({ day, session }))).slice(0, 3);
  const thisWeek = load.weeks.find((week) => week.weekStart === dashboard.weekDays[0]?.isoDate);
  const fitnessChange = load.current.fitness28DaysAgo === null ? null : load.current.fitness - load.current.fitness28DaysAgo;
  const unknownLoadSessions = load.sessions.filter((session) => session.actualDurationSec !== null && session.actualTss === null).length;
  const formTone = load.current.formZone === 'overreaching' ? 'watch' : load.current.formZone === 'fresh' ? 'good' : 'neutral';
  const rampTone = load.current.rampRate !== null && load.current.rampRate > 8 ? 'watch' : 'neutral';
  const hasHistory = dashboard.lastActivity !== null || load.series.some((point) => point.actualTss > 0);
  const volumeWeeks: VolumeWeek[] = load.weeks.map((week) => ({
    weekStart: week.weekStart,
    plannedSec: week.planned.durationSec,
    completedSec: week.completed.durationSec,
    plannedTss: week.planned.tss,
    completedTss: week.completed.tss,
    unknownLoadSessions: week.completed.unknownLoadSessions,
    completionPct: week.completionPct,
    isCurrent: week.weekStart === thisWeek?.weekStart,
    isFuture: thisWeek ? week.weekStart > thisWeek.weekStart : false,
  }));
  const cards = new Set(dashboard.overviewCards);

  return (
    <PageShell size="wall">
      <TopBar
        eyebrow={`${format(today, 'EEEE d MMMM')} · Week ${getISOWeek(today)}`}
        title={`${greetingFor(hourInZone(timeZone))}, ${firstName}`}
        actions={<Link href="/athlete/events" className={`${ghostButtonClassName('default')} max-md:min-h-11`}>Events</Link>}
      />
      <section aria-labelledby="today-heading" className="tile flex flex-col rounded-2xl p-5 xl:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="today-heading" className={sectionHeadingClassName}>Today</h2>
          {doneToday.length > 0 ? (
            <span className="text-xs text-[var(--text-muted)]">
              {doneToday.length} done today
            </span>
          ) : null}
        </div>

        <div className={`mt-4 grid gap-5 ${upcoming.length > 0 ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6' : ''}`}>
          {nextAction ? (
            <div className="flex min-w-0 flex-col gap-4">
              <div>
                <p className="data text-[13px] text-[var(--text-muted)]">
                  {[nextAction.timeLabel, getSportLabel(nextAction.sport)].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 text-2xl font-medium tracking-[-0.02em] text-[var(--text)]">{nextAction.title}</p>
                {nextAction.summary ? <p className="mt-1.5 line-clamp-2 max-w-[68ch] text-sm text-[var(--text-secondary)]">{nextAction.summary}</p> : null}
              </div>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <p className="data text-[1.75rem] font-medium leading-none tracking-[-0.02em] text-[var(--text)]">
                  {formatDuration(nextAction.durationSec)}
                </p>
                <p className="data text-[1.75rem] font-medium leading-none tracking-[-0.02em] text-[var(--text)]">
                  {nextAction.tss}
                  <span className="ml-1 text-[0.5em] font-normal text-[var(--text-muted)]">TSS</span>
                </p>
                {nextAction.targetLabel ? <p className="data text-sm text-[var(--text-secondary)]">{nextAction.targetLabel}</p> : null}
              </div>
              <SessionBlockBar segments={nextAction.segments} size="card" />
              {cards.has('coachNote') && dashboard.coachNote ? (
                <blockquote className="border-l-2 border-[var(--brand)] pl-3 text-sm text-[var(--text-secondary)]">
                  <span className="text-[var(--text)]">{dashboard.coach?.name ?? 'Coach'}:</span> {dashboard.coachNote.text}
                </blockquote>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <WorkoutStartChooser
                  workout={{ title: nextAction.title, sport: nextAction.sport, status: nextAction.status, durationSec: nextAction.durationSec, hasSteps: nextAction.hasSteps }}
                  source={{ kind: 'session', id: nextAction.id, from: 'home' }}
                />
                <Link href={`/athlete/session/${nextAction.id}?from=home`} className={`${secondaryButtonClassName} max-md:min-h-11`}>
                  Details
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-4">
              <div>
                <p className="text-2xl font-medium tracking-[-0.02em] text-[var(--text)]">
                  {restState.title}
                </p>
                <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                  {restState.description}
                </p>
              </div>
              {doneToday[0] ? (
                <SessionRow session={doneToday[0]} href={`/athlete/session/${doneToday[0].id}?from=home`} actionLabel="Review" variant="compact" />
              ) : skippedToday[0] ? (
                <SessionRow session={skippedToday[0]} href={`/athlete/session/${skippedToday[0].id}?from=home`} actionLabel="Details" variant="compact" />
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Link href="/athlete/calendar?place=workout" className={`${secondaryButtonClassName} max-md:min-h-11`}>
                  <CalendarPlus aria-hidden="true" size={15} strokeWidth={1.8} />
                  Plan a session
                </Link>
              </div>
            </div>
          )}

          {upcoming.length > 0 ? (
            <div className="min-w-0 border-t border-[var(--border)] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <h3 className="text-xs text-[var(--text-muted)]">Coming up</h3>
              <ul className="mt-2 space-y-1">
                {upcoming.map(({ day, session }) => (
                  <li key={session.id}>
                    <Link
                      href={`/athlete/session/${session.id}?from=home`}
                      className="group -mx-2 flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm transition-colors hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] max-md:min-h-11"
                    >
                      <span className="data w-16 shrink-0 text-[var(--text-muted)]">{day.label} {day.dateLabel}</span>
                      <span className="min-w-0 flex-1 truncate text-[var(--text)]">{session.title}</span>
                      {session.status === 'skipped' ? <span className="shrink-0 text-xs text-[var(--text-secondary)]">Skipped</span> : null}
                      <span className="data shrink-0 text-[var(--text-muted)]">{formatDuration(session.durationSec)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <HomeTrainingSetup
        profile={account.performanceProfile}
        sports={parseTrainingSports(parsePrefsJson(account.prefsJson).trainingSports)}
        workoutSport={nextAction?.sport}
      />
      <UnsavedRidesNotice userId={user.id} />

      {dashboard.nextEvent ? (
        <section aria-labelledby="next-event-heading" className="flex flex-col gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--brand)]">{dashboard.nextEvent.daysUntil === 0 ? 'Today' : dashboard.nextEvent.daysUntil === 1 ? 'Tomorrow' : `In ${dashboard.nextEvent.daysUntil} days`} · {format(new Date(`${dashboard.nextEvent.eventDate}T12:00:00`), 'EEE d MMM yyyy')}</p>
            <h2 id="next-event-heading" className="mt-1 text-lg font-medium text-[var(--text)]">{dashboard.nextEvent.title}</h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">{getSportLabel(dashboard.nextEvent.sport)}{dashboard.nextEvent.targetFinishSec ? ` · Goal ${formatDuration(dashboard.nextEvent.targetFinishSec)}` : ''}</p>
          </div>
          <Link href="/athlete/events" className={`${secondaryButtonClassName} shrink-0 max-md:min-h-11`}>Manage events</Link>
        </section>
      ) : null}

      <OverdueSessions sessions={dashboard.overdue} today={dashboard.todayKey} />

      <section aria-labelledby="week-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="week-heading" className={sectionHeadingClassName}>This week</h2>
            {thisWeek ? (
              <p className="data mt-1 text-[13px] text-[var(--text-muted)]">
                {formatDuration(thisWeek.completed.durationSec)} of {formatDuration(thisWeek.planned.durationSec)} · {thisWeek.completed.unknownLoadSessions ? `load unavailable for ${thisWeek.completed.unknownLoadSessions} activities` : `${thisWeek.completed.tss} of ${thisWeek.planned.tss} TSS`}
                {thisWeek.missed > 0 ? ` · ${thisWeek.missed} missed` : ''}
              </p>
            ) : null}
          </div>
          <Link href="/athlete/calendar" className={`${ghostButtonClassName('compact')} max-md:min-h-11`}>
            Calendar
            <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
          </Link>
        </div>
        {thisWeek && thisWeek.planned.durationSec > 0 ? (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[var(--raised)]"
            role="progressbar"
            aria-label="Planned workout duration recorded this week"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, thisWeek.completionPct ?? 0)}
          >
            <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(100, thisWeek.completionPct ?? 0)}%` }} />
          </div>
        ) : null}
        <div className="ink-week-track grid gap-2 md:grid-cols-4 xl:grid-cols-7">
          {dashboard.weekDays.map((day) => (
            <section
              key={day.isoDate}
              aria-labelledby={`home-day-${day.isoDate}`}
              className={`ink-day-channel min-w-0 rounded-xl border p-2.5 ${day.isToday ? 'ink-day-channel--today' : 'bg-[var(--surface)]'}`}
            >
              <div className="flex items-baseline justify-between gap-2 px-0.5">
                <h3 id={`home-day-${day.isoDate}`} className="text-xs text-[var(--text-muted)]">
                  {day.label} <span className="data text-sm font-medium text-[var(--text)]">{day.dateLabel}</span>
                </h3>
                {day.isToday ? <span className="text-[11px] font-medium text-[var(--brand)]">Today</span> : null}
                {!day.isToday && day.sessions.length > 0 ? (
                  <span className="flex gap-1">
                    {day.sessions.map((session) => (session.compliance ? <ComplianceMark key={session.id} state={session.compliance} /> : null))}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 space-y-1.5 max-md:[&>a]:min-h-11">
                {day.sessions.length > 0 ? (
                  day.sessions.map((session) => (
                    <SessionRow key={session.id} session={session} href={`/athlete/session/${session.id}?from=home`} variant="month" />
                  ))
                ) : (
                  <p className="px-0.5 py-1 text-xs text-[var(--text-muted)]">Rest</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </section>

      {cards.has('weekLoad') || cards.has('lastActivity') ? (
        <div className="grid gap-4 xl:grid-cols-12">
          {cards.has('weekLoad') ? (
            <section aria-labelledby="volume-heading" className={`tile rounded-2xl p-5 xl:p-6 ${cards.has('lastActivity') ? 'xl:col-span-8' : 'xl:col-span-12'}`}>
              <h2 id="volume-heading" className={`${sectionHeadingClassName} mb-4`}>Weekly volume</h2>
              <WeeklyVolumeChart weeks={volumeWeeks} />
            </section>
          ) : null}
          {cards.has('lastActivity') ? (
            <section aria-labelledby="last-activity-heading" className={`tile flex flex-col rounded-2xl p-5 xl:p-6 ${cards.has('weekLoad') ? 'xl:col-span-4' : 'xl:col-span-12'}`}>
              <h2 id="last-activity-heading" className={sectionHeadingClassName}>Last activity</h2>
              {dashboard.lastActivity ? (
                <div className="mt-4 flex flex-1 flex-col gap-4">
                  <div>
                    <p className="data text-[13px] text-[var(--text-muted)]">
                      {format(dashboard.lastActivity.completedAt, 'EEE d MMM')} · {getSportLabel(dashboard.lastActivity.sport)}
                    </p>
                    <p className="mt-1 text-lg font-medium text-[var(--text)]">{dashboard.lastActivity.title}</p>
                  </div>
                  <dl className="grid grid-cols-3 gap-3">
                    {[
                      ['Time', formatDuration(dashboard.lastActivity.durationSec)],
                      ['TSS', String(dashboard.lastActivity.tss)],
                      ['RPE', dashboard.lastActivity.rpe ? `${dashboard.lastActivity.rpe}/10` : '–'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
                        <dd className="data mt-1 text-lg font-medium text-[var(--text)]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {dashboard.lastActivity.notes ? (
                    <p className="line-clamp-3 text-sm text-[var(--text-secondary)]">&ldquo;{dashboard.lastActivity.notes}&rdquo;</p>
                  ) : null}
                  <Link href={`/athlete/session/${dashboard.lastActivity.sessionId}?from=home`} className={`${ghostButtonClassName('compact')} mt-auto self-start max-md:min-h-11`}>
                    Review outcome
                    <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
                  </Link>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--text-muted)]">Completed sessions appear here.</p>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
      {cards.has('trend') ? (
        <section aria-labelledby="training-trends-heading" className="space-y-3">
          <h2 id="training-trends-heading" className={sectionHeadingClassName}>Training trends</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label={hasHistory ? `Form · ${formZoneLabels[load.current.formZone]}` : 'Form'}
              value={signed(load.current.form)}
              detail={hasHistory ? formAdvice[load.current.formZone] : 'Builds as you complete sessions'}
              tone={formTone}
            />
            <StatTile
              label="Fitness"
              value={String(Math.round(load.current.fitness))}
              detail={unknownLoadSessions ? `Estimate; excludes ${unknownLoadSessions} activities with unavailable load` : fitnessChange === null ? '42-day load' : `${signed(fitnessChange)} over 4 weeks`}
              tone={fitnessChange !== null && fitnessChange > 0 ? 'good' : 'neutral'}
            />
            <StatTile label="Fatigue" value={String(Math.round(load.current.fatigue))} detail={unknownLoadSessions ? 'Estimate; some activity load is unavailable' : '7-day load'} />
            <StatTile
              label="Ramp rate"
              value={load.current.rampRate === null ? '–' : signed(load.current.rampRate)}
              unit={load.current.rampRate === null ? undefined : '/wk'}
              detail={unknownLoadSessions ? 'Estimate; some activity load is unavailable' : rampTone === 'watch' ? 'Fitness rising fast' : 'Fitness change per week'}
              tone={rampTone}
            />
          </div>
          <section aria-labelledby="performance-heading" className="tile min-w-0 rounded-2xl p-5 xl:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 id="performance-heading" className={sectionHeadingClassName}>Fitness and form</h3>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">Last 12 weeks and the next two, from your plan</p>
                {unknownLoadSessions > 0 ? <p className="mt-1 text-xs text-[var(--text-muted)]">Load is unavailable for {unknownLoadSessions} activities. The fitness and fatigue estimates omit them; marked chart days are not measured as zero.</p> : null}
              </div>
              <Link href="/athlete/activity" className={`${ghostButtonClassName('compact')} max-md:min-h-11`}>
                All activity
                <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
              </Link>
            </div>
            {hasHistory ? (
              <PerformanceChart series={load.series} today={load.today} />
            ) : (
              <div className="tile-empty rounded-xl px-5 py-10 text-center">
                <p className="text-sm text-[var(--text)]">Your fitness line starts with training load data.</p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">Manually logged work counts toward duration history; load needs a defensible TSS value.</p>
              </div>
            )}
          </section>
        </section>
      ) : null}
    </PageShell>
  );
}
