import { addDays, addMonths, format } from 'date-fns';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, Surface, TopBar, getSegmentedChoiceClassName } from '@/components/ui';
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
        eyebrow="Calendar"
        title={selectedView === 'month' ? 'Your training month' : 'Your training week'}
        description={
          selectedView === 'month'
            ? 'A lighter month overview so you can scan the full block at once, then drop back into week detail when needed.'
            : 'A centered day scroller that keeps today in view while you move smoothly across the training weeks.'
        }
        actions={
          <>
            <div className="inline-flex rounded-[12px] border border-[var(--field-border)] bg-[var(--field-surface)] p-1">
              <Link href={buildCalendarHref('week', resolvedReferenceDate)} className={getSegmentedChoiceClassName(selectedView === 'week')}>
                Week
              </Link>
              <Link href={buildCalendarHref('month', resolvedReferenceDate)} className={getSegmentedChoiceClassName(selectedView === 'month')}>
                Month
              </Link>
            </div>
            {selectedView === 'month' ? (
              <>
                <ActionLink href={buildCalendarHref('month', addMonths(resolvedReferenceDate, -1))} tone="secondary">
                  Previous month
                </ActionLink>
                <ActionLink href={buildCalendarHref('month', addMonths(resolvedReferenceDate, 1))} tone="secondary">
                  Next month
                </ActionLink>
              </>
            ) : (
              <ActionLink href={buildCalendarHref('week', addDays(new Date(), 0))} tone="secondary">
                Back to today
              </ActionLink>
            )}
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
        <Surface className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                Month overview
              </p>
              <p className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[var(--text)]">{calendar.period.label}</p>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Compact daily summaries keep the full month readable.
            </p>
          </div>

          <div className="space-y-3">
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
                    <Link
                      key={day.isoDate}
                      href={
                        day.sessions[0]
                          ? `/athlete/session/${day.sessions[0].id}`
                          : buildCalendarHref('week', new Date(`${day.isoDate}T12:00:00`))
                      }
                      className={`min-h-[128px] rounded-[12px] border p-3 transition hover:border-[var(--field-focus)] hover:bg-[var(--field-surface)] ${
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
                        <span className="rounded-full border border-[var(--field-border)] bg-[#FBFAF7] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                          {day.sessions.length}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {day.sessions.length > 0 ? (
                          <>
                            {day.sessions.slice(0, 2).map((session) => (
                              <div key={session.id} className="rounded-[10px] bg-[#FBFAF7] px-2.5 py-2">
                                <p className="truncate text-[12px] font-semibold text-[var(--text)]">{session.title}</p>
                                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                                  {session.timeLabel} · {getSportLabel(session.sport)}
                                </p>
                              </div>
                            ))}
                            {day.sessions.length > 2 ? (
                              <p className="text-[11px] font-medium text-[var(--brand)]">
                                +{day.sessions.length - 2} more
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-[12px] text-[var(--text-muted)]">No session</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Surface>
      )}

      {(selectedView === 'week'
        ? calendar.days.every((day) => day.sessions.length === 0)
        : calendar.weeks.flat().every((day) => day.sessions.length === 0)) ? (
        <EmptyState
          title={selectedView === 'month' ? 'No sessions this month' : 'No sessions this week'}
          description={
            selectedView === 'month'
              ? 'When sessions are assigned, they will appear here as compact day summaries across the full month.'
              : 'When sessions are assigned, they will appear here with their Tempo block bars.'
          }
        />
      ) : null}
    </PageShell>
  );
}
