import { redirect } from 'next/navigation';

import { PageShell, TopBar } from '@/components/ui';
import { WorkoutLibraryClient } from '@/components/WorkoutLibraryClient';
import { getCurrentUser } from '@/lib/auth-session';
import { workoutLibraryService } from '@/lib/workout-library-service';
import { accountService } from '@/lib/account-service';

export default async function CoachWorkoutsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const [workouts, account] = await Promise.all([
    workoutLibraryService.listForOwner('coach', user.id),
    accountService.getAccount(user.id),
  ]);

  return (
    <PageShell>
      <TopBar
        title="Workouts"
        description="Create and edit reusable workouts."
      />
      <WorkoutLibraryClient
        ownerId={user.id}
        role="COACH"
        workouts={workouts}
        endpoint="/api/coach/workouts"
        performanceProfile={account?.performanceProfile}
      />
    </PageShell>
  );
}
