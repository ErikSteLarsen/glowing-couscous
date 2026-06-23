import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { athleteService } from '@/lib/athlete-service';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAthlete();
  if (error) return error;

  const view = req.nextUrl.searchParams.get('view') === 'month' ? 'month' : 'week';
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString();
  const calendar = await athleteService.loadCalendarView(user.id, date, view);
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
        durationSec: session.durationSec,
        tss: session.tss,
        segments: session.segments,
      })),
    })),
  });
}
