import { format } from 'date-fns';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';

export default async function AthleteWorkoutsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const workoutList = await athleteService.loadWorkoutList(user.id);
  if (!workoutList) redirect('/athlete/find-coach');

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Workouts"
        title="Your workouts"
        description="Open any planned or completed session to see its full structure."
      />

      {workoutList.workouts.length === 0 ? (
        <EmptyState title="No workouts yet" description="Assigned sessions will appear here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {workoutList.workouts.map((workout) => (
            <Link
              key={workout.id}
              href={`/athlete/session/${workout.id}?from=workouts`}
              className="group rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              <Surface className="h-full space-y-4 transition group-hover:border-[var(--field-focus)] group-hover:bg-[var(--field-surface)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                      {format(workout.date, 'EEE d MMM')} · {workout.timeLabel}
                    </p>
                    <h2 className="mt-2 break-words text-[15px] font-semibold text-[var(--text)]">
                      {workout.title}
                    </h2>
                    <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{getSportLabel(workout.sport)}</p>
                  </div>
                  <StatusBadge status={workout.status} />
                </div>
                <SessionBlockBar segments={workout.segments} />
                <div className="flex flex-wrap gap-4 text-[13px] text-[var(--text-secondary)]">
                  <MetricText>{formatDuration(workout.durationSec)}</MetricText>
                  <MetricText>{workout.tss} TSS</MetricText>
                  {workout.targetLabel ? <span>{workout.targetLabel}</span> : null}
                </div>
              </Surface>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
