import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageShell } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { athletePlannerService } from '@/lib/athlete-planner-service';
import { athleteService } from '@/lib/athlete-service';
import {
  CALENDAR_TOTALS_COOKIE,
  parseCalendarDay,
  parseCalendarPlacement,
  parseCalendarTotals,
  parseCalendarView,
  type CalendarPlacement as PlacementKind,
  type CalendarView,
} from '@/lib/calendar-navigation';
import { resolvePlannerSourceSelection } from '@/lib/planner-source-selection';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { todayInZone } from '@/lib/user-time';
import { workoutLibraryService } from '@/lib/workout-library-service';
import { AthleteCalendar, type CalendarDay, type CalendarWeek } from './AthleteCalendar';
import { CalendarPlacement } from './CalendarPlacement';

export const metadata: Metadata = { title: 'Calendar' };

export default async function AthleteCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string; date?: string; view?: string; place?: string; source?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { weekStart, date, view, place, source } = await searchParams;
  const selectedView = parseCalendarView(view);
  const timeZone = await getRequestTimeZone();
  const today = todayInZone(timeZone);
  // yyyy-MM-dd is a local calendar day; anything else falls back to today.
  const day = parseCalendarDay(date) ?? parseCalendarDay(weekStart) ?? today;
  const placement = parseCalendarPlacement(place);
  if (placement) {
    return <PlacementPage userId={user.id} view={selectedView} day={day} today={today} placement={placement} source={source} />;
  }
  const showTotals = parseCalendarTotals((await cookies()).get(CALENDAR_TOTALS_COOKIE)?.value);
  const calendar = await athleteService.loadCalendarView(user.id, day, selectedView, { timeZone });
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
      durationSec: session.durationSec,
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

  return (
    <PageShell size="wall">
      <AthleteCalendar key={`${selectedView}:${day}`} view={selectedView} day={day} today={today} weeks={weeks} initialShowTotals={showTotals} />
    </PageShell>
  );
}

/** Placement: choose a saved workout or routine and its dates, through the planner service. */
async function PlacementPage({ userId, view, day, today, placement, source }: {
  userId: number;
  view: CalendarView;
  day: string;
  today: string;
  placement: PlacementKind;
  source?: string;
}) {
  const [workspace, workouts] = await Promise.all([
    athletePlannerService.loadWorkspace(userId, day, { includeWeek: false }),
    workoutLibraryService.listForOwner('athlete', userId),
  ]);
  const initialSource = resolvePlannerSourceSelection(source, {
    workoutIds: workouts.map((workout) => workout.id),
    templateIds: workspace.templates.map((template) => template.id),
  });
  const initialMessage = source && !initialSource ? 'That saved item is no longer available in your library.' : '';

  return (
    <PageShell size="wall">
      <CalendarPlacement
        view={view}
        placement={placement}
        templates={workspace.templates}
        workouts={workouts}
        calendarDays={workspace.calendarDays}
        calendarLabel={workspace.calendar.label}
        initialDate={day}
        today={today}
        initialSourceKey={initialSource?.key ?? ''}
        initialSourceTab={initialSource?.tab ?? placement}
        initialMessage={initialMessage}
      />
    </PageShell>
  );
}
