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
import { CalendarPlacement, type PlacementRoutine } from './CalendarPlacement';
import { parsePlacedCount } from '@/lib/calendar-placement';
import { derivePlannerSourceDurationSec } from '@/lib/planner-source-metrics';
import { getTemplateCadence } from '@/lib/template-cadence';
import { parseTemplateRoutine } from '@/lib/template-routine';
import { loadPlacementWorkspace } from './placement-existing';

export const metadata: Metadata = { title: 'Calendar' };

export default async function AthleteCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string; date?: string; view?: string; place?: string; source?: string; placed?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { weekStart, date, view, place, source, placed } = await searchParams;
  const selectedView = parseCalendarView(view);
  const timeZone = await getRequestTimeZone();
  const today = todayInZone(timeZone);
  // yyyy-MM-dd is a local calendar day; anything else falls back to today.
  const day = parseCalendarDay(date) ?? parseCalendarDay(weekStart) ?? today;
  const placement = parseCalendarPlacement(place);
  if (placement) {
    return <PlacementPage userId={user.id} view={selectedView} day={day} placement={placement} source={source} />;
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

  return (
    <PageShell size="wall">
      <AthleteCalendar key={`${selectedView}:${day}`} view={selectedView} day={day} today={today} weeks={weeks} initialShowTotals={showTotals} placedCount={parsePlacedCount(placed)} />
    </PageShell>
  );
}

/** Placement: choose a saved workout or routine and when, through the planner service. */
async function PlacementPage({ userId, view, day, placement, source }: {
  userId: number;
  view: CalendarView;
  day: string;
  placement: PlacementKind;
  source?: string;
}) {
  const [{ workspace, existing }, workouts] = await Promise.all([
    loadPlacementWorkspace(userId, day),
    workoutLibraryService.listForOwner('athlete', userId),
  ]);
  const initialSource = resolvePlannerSourceSelection(source, {
    workoutIds: workouts.map((workout) => workout.id),
    templateIds: workspace.templates.map((template) => template.id),
  });
  const initialMessage = source && !initialSource ? 'That workout or training plan is no longer in your library.' : '';
  const routines: PlacementRoutine[] = workspace.templates.map((template) => ({
    id: template.id,
    name: template.name,
    summary: template.summary,
    defaultPeriod: getTemplateCadence(template.cadence) === 'month' ? 'month' : 'week',
    entries: (parseTemplateRoutine(template.routineJson)?.entries ?? []).map((entry) => ({ weekday: entry.weekday, title: entry.title, sport: entry.sport })),
  }));

  return (
    <PageShell>
      <CalendarPlacement
        view={view}
        placement={initialSource?.tab === 'template' ? 'template' : initialSource?.tab === 'workout' ? 'workout' : placement}
        workouts={[...workouts]
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .map((workout) => ({ id: workout.id, title: workout.title, sport: workout.sport, summary: workout.summary, durationSec: derivePlannerSourceDurationSec(workout.blocks) }))}
        routines={routines}
        existing={existing}
        initialDate={day}
        initialSourceKey={initialSource?.key ?? ''}
        initialMessage={initialMessage}
      />
    </PageShell>
  );
}
