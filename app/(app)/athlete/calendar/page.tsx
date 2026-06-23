import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';

export default async function AthleteCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { weekStart } = await searchParams;
  const calendar = await athleteService.loadCalendarView(user.id, weekStart ?? new Date());
  if (!calendar) redirect('/athlete/find-coach');

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Calendar"
        title="Your training week"
        description="A focused week view with session status, duration, and block distribution."
        actions={
          <>
            <ActionLink href={`/athlete/calendar?weekStart=${format(calendar.week.previousStart, 'yyyy-MM-dd')}`} tone="secondary">
              Previous week
            </ActionLink>
            <ActionLink href={`/athlete/calendar?weekStart=${format(calendar.week.nextStart, 'yyyy-MM-dd')}`} tone="secondary">
              Next week
            </ActionLink>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {calendar.days.map((day) => (
          <Surface key={day.isoDate} className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                {day.label}
              </p>
              <p className="metric-text mt-1 text-[20px] font-semibold text-[var(--text)]">
                {day.dateLabel}
              </p>
            </div>
            {day.sessions.length > 0 ? (
              day.sessions.map((session) => (
                <div key={session.id} className="space-y-2 rounded-[10px] border border-[var(--border)] bg-[#FBFAF7] p-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[var(--text)]">{session.title}</p>
                    <div className="ml-auto">
                      <StatusBadge status={session.status} />
                    </div>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    {session.timeLabel} · {getSportLabel(session.sport)}
                  </p>
                  <SessionBlockBar segments={session.segments} compact />
                  <div className="flex flex-wrap gap-3 text-[12px] text-[var(--text-secondary)]">
                    <MetricText>{formatDuration(session.durationSec)}</MetricText>
                    <MetricText>{session.tss} TSS</MetricText>
                  </div>
                  <ActionLink href={`/athlete/session/${session.id}`} tone="ghost">
                    Open session
                  </ActionLink>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-[var(--text-muted)]">No session planned.</p>
            )}
          </Surface>
        ))}
      </div>

      {calendar.days.every((day) => day.sessions.length === 0) ? (
        <EmptyState
          title="No sessions this week"
          description="When sessions are assigned, they will appear here with their Tempo block bars."
        />
      ) : null}
    </PageShell>
  );
}
