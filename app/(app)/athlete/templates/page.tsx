import { redirect } from 'next/navigation';

import { PageShell, TopBar } from '@/components/ui';
import { MobileLibrarySwitch } from '@/components/MobileLibrarySwitch';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { templateService } from '@/lib/template-service';
import { workoutLibraryService } from '@/lib/workout-library-service';
import { derivePlannerSourceDurationSec } from '@/lib/planner-source-metrics';

import { builtInPlanPreviews } from '@/lib/plan-catalog';
import { parseTemplateRoutine } from '@/lib/template-routine';
import { workoutCatalog } from '@/lib/workout-catalog';
import { catalogWorkoutMetrics } from '@/lib/workout-catalog/metrics';
import { TrainingTemplatesClient } from '@/components/TrainingTemplatesClient';

export default async function AthleteTemplatesPage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const { plan } = await searchParams;
  const [templates, workouts] = await Promise.all([
    templateService.listForOwner(user.id),
    workoutLibraryService.listForOwner('athlete', user.id),
  ]);

  return (
    <PageShell>
      <TopBar
        title="Training plans"
        description="Choose a built-in week or build your own with workouts from My workouts and the public library."
      />
      <MobileLibrarySwitch active="templates" />
      <TrainingTemplatesClient
        openPlanSlug={typeof plan === 'string' ? plan : null}
        builtInPlans={builtInPlanPreviews}
        templates={templates.map(({ id, name, summary, routineJson }) => ({
          id, name, summary,
          entries: parseTemplateRoutine(routineJson)?.entries.map(({ weekday, title, sport, workoutId, catalogWorkoutSlug }) =>
            workoutId === undefined ? { weekday, title, sport, catalogWorkoutSlug } : { weekday, title, sport, workoutId },
          ) ?? null,
        }))}
        workouts={workouts.map(workout => ({
          id: workout.id, title: workout.title, sport: workout.sport,
          durationSec: derivePlannerSourceDurationSec(workout.blocks),
        }))}
        publicWorkouts={workoutCatalog.map(workout => ({
          slug: workout.slug, title: workout.name, sport: workout.sport, durationSec: catalogWorkoutMetrics(workout).durationSec,
        })).sort((a, b) => a.title.localeCompare(b.title))}
      />
    </PageShell>
  );
}
