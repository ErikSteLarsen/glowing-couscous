import { addMonths, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  EmptyState,
  PageShell,
  compactSecondaryButtonClassName,
  Surface,
  TopBar,
  getSegmentedChoiceClassName,
} from '@/components/ui';
import { AthleteCalendarWeekScroller } from './AthleteCalendarWeekScroller';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { getSportLabel } from '@/lib/sport';

export default async function AthleteCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string; date?: string; view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { weekStart, date, view } = await searchParams;
  const selectedView = view === 'month' ? 'month' : 'week';
  const referenceDate = date ?? weekStart ?? new Date().toISOString();
  const resolvedReferenceDate = new Date(referenceDate);
  const calendar = await athleteService.loadCalendarView(user.id, referenceDate, selectedView);
  if (!calendar) redirect('/athlete/find-coach');

  const buildCalendarHref = (nextView: 'week' | 'month', nextDate: Date) => {
    const params = new URLSearchParams({
      view: nextView,
      date: format(nextDate, 'yyyy-MM-dd'),
    });

    return `/athlete/calendar?${params.toString()}`;
  };

  return (
    <PageShell size="wide" className="max-w-[1600px]">
      <TopBar
        title={selectedView === 'month' ? 'Your training month' : 'Your training week'}
        description="Review scheduled work without changing the workout itself. Use Planner when you need to place or move a session."
        actions={
          <>
            <div className="inline-flex gap-1 rounded-[12px] border border-[var(--field-border)] bg-[var(--field-surface)] p-1">
              <Link href={buildCalendarHref('week', resolvedReferenceDate)} className={getSegmentedChoiceClassName(selectedView === 'week', 'compact')}>
                Week
              </Link>
              <Link href={buildCalendarHref('month', resolvedReferenceDate)} className={getSegmentedChoiceClassName(selectedView === 'month', 'compact')}>
                Month
              </Link>
            </div>
          </>
        }
      />
      {selectedView === 'week' ? (
        <AthleteCalendarWeekScroller
          initialDays={calendar.days.map((day) => ({
            label: day.label,
            dateLabel: day.dateLabel,
            isoDate: day.isoDate,
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
          }))}
          initialActiveDateIso={format(resolvedReferenceDate, 'yyyy-MM-dd')}
          todayIso={format(new Date(), 'yyyy-MM-dd')}
        />
      ) : (
        <Surface className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                Month overview
              </p>
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--text)]">{calendar.period.label}</h2>
            </div>
            <nav aria-label="Month navigation" className="flex flex-wrap items-center gap-2 md:ml-auto">
              <Link
                href={buildCalendarHref('month', addMonths(resolvedReferenceDate, -1))}
                aria-label="Go to previous month"
                className={`${compactSecondaryButtonClassName} gap-1.5`}
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                Previous
              </Link>
              <Link
                href={buildCalendarHref('month', addMonths(resolvedReferenceDate, 1))}
                aria-label="Go to next month"
                className={`${compactSecondaryButtonClassName} gap-1.5`}
              >
                Next
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </nav>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="min-w-[720px] space-y-3 sm:min-w-0">
              <div className="grid grid-cols-7 gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                  <p
                    key={label}
                    className="px-2 text-center text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]"
                  >
                    {label}
                  </p>
                ))}
              </div>

              <div className="grid gap-2">
                  {calendar.weeks.map((week, weekIndex) => (
                    <div key={`week-${weekIndex}`} className="grid grid-cols-7 gap-2">
                      {week.map((day) => (
                        <div
                          key={day.isoDate}
                          className={`min-h-[112px] rounded-[12px] border p-2.5 sm:min-h-[128px] sm:p-3 ${
                            day.isCurrentMonth
                              ? 'border-[var(--border)] bg-[var(--surface)]'
                              : 'border-[var(--field-border)] bg-[var(--field-surface)] opacity-65'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="text-[15px] font-semibold text-[var(--text)]">{day.dateLabel}</p>
                              {day.isToday ? (
                                <span className="rounded-full bg-[var(--brand-tint)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--field-selected-text)]">
                                  Today
                                </span>
                              ) : null}
                            </div>
                                   <span className="rounded-full border border-[var(--field-border)] bg-[var(--field-surface)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                              {day.sessions.length}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {day.sessions.length > 0 ? (
                              day.sessions.map((session) => (
                                <Link
                                  key={session.id}
                                  href={`/athlete/session/${session.id}?from=calendar`}
                                  aria-label={`Open ${session.title}`}
                                   className="block rounded-[10px] bg-[var(--field-surface)] px-2.5 py-2 transition hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                                >
                                  <p className="truncate text-[13px] font-semibold text-[var(--text)]">{session.title}</p>
                                  <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
                                    {session.timeLabel} · {getSportLabel(session.sport)}
                                  </p>
                                </Link>
                              ))
                            ) : (
                              <Link
                                href={buildCalendarHref('week', new Date(`${day.isoDate}T12:00:00`))}
                                className="block rounded-[10px] px-2.5 py-2 text-[13px] text-[var(--text-muted)] transition hover:bg-[var(--field-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                              >
                                No session
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </Surface>
      )}

      {selectedView === 'week' && calendar.days.every((day) => day.sessions.length === 0) ? (
        <EmptyState
          title="No sessions this week"
          description="Assigned sessions will appear here."
        />
      ) : null}
    </PageShell>
  );
}
