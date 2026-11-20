import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { athleteService } from '@/lib/athlete-service';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { todayInZone } from '@/lib/user-time';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAthlete();
  if (error) return error;

  const view = req.nextUrl.searchParams.get('view') === 'month' ? 'month' : 'week';
  const timeZone = await getRequestTimeZone();
  const date = req.nextUrl.searchParams.get('date') ?? todayInZone(timeZone);
  const calendar = await athleteService.loadCalendarView(user.id, date, view, { timeZone });
  if (!calendar) {
    return NextResponse.json({ error: 'Calendar unavailable' }, { status: 404 });
  }

  return NextResponse.json({
    view: calendar.view,
    period: {
      start: calendar.period.start.toISOString(),
      previousStart: calendar.period.previousStart.toISOString(),
      nextStart: calendar.period.nextStart.toISOString(),
      label: calendar.period.label,
    },
    days: calendar.days.map((day) => ({
      label: day.label,
      dateLabel: day.dateLabel,
      isoDate: day.isoDate,
      isCurrentMonth: day.isCurrentMonth,
      isToday: day.isToday,
      sessions: day.sessions.map((session) => ({
        id: session.id,
        title: session.title,
        sport: session.sport,
        timeLabel: session.timeLabel,
        status: session.status,
        durationSec: session.recordedDurationSec ?? session.durationSec,
        tss: session.tss,
        loadAvailable: session.loadAvailable,
        segments: session.segments,
        intensityTimeline: session.intensityTimeline,
      })),
    })),
  });
}
