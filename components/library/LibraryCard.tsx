import Link from 'next/link';
import { LibraryWorkoutMenu } from '@/components/library/LibraryWorkoutMenu';
import { CatalogProfile } from '@/components/library/CatalogProfile';
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
    <article className="tile tile--interactive group relative flex h-full flex-col rounded-2xl p-4 [--profile-gap:var(--surface)] hover:[--profile-gap:var(--raised)] has-[a:focus-visible]:border-[var(--brand)]">
      <CatalogProfile steps={steps} idPrefix={`card-${workout.slug}`} label={`${workout.name} intensity profile, ${formatDuration(metrics.durationSec)}, peak ${Math.round(metrics.maxPct)}% FTP`} className="h-14" />
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-base font-medium leading-snug text-[var(--text)]">
          <Link href={href} className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']">
            {workout.name}
          </Link>
        </h3>
        <span className="data shrink-0 text-[13px] text-[var(--text-secondary)]">{formatDuration(metrics.durationSec)}</span>
      </div>
      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{categoryLabel(workout.category)} · {levelLabel(workout.level)}</p>
      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{workout.summary}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
        <dl className="data flex gap-4 text-[12px] text-[var(--text-muted)]">
          <div className="flex gap-1"><dt>TSS</dt><dd className="text-[var(--text)]">{metrics.tss}</dd></div>
          <div className="flex gap-1"><dt>IF</dt><dd className="text-[var(--text)]">{metrics.intensityFactor.toFixed(2)}</dd></div>
        </dl>
        <div className="flex items-center gap-1">
          {from === 'ride' ? (
            <WorkoutStartChooser
              workout={{ title: workout.name, durationSec: metrics.durationSec, sport: 'BIKING', status: 'planned', hasSteps: steps.length > 0 }}
              source={{ kind: 'catalog', slug: workout.slug, from: 'ride' }}
              triggerClassName={`${compactSecondaryButtonClassName} relative z-10 max-md:min-h-11`}
            />
          ) : null}
          <LibraryWorkoutMenu slug={workout.slug} name={workout.name} from={from ?? 'library'} showSchedule />
        </div>
      </div>
    </article>
  );
}
