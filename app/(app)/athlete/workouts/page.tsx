import { format } from 'date-fns';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { WorkspaceNav } from '@/components/WorkspaceNav';
import { WorkoutLibraryClient } from '@/components/WorkoutLibraryClient';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { templateService } from '@/lib/template-service';
import { workoutLibraryService } from '@/lib/workout-library-service';

export default async function AthleteWorkoutsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const [workoutList, libraryWorkouts, templates] = await Promise.all([
    athleteService.loadWorkoutList(user.id),
    workoutLibraryService.listForOwner('athlete', user.id),
    templateService.listForOwner(user.id),
  ]);
  if (!workoutList) redirect('/athlete/find-coach');

  return (
    <PageShell size="wide">
      <TopBar
        title="Workouts"
        description="Create and keep workouts here. Use Planner when you are ready to place one on a day."
        actions={<ActionLink href="/athlete/planner" tone="secondary">Open Planner</ActionLink>}
      />
      <WorkspaceNav role="ATHLETE" active="workouts" />

      <WorkoutLibraryClient
        role="ATHLETE"
        workouts={libraryWorkouts}
        templates={templates}
        endpoint="/api/athlete/workouts"
      />

      <Surface className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Scheduled workouts</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Work already placed on your calendar appears here as well.</p>
          </div>
          <ActionLink href="/athlete/calendar" tone="ghost">Open calendar</ActionLink>
        </div>
        {workoutList.workouts.length === 0 ? (
          <EmptyState title="Nothing scheduled yet" description="Create a workout above, then use Planner to place it on a day." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {workoutList.workouts.map((workout) => (
              <Link
                key={workout.id}
                href={`/athlete/session/${workout.id}?from=workouts`}
                className="group rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
              >
                <div className="h-full rounded-[12px] border border-[var(--border)] bg-[var(--field-surface)] p-4 transition group-hover:border-[var(--field-focus)] group-hover:bg-[var(--surface)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                        {format(workout.date, 'EEE d MMM')} · {workout.timeLabel}
                      </p>
                      <h3 className="mt-2 break-words text-[15px] font-semibold text-[var(--text)]">{workout.title}</h3>
                      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{getSportLabel(workout.sport)}</p>
                    </div>
                    <StatusBadge status={workout.status} />
                  </div>
                  <div className="mt-4"><SessionBlockBar segments={workout.segments} /></div>
                  <div className="mt-3 flex flex-wrap gap-4 text-[13px] text-[var(--text-secondary)]">
                    <MetricText>{formatDuration(workout.durationSec)}</MetricText>
                    <MetricText>{workout.tss} TSS</MetricText>
                    {workout.targetLabel ? <span>{workout.targetLabel}</span> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Surface>
    </PageShell>
  );
}
