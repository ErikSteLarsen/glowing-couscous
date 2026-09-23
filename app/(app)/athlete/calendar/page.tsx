import { addMonths, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  PageShell,
  ghostButtonClassName,
  Surface,
  TopBar,
  getSegmentedChoiceClassName,
} from '@/components/ui';
import { SessionRow } from '@/components/tempo/SessionRow';
import { AthleteCalendarWeekScroller } from './AthleteCalendarWeekScroller';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';

export default async function AthleteCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string; date?: string; view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const { weekStart, date, view } = await searchParams;
  const selectedView = view === 'month' ? 'month' : 'week';
  const referenceDate = date ?? weekStart ?? new Date().toISOString();
  const resolvedReferenceDate = new Date(referenceDate);
  const calendar = await athleteService.loadCalendarView(user.id, referenceDate, selectedView);
  if (!calendar) redirect('/login');

  const buildCalendarHref = (nextView: 'week' | 'month', nextDate: Date) => {
    const params = new URLSearchParams({
      view: nextView,
      date: format(nextDate, 'yyyy-MM-dd'),
    });

    return `/athlete/calendar?${params.toString()}`;
  };

  return (
    <PageShell>
      <TopBar
        title={selectedView === 'month' ? 'Your training month' : 'Your training week'}
        description="Browse your scheduled sessions by week or month."
        actions={
          <>
            <div className="inline-flex gap-1 rounded-[3px] border border-[var(--field-border)] bg-[var(--field-surface)] p-1">
                <Link href={buildCalendarHref('week', resolvedReferenceDate)} aria-current={selectedView === 'week' ? 'page' : undefined} className={getSegmentedChoiceClassName(selectedView === 'week', 'compact')}>
                Week
              </Link>
               <Link href={buildCalendarHref('month', resolvedReferenceDate)} aria-current={selectedView === 'month' ? 'page' : undefined} className={getSegmentedChoiceClassName(selectedView === 'month', 'compact')}>
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
                 className={`${ghostButtonClassName('compact')} gap-1.5`}
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                Previous
              </Link>
              <Link
                href={buildCalendarHref('month', addMonths(resolvedReferenceDate, 1))}
                aria-label="Go to next month"
                 className={`${ghostButtonClassName('compact')} gap-1.5`}
              >
                Next
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </nav>
          </div>

          <div className="min-w-0 pb-1">
            <div className="space-y-2 sm:space-y-3">
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                  <p
                    key={label}
                    className="px-2 text-center text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]"
                  >
                    {label}
                  </p>
                ))}
              </div>

              <div className="grid gap-1 sm:gap-2">
                  {calendar.weeks.map((week, weekIndex) => (
                    <div key={`week-${weekIndex}`} className="grid grid-cols-7 gap-1 sm:gap-2">
                      {week.map((day) => (
                        <div
                          key={day.isoDate}
                          aria-label={`${day.dateLabel}${day.isToday ? ', today' : ''}, ${day.sessions.length} ${day.sessions.length === 1 ? 'session' : 'sessions'}`}
                          role="group"
                          className={`min-h-16 min-w-0 rounded-[3px] border p-1.5 sm:min-h-[128px] sm:p-3 ${
                            day.isCurrentMonth
                              ? 'border-[var(--border)] bg-[var(--surface)]'
                              : 'border-[var(--field-border)] bg-[var(--field-surface)] text-[var(--text-muted)]'
                          }`}
                        >
                           <div className="flex items-start justify-between gap-1 sm:gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className={`text-[15px] font-semibold text-[var(--text)] ${day.isToday ? 'current-day-date' : ''}`}>{day.dateLabel}</p>
                            </div>
                             <span className="rounded-full border border-[var(--field-border)] bg-[var(--field-surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] sm:px-2 sm:py-1">
                               {day.sessions.length}
                             </span>
                          </div>
                           <div className="mt-2 hidden space-y-2 sm:block">
                             {day.sessions.length > 0 ? (
                               day.sessions.slice(0, 1).map((session) => (
                                 <SessionRow
                                   key={session.id}
                                    session={session}
                                    href={`/athlete/session/${session.id}?from=calendar`}
                                    variant="month"
                                    showTime={false}
                                   muted={session.status === 'completed'}
                                 />
                               ))
                            ) : (
                              <Link
                                href={buildCalendarHref('week', new Date(`${day.isoDate}T12:00:00`))}
                                 className={ghostButtonClassName('compact')}
                              >
                                No session
                              </Link>
                            )}
                            {day.sessions.length > 1 ? <p className="text-[11px] text-[var(--text-secondary)]">+{day.sessions.length - 1} more</p> : null}
                          </div>
                          <Link href={buildCalendarHref('week', new Date(`${day.isoDate}T12:00:00`))} className="mt-1 flex min-h-11 items-center text-[11px] font-medium text-[var(--brand)] sm:hidden">
                            View day
                          </Link>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </Surface>
      )}
    </PageShell>
  );
}
