import { redirect } from 'next/navigation';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { workoutLibraryService } from '@/lib/workout-library-service';
import { accountService } from '@/lib/account-service';
import { FocusWorkouts } from '@/components/FocusWorkouts';

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
  const [workouts, account] = await Promise.all([
    workoutLibraryService.listForOwner('athlete', user.id),
    accountService.getAccount(user.id),
  ]);

  return <FocusWorkouts
    ownerId={user.id}
    role="ATHLETE"
    workouts={workouts}
    endpoint="/api/athlete/workouts"
    performanceProfile={account?.performanceProfile}
    initialWorkoutId={initialWorkoutId}
  />;
}
