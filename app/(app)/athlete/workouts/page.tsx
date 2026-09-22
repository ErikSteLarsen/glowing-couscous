import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
import { WorkoutLibraryClient } from '@/components/WorkoutLibraryClient';
import { getCurrentUser } from '@/lib/auth-session';
import { templateService } from '@/lib/template-service';
import { workoutLibraryService } from '@/lib/workout-library-service';
import { accountService } from '@/lib/account-service';

export default async function AthleteWorkoutsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const [workouts, templates, account] = await Promise.all([
    workoutLibraryService.listForOwner('athlete', user.id),
    templateService.listForOwner(user.id),
    accountService.getAccount(user.id),
  ]);

  return (
    <PageShell>
      <TopBar
        title="Workouts"
        description="Create and edit reusable workouts."
      />
      <WorkoutLibraryClient
        role="ATHLETE"
        workouts={workouts}
        templates={templates}
        endpoint="/api/athlete/workouts"
        performanceProfile={account?.performanceProfile}
      />
    </PageShell>
  );
}
