import { redirect } from 'next/navigation';
import { ActionLink, PageShell, TopBar } from '@/components/ui';
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
    <PageShell size="wide" className="max-w-[1400px]">
      <TopBar
        title="Workouts"
        description="Create reusable workout definitions here. Use Planner to place an independent copy on a day."
        actions={<ActionLink href="/athlete/planner" tone="secondary">Open Planner</ActionLink>}
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
