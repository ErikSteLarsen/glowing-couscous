import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format, getISOWeek } from 'date-fns';
import { ArrowRight, CalendarPlus } from 'lucide-react';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { WeeklyVolumeChart, type VolumeWeek } from '@/components/charts/WeeklyVolumeChart';
import { ComplianceMark } from '@/components/tempo/ComplianceMark';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { MetricPair } from '@/components/tempo/MetricPair';
import { SessionRow } from '@/components/tempo/SessionRow';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { HomeSummaryDialog } from '@/components/HomeSummaryDialog';
import { MiniBars, Sparkline, type MiniBar } from '@/components/charts/Sparklines';
import {
  Badge,
  EmptyState,
  Surface,
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
      description: `${doneToday.map((session) => session.title).join(', ')} done.`,
    };
  }
  if (skippedToday.length > 0) {
    return {
      title: 'Skipped today',
      description: `${skippedToday.map((session) => session.title).join(', ')} skipped. To put it back in your plan, open it and choose Plan again.`,
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
  // Six weeks of history for the trend sparkline; the projection stays in the dialog chart.
  const recentSeries = load.series.filter((point) => !point.projected).slice(-42);
  const volumeBars: MiniBar[] = volumeWeeks.filter((week) => !week.isFuture).slice(-8).map((week) => ({
    key: week.weekStart,
    planned: week.plannedSec,
    done: week.completedSec,
    current: week.isCurrent,
  }));
  const showInsights = cards.has('trend') || cards.has('weekLoad') || cards.has('lastActivity');

  return (
    <PageShell size="wall">
      <TopBar
        eyebrow={`${format(today, 'EEEE\u00A0d\u00A0MMMM')}\u00A0· Week\u00A0${getISOWeek(today)}`}
        title={`${greetingFor(hourInZone(timeZone))}, ${firstName}`}
        actions={<Link href="/athlete/events" className={`${ghostButtonClassName('default')} max-md:min-h-11`}>Events</Link>}
      />
      <div className={`grid gap-4 ${upcoming.length > 0 ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}>
        <Surface aria-labelledby="today-heading" className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="today-heading" className={sectionHeadingClassName}>Today</h2>
            {doneToday.length > 0 ? (
              <span className="text-xs text-[var(--text-muted)]">
                {doneToday.length} done today
              </span>
            ) : null}
          </div>

          {nextAction ? (
            <>
              <div className="min-w-0">
                <p className="data text-[13px] text-[var(--text-muted)]">
                  {[nextAction.timeLabel, getSportLabel(nextAction.sport)].filter(Boolean).join('\u00A0· ')}
                </p>
                <p className="mt-0.5 text-xl font-medium tracking-[-0.02em] text-[var(--text)] [overflow-wrap:anywhere]">{nextAction.title}</p>
                <p className="data mt-1 text-sm text-[var(--text-secondary)]">
                  <span className="text-[var(--text)]">{formatDuration(nextAction.durationSec)}</span>
                  {' · '}
                  <span className="text-[var(--text)]">{nextAction.tss}</span> TSS
                  {nextAction.targetLabel ? `\u00A0· ${nextAction.targetLabel}` : ''}
                </p>
              </div>
              <SessionBlockBar segments={nextAction.segments} size="compact" />
              {cards.has('coachNote') && dashboard.coachNote ? (
                <blockquote className="line-clamp-2 border-l-2 border-[var(--brand)] pl-3 text-sm text-[var(--text-secondary)]">
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
            </>
          ) : (
            <>
              <div>
                <p className="text-xl font-medium tracking-[-0.02em] text-[var(--text)]">
                  {restState.title}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
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
                  Plan a workout
                </Link>
              </div>
            </>
          )}
        </Surface>

        {upcoming.length > 0 ? (
          <Surface aria-labelledby="coming-up-heading" className="min-w-0">
            <h2 id="coming-up-heading" className={sectionHeadingClassName}>Coming up</h2>
            <ul className="mt-2 space-y-0.5">
              {upcoming.map(({ day, session }) => (
                <li key={session.id}>
                  <Link
                    href={`/athlete/session/${session.id}?from=home`}
                    className="group -mx-2 flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm transition-colors hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] max-md:min-h-11"
                  >
                    <span className="data w-16 shrink-0 text-[var(--text-muted)]">{day.label} {day.dateLabel}</span>
                    <span className="min-w-0 flex-1 py-1.5 text-[var(--text)] [overflow-wrap:anywhere]">{session.title}</span>
                    {session.status === 'skipped' ? <Badge>Skipped</Badge> : null}
                    <span className="data shrink-0 text-[var(--text-muted)]">{formatDuration(session.durationSec)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Surface>
        ) : null}
      </div>

      <HomeTrainingSetup
        profile={account.performanceProfile}
        sports={parseTrainingSports(parsePrefsJson(account.prefsJson).trainingSports)}
        workoutSport={nextAction?.sport}
      />
      <UnsavedRidesNotice userId={user.id} />

      {dashboard.nextEvent ? (
        <Surface aria-labelledby="next-event-heading" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--brand)]">{dashboard.nextEvent.daysUntil === 0 ? 'Today' : dashboard.nextEvent.daysUntil === 1 ? 'Tomorrow' : `In ${dashboard.nextEvent.daysUntil} days`}&nbsp;· {format(new Date(`${dashboard.nextEvent.eventDate}T12:00:00`), 'EEE\u00A0d\u00A0MMM\u00A0yyyy')}</p>
            <h2 id="next-event-heading" className={`mt-0.5 wrap-anywhere ${sectionHeadingClassName}`}>
              {dashboard.nextEvent.title}
              <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">{getSportLabel(dashboard.nextEvent.sport)}{dashboard.nextEvent.targetFinishSec ? ` · Goal ${formatDuration(dashboard.nextEvent.targetFinishSec)}` : ''}</span>
            </h2>
          </div>
          <Link href="/athlete/events" className={`${ghostButtonClassName('compact')} shrink-0 max-md:min-h-11`}>Manage events</Link>
        </Surface>
      ) : null}

      <section aria-labelledby="week-heading" className="space-y-2.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="week-heading" className={sectionHeadingClassName}>This week</h2>
            {thisWeek ? (
              <p className="data mt-0.5 text-[13px] text-[var(--text-muted)]">
                {formatDuration(thisWeek.completed.durationSec)} of {formatDuration(thisWeek.planned.durationSec)}&nbsp;· {thisWeek.completed.unknownLoadSessions ? `no TSS for ${thisWeek.completed.unknownLoadSessions} activities` : `${thisWeek.completed.tss} of ${thisWeek.planned.tss}\u00A0TSS`}
                {thisWeek.missed > 0 ? `\u00A0· ${thisWeek.missed} missed` : ''}
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
            aria-label="Planned time done this week"
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
              className={`ink-day-channel min-w-0 rounded-xl border p-2 ${day.isToday ? 'ink-day-channel--today' : 'bg-[var(--surface)]'}`}
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
              <div className="mt-1.5 space-y-1.5 max-md:[&>a]:min-h-11">
                {day.sessions.length > 0 ? (
                  day.sessions.map((session) => (
                    <SessionRow key={session.id} session={session} href={`/athlete/session/${session.id}?from=home`} variant="month" />
                  ))
                ) : (
                  <p className="px-0.5 py-0.5 text-xs text-[var(--text-muted)]">Rest</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </section>

      {showInsights ? (
        <section aria-labelledby="insights-heading" className="space-y-2.5">
          <h2 id="insights-heading" className="sr-only">Training summary</h2>
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
            {cards.has('trend') ? (
              <HomeSummaryDialog
                label="Training trends"
                title="Fitness and form"
                description="Last 12 weeks and the next two, from your plan"
                className="md:basis-full xl:flex-[2_1_0%]"
                summary={
                  <span className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
                    <span className="grid grid-cols-4 gap-3">
                      {[
                        ['Form', signed(load.current.form), formTone === 'watch' ? 'text-[var(--status-warning)]' : formTone === 'good' ? 'text-[var(--status-success)]' : 'text-[var(--text)]'],
                        ['Fitness', String(Math.round(load.current.fitness)), 'text-[var(--text)]'],
                        ['Fatigue', String(Math.round(load.current.fatigue)), 'text-[var(--text)]'],
                        ['Ramp', load.current.rampRate === null ? '–' : signed(load.current.rampRate), rampTone === 'watch' ? 'text-[var(--status-warning)]' : 'text-[var(--text)]'],
                      ].map(([name, value, tone]) => (
                        <span key={name} className="min-w-0">
                          <span className="block text-xs text-[var(--text-muted)]">{name}</span>
                          <span className={`data mt-1 block text-xl font-medium leading-none tracking-[-0.02em] ${tone}`}>{value}</span>
                        </span>
                      ))}
                    </span>
                    {hasHistory ? (
                      <span className="hidden w-28 sm:block">
                        <Sparkline values={recentSeries.map((point) => point.fitness)} color="var(--metric-fitness)" />
                      </span>
                    ) : null}
                    <span className="col-span-2 text-xs text-[var(--text-muted)]">
                      {hasHistory ? `${formZoneLabels[load.current.formZone]}\u00A0· ${formAdvice[load.current.formZone]}` : 'Builds as you complete workouts'}
                    </span>
                  </span>
                }
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatTile
                      label={hasHistory ? `Form · ${formZoneLabels[load.current.formZone]}` : 'Form'}
                      value={signed(load.current.form)}
                      detail={hasHistory ? formAdvice[load.current.formZone] : 'Builds as you complete workouts'}
                      tone={formTone}
                    />
                    <StatTile
                      label="Fitness"
                      value={String(Math.round(load.current.fitness))}
                      detail={unknownLoadSessions ? `Estimate. Leaves out ${unknownLoadSessions} activities with no TSS` : fitnessChange === null ? '42-day load' : `${signed(fitnessChange)} over 4 weeks`}
                      tone={fitnessChange !== null && fitnessChange > 0 ? 'good' : 'neutral'}
                    />
                    <StatTile label="Fatigue" value={String(Math.round(load.current.fatigue))} detail={unknownLoadSessions ? 'Estimate. Some activities have no TSS' : '7-day load'} />
                    <StatTile
                      label="Ramp rate"
                      value={load.current.rampRate === null ? '–' : signed(load.current.rampRate)}
                      unit={load.current.rampRate === null ? undefined : '/wk'}
                      detail={unknownLoadSessions ? 'Estimate. Some activities have no TSS' : rampTone === 'watch' ? 'Fitness rising fast' : 'Fitness change per week'}
                      tone={rampTone}
                    />
                  </div>
                  {unknownLoadSessions > 0 ? <p className="text-xs text-[var(--text-muted)]">{unknownLoadSessions} activities have no TSS. Fitness and fatigue leave them out. Marked days on the chart are missing data, not zero.</p> : null}
                  {hasHistory ? (
                    <PerformanceChart series={load.series} today={load.today} />
                  ) : (
                    <EmptyState
                      title="Your fitness line starts once you have TSS data."
                      description="Activities you log by hand count toward your training time. Only activities with TSS build this line."
                    />
                  )}
                  <Link href="/athlete/activity" className={`${ghostButtonClassName('compact')} max-md:min-h-11`}>
                    All activity
                    <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
                  </Link>
                </div>
              </HomeSummaryDialog>
            ) : null}
            {cards.has('weekLoad') ? (
              <HomeSummaryDialog
                label="Weekly volume"
                description="Outlines show planned hours. Filled bars show hours done."
                className="md:flex-[1_1_0%]"
                summary={
                  <span className="flex items-end justify-between gap-4">
                    <span className="min-w-0">
                      <span className="data block text-xl font-medium leading-none tracking-[-0.02em] text-[var(--text)]">
                        {thisWeek ? formatDuration(thisWeek.completed.durationSec) : '–'}
                      </span>
                      <span className="data mt-1.5 block text-xs text-[var(--text-muted)]">
                        {thisWeek ? `of ${formatDuration(thisWeek.planned.durationSec)} this week` : 'No plan this week'}
                      </span>
                    </span>
                    <MiniBars bars={volumeBars} className="w-24 shrink-0" />
                  </span>
                }
              >
                <WeeklyVolumeChart weeks={volumeWeeks} />
              </HomeSummaryDialog>
            ) : null}
            {cards.has('lastActivity') ? (
              dashboard.lastActivity ? (
                <HomeSummaryDialog
                  label="Last activity"
                  description={`${format(dashboard.lastActivity.completedAt, 'EEE\u00A0d\u00A0MMM')}\u00A0· ${getSportLabel(dashboard.lastActivity.sport)}`}
                  className="md:flex-[1_1_0%]"
                  summary={
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium text-[var(--text)]">{dashboard.lastActivity.title}</span>
                      <span className="data mt-1 block text-xs text-[var(--text-muted)]">
                        {format(dashboard.lastActivity.completedAt, 'EEE\u00A0d\u00A0MMM')}&nbsp;· {formatDuration(dashboard.lastActivity.durationSec)}&nbsp;· {dashboard.lastActivity.tss}&nbsp;TSS
                      </span>
                    </span>
                  }
                >
                  <div className="flex flex-col gap-4">
                    <p className="text-lg font-medium text-[var(--text)] [overflow-wrap:anywhere]">{dashboard.lastActivity.title}</p>
                    <dl className="grid grid-cols-3 gap-3">
                      {[
                        ['Time', formatDuration(dashboard.lastActivity.durationSec)],
                        ['TSS', String(dashboard.lastActivity.tss)],
                        ['RPE', dashboard.lastActivity.rpe ? `${dashboard.lastActivity.rpe}/10` : '–'],
                      ].map(([label, value]) => (
                        <MetricPair key={label} label={label} value={value} />
                      ))}
                    </dl>
                    {dashboard.lastActivity.notes ? (
                      <p className="text-sm text-[var(--text-secondary)]">&ldquo;{dashboard.lastActivity.notes}&rdquo;</p>
                    ) : null}
                    <Link href={`/athlete/session/${dashboard.lastActivity.sessionId}?from=home`} className={`${ghostButtonClassName('compact')} self-start max-md:min-h-11`}>
                      Open activity
                      <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
                    </Link>
                  </div>
                </HomeSummaryDialog>
              ) : (
                <div className="tile flex flex-col gap-3 rounded-2xl p-4 md:flex-[1_1_0%]">
                  <p className="text-sm text-[var(--text-secondary)]">Last activity</p>
                  <p className="text-xs text-[var(--text-muted)]">Your latest activity shows up here.</p>
                </div>
              )
            ) : null}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
