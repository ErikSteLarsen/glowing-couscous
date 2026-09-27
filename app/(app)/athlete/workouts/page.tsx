import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
import { WorkoutLibraryClient } from '@/components/WorkoutLibraryClient';
import { MobileLibrarySwitch } from '@/components/MobileLibrarySwitch';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { templateService } from '@/lib/template-service';
import { workoutLibraryService } from '@/lib/workout-library-service';
import { accountService } from '@/lib/account-service';

export default async function AthleteWorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const { edit } = await searchParams;
  const parsedWorkoutId = edit && /^[1-9]\d*$/.test(edit) ? Number(edit) : null;
  const initialWorkoutId = parsedWorkoutId !== null && Number.isSafeInteger(parsedWorkoutId) ? parsedWorkoutId : null;
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
      <MobileLibrarySwitch active="workouts" />
      <WorkoutLibraryClient
        role="ATHLETE"
        workouts={workouts}
        templates={templates}
        endpoint="/api/athlete/workouts"
        performanceProfile={account?.performanceProfile}
        initialWorkoutId={initialWorkoutId}
      />
    </PageShell>
  );
}
