import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageShell } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import {
  CALENDAR_TOTALS_COOKIE,
  parseCalendarDay,
  parseCalendarPlacement,
  parseCalendarReturn,
  parseCalendarTotals,
  parseCalendarView,
  type CalendarPlacement as PlacementKind,
  type CalendarView,
} from '@/lib/calendar-navigation';
import { getDefaultPlanStart, parsePlacedCount } from '@/lib/calendar-placement';
import { resolvePlannerSourceSelection } from '@/lib/planner-source-selection';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { todayInZone } from '@/lib/user-time';
import { AthleteCalendar, type CalendarDay, type CalendarWeek } from './AthleteCalendar';
import { AddPlanDialog } from './AddPlanDialog';
import { AddWorkoutDialog } from './AddWorkoutDialog';
import { loadAddablePlans, loadAddableWorkouts } from '@/lib/placement-options';

export const metadata: Metadata = { title: 'Calendar' };

export default async function AthleteCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string; date?: string; view?: string; place?: string; source?: string; placed?: string; back?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { weekStart, date, view, place, source, placed, back } = await searchParams;
  const selectedView = parseCalendarView(view);
  const timeZone = await getRequestTimeZone();
  const today = todayInZone(timeZone);
  // yyyy-MM-dd is a local calendar day; anything else falls back to today.
  const requestedDay = parseCalendarDay(date) ?? parseCalendarDay(weekStart);
  const day = requestedDay ?? today;
  const placement = parseCalendarPlacement(place);
  const showTotals = parseCalendarTotals((await cookies()).get(CALENDAR_TOTALS_COOKIE)?.value);
  const [calendar, dialog] = await Promise.all([
    athleteService.loadCalendarView(user.id, day, selectedView, { timeZone }),
    placement ? placementDialog({ userId: user.id, view: selectedView, day, today, requestedDay, placement, source, returnHref: parseCalendarReturn(back) }) : null,
  ]);
  if (!calendar) redirect('/athlete/find-coach');

  const toDay = (entry: (typeof calendar.days)[number]): CalendarDay => ({
    isoDate: entry.isoDate,
    label: entry.label,
    dateLabel: entry.dateLabel,
    isToday: entry.isToday,
    isCurrentMonth: entry.isCurrentMonth,
    sessions: entry.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      sport: session.sport,
      timeLabel: session.timeLabel,
      durationSec: session.activityDurationSec ?? session.durationSec,
      distanceMeters: session.distanceMeters,
      tss: session.tss,
      compliance: session.compliance,
      canReschedule: session.canReschedule,
      canDelete: session.canReschedule,
      segments: session.segments,
    })),
    events: entry.events.map((event) => ({ id: event.id, title: event.title, sport: event.sport, targetFinishSec: event.targetFinishSec, resultFinishSec: event.resultFinishSec })),
  });
  const dayRows = selectedView === 'week' ? [calendar.days] : calendar.weeks;
  const weeks: CalendarWeek[] = dayRows.map((row) => ({
    weekStart: row[0].isoDate,
    days: row.map(toDay),
    summary: calendar.weekSummaries.find((summary) => summary.weekStart === row[0].isoDate) ?? null,
  }));
  const placedCount = parsePlacedCount(placed);

  return (
    <PageShell size="wall">
      <AthleteCalendar key={`${selectedView}:${day}:${placedCount ?? ''}`} view={selectedView} day={day} today={today} weeks={weeks} initialShowTotals={showTotals} placedCount={placedCount} shortcutsEnabled={!placement} />
      {dialog}
    </PageShell>
  );
}

/**
 * The add dialog over the Calendar: `place=workout` (Add workout) or
 * `place=template` (Add training plan), optionally with `source=` chosen.
 */
async function placementDialog({ userId, view, day, today, requestedDay, placement, source, returnHref }: {
  userId: number;
  view: CalendarView;
  day: string;
  today: string;
  requestedDay: string | null;
  placement: PlacementKind;
  source?: string;
  returnHref: string | null;
}) {
  // Plans come from `place=template` or a plan source; everything else is a workout.
  const kind: PlacementKind = source?.startsWith('template:') || source?.startsWith('built-in-plan:')
    ? 'template'
    : source?.startsWith('workout:') || source?.startsWith('catalog:') ? 'workout' : placement;
  const [workouts, plans] = await Promise.all([
    kind === 'workout' ? loadAddableWorkouts(userId) : [],
    kind === 'template' ? loadAddablePlans(userId) : [],
  ]);
  const keyId = (prefix: string) => (key: string) => Number(key.slice(prefix.length));
  const selection = resolvePlannerSourceSelection(source, {
    workoutIds: workouts.filter((entry) => entry.origin === 'mine').map((entry) => keyId('workout:')(entry.key)),
    catalogSlugs: workouts.filter((entry) => entry.origin === 'library').map((entry) => entry.key.slice('catalog:'.length)),
    templateIds: plans.filter((entry) => entry.origin === 'mine').map((entry) => keyId('template:')(entry.key)),
    builtInSlugs: plans.filter((entry) => entry.origin === 'built-in').map((entry) => entry.key.slice('built-in-plan:'.length)),
  });
  const initialMessage = source && !selection ? 'That workout or training plan is no longer available. Choose another one.' : '';
  // A new URL (another day or source) starts a fresh draft.
  const dialogKey = `${kind}:${day}:${source ?? ''}`;

  if (kind === 'template') {
    return (
      <AddPlanDialog
        key={dialogKey}
        view={view}
        day={day}
        today={today}
        plans={plans}
        initialKey={selection?.key ?? null}
        initialStart={getDefaultPlanStart(today, requestedDay)}
        initialMessage={initialMessage}
        returnHref={returnHref}
      />
    );
  }
  return (
    <AddWorkoutDialog
      key={dialogKey}
      view={view}
      day={day}
      workouts={workouts}
      initialKey={selection?.key ?? null}
      initialMessage={initialMessage}
      returnHref={returnHref}
    />
  );
}
