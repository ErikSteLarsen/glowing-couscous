import { redirect } from 'next/navigation';

import { PageShell, TopBar } from '@/components/ui';
import { WorkoutLibraryClient } from '@/components/WorkoutLibraryClient';
import { getCurrentUser } from '@/lib/auth-session';
import { templateService } from '@/lib/template-service';
import { workoutLibraryService } from '@/lib/workout-library-service';

export default async function CoachWorkoutsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const [workouts, templates] = await Promise.all([
    workoutLibraryService.listForOwner('coach', user.id),
    templateService.listForOwner(user.id),
  ]);

  return (
    <PageShell>
      <TopBar
        title="Workouts"
        description="Create workouts once, then add copies to specific days in Planner. Your library versions stay unscheduled."
      />
      <WorkoutLibraryClient
        role="COACH"
        workouts={workouts}
        templates={templates}
        endpoint="/api/coach/workouts"
      />
    </PageShell>
  );
}
