import { redirect } from 'next/navigation';

import { ActionLink, PageShell, TopBar } from '@/components/ui';
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
    <PageShell size="wide" className="max-w-[1400px]">
      <TopBar
        title="Workouts"
        description="Create and manage standalone workouts. Nothing here is assigned to a day until you use Planner."
        actions={<ActionLink href="/coach/planner" tone="secondary">Open Planner</ActionLink>}
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
