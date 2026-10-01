import { redirect } from 'next/navigation';

import { PageShell, TopBar } from '@/components/ui';
import { MobileLibrarySwitch } from '@/components/MobileLibrarySwitch';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { templateService } from '@/lib/template-service';
import { workoutLibraryService } from '@/lib/workout-library-service';
import { derivePlannerSourceDurationSec } from '@/lib/planner-source-metrics';

import { TrainingTemplatesClient } from '@/components/TrainingTemplatesClient';

export default async function AthleteTemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const [templates, workouts] = await Promise.all([
    templateService.listForOwner(user.id),
    workoutLibraryService.listForOwner('athlete', user.id),
  ]);

  return (
    <PageShell>
      <TopBar
        title="Templates"
        description="Build a training routine from saved workouts, then apply it to a week or month."
      />
      <MobileLibrarySwitch active="templates" />
      <TrainingTemplatesClient templates={templates} workouts={workouts.map(workout => ({
        id: workout.id, title: workout.title, sport: workout.sport,
        durationSec: derivePlannerSourceDurationSec(workout.blocks),
      }))} />
    </PageShell>
  );
}
