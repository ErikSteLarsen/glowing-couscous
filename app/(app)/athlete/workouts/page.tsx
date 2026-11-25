import { redirect } from 'next/navigation';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { workoutLibraryService } from '@/lib/workout-library-service';
import { accountService } from '@/lib/account-service';
import { workoutCatalog } from '@/lib/workout-catalog';
import { createCatalogListEntries, findCatalogWorkout } from '@/lib/workout-catalog/query';
import { createCatalogWorkoutDraft } from '@/lib/workout-catalog/session';
import { FocusWorkouts } from '@/components/FocusWorkouts';

const catalogEntries = createCatalogListEntries(workoutCatalog);

export default async function AthleteWorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const { edit, customize } = await searchParams;
  const parsedWorkoutId = typeof edit === 'string' && /^[1-9]\d*$/.test(edit) ? Number(edit) : null;
  const initialWorkoutId = parsedWorkoutId !== null && Number.isSafeInteger(parsedWorkoutId) ? parsedWorkoutId : null;
  const [workouts, account] = await Promise.all([
    workoutLibraryService.listForOwner('athlete', user.id),
    accountService.getAccount(user.id),
  ]);

  const showCatalog = user.role === 'ATHLETE';
  const catalogWorkout = showCatalog && typeof customize === 'string' ? findCatalogWorkout(workoutCatalog, customize) : null;

  return <FocusWorkouts
    ownerId={user.id}
    workouts={workouts}
    endpoint="/api/athlete/workouts"
    performanceProfile={account?.performanceProfile}
    initialWorkoutId={catalogWorkout ? null : initialWorkoutId}
    initialCustomization={catalogWorkout ? { slug: catalogWorkout.slug, name: catalogWorkout.name, draft: createCatalogWorkoutDraft(catalogWorkout) } : null}
    catalogEntries={showCatalog ? catalogEntries : null}
  />;
}
