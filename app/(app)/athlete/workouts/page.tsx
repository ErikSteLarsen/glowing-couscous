import { endOfWeek, format, startOfWeek } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { SessionRow } from '@/components/tempo/SessionRow';
import { WorkoutLibraryClient } from '@/components/WorkoutLibraryClient';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
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

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeek = workoutList.workouts.filter((workout) => workout.date >= weekStart && workout.date <= weekEnd);
  const laterWorkouts = workoutList.workouts.filter((workout) => !thisWeek.some((current) => current.id === workout.id));
  const scheduledWorkouts = [...thisWeek, ...laterWorkouts];

  return (
    <PageShell size="wall">
      <TopBar
        title="Workouts"
        description="Create and keep workouts here. Use Planner when you are ready to place one on a day."
        actions={<ActionLink href="/athlete/planner" tone="secondary">Open Planner</ActionLink>}
      />
      <Surface className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Scheduled work</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM')} · current sessions first</p>
          </div>
          <ActionLink href="/athlete/calendar" tone="ghost">Open calendar</ActionLink>
        </div>
        {scheduledWorkouts.length === 0 ? (
          <EmptyState title="Nothing scheduled yet" description="Create a workout below, then use Planner to place it on a day." />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {scheduledWorkouts.map((workout) => (
              <SessionRow
                key={workout.id}
                session={workout}
                href={`/athlete/session/${workout.id}?from=workouts`}
                variant="default"
                dateLabel={format(workout.date, 'EEE d MMM')}
              />
            ))}
          </div>
        )}
      </Surface>

      <WorkoutLibraryClient
        role="ATHLETE"
        workouts={libraryWorkouts}
        templates={templates}
        endpoint="/api/athlete/workouts"
      />
    </PageShell>
  );
}
