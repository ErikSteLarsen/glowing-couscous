import { LibraryWorkoutMenu } from '@/components/library/LibraryWorkoutMenu';
import { CatalogProfile } from '@/components/library/CatalogProfile';
import { WorkoutCard, WorkoutCardFooter, WorkoutCardHeader, WorkoutCardMeta, WorkoutCardProfile, WorkoutCardSummary } from '@/components/library/WorkoutCard';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { compactSecondaryButtonClassName } from '@/components/ui';
import { formatDuration } from '@/lib/format-duration';
import { expandCatalogItems } from '@/lib/workout-catalog/metrics';
import { categoryLabel, levelLabel, type CatalogEntry } from '@/lib/workout-catalog/query';

export function LibraryCard({ entry, from }: { entry: CatalogEntry; from?: 'ride' }) {
  const { workout, metrics } = entry;
  const steps = expandCatalogItems(workout.items);
  const href = `/athlete/library/${workout.slug}${from === 'ride' ? '?from=ride' : ''}`;

  return (
    <WorkoutCard>
      <WorkoutCardProfile>
        <CatalogProfile steps={steps} idPrefix={`card-${workout.slug}`} label={`${workout.name} intensity profile, ${formatDuration(metrics.durationSec)}, peak ${Math.round(metrics.maxPct)}% FTP`} className="h-14" />
      </WorkoutCardProfile>
      <WorkoutCardHeader href={href} aside={formatDuration(metrics.durationSec)}>{workout.name}</WorkoutCardHeader>
      <WorkoutCardMeta>{categoryLabel(workout.category)}&nbsp;· {levelLabel(workout.level)}</WorkoutCardMeta>
      <WorkoutCardSummary>{workout.summary}</WorkoutCardSummary>
      <WorkoutCardFooter
        metrics={[{ label: 'TSS', value: metrics.tss }, { label: 'IF', value: metrics.intensityFactor.toFixed(2) }]}
        actions={<>
          {from === 'ride' ? (
            <WorkoutStartChooser
              workout={{ title: workout.name, durationSec: metrics.durationSec, sport: 'BIKING', status: 'planned', hasSteps: steps.length > 0 }}
              source={{ kind: 'catalog', slug: workout.slug, from: 'ride' }}
              triggerClassName={`${compactSecondaryButtonClassName} max-md:min-h-11`}
            />
          ) : null}
          <LibraryWorkoutMenu slug={workout.slug} name={workout.name} from={from ?? 'library'} showSchedule />
        </>}
      />
    </WorkoutCard>
  );
}
