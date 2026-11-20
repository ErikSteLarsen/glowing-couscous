import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageShell } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { parseCalendarDay, parseCalendarView } from '@/lib/calendar-navigation';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { todayInZone } from '@/lib/user-time';
import { AthleteCalendar, type CalendarDay, type CalendarWeek } from './AthleteCalendar';

export const metadata: Metadata = { title: 'Calendar' };

export default async function AthleteCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string; date?: string; view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { weekStart, date, view } = await searchParams;
  const selectedView = parseCalendarView(view);
  const timeZone = await getRequestTimeZone();
  const today = todayInZone(timeZone);
  // yyyy-MM-dd is a local calendar day; anything else falls back to today.
  const day = parseCalendarDay(date) ?? parseCalendarDay(weekStart) ?? today;
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
      <AthleteCalendar key={`${selectedView}:${day}`} view={selectedView} day={day} today={today} weeks={weeks} />
    </PageShell>
  );
}
