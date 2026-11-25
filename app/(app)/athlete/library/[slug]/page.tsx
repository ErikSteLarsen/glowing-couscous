import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { LibraryWorkoutActions } from '@/components/library/LibraryWorkoutActions';
import { FtpProfileNote, WorkoutDetail, type WorkoutDetailBlock } from '@/components/library/WorkoutDetail';
import { backToLibrarySport, publicLibraryHref } from '@/lib/athlete-workouts-navigation';
import { accountService } from '@/lib/account-service';
import { parseBackOrigin, resolveBackTarget } from '@/lib/app-navigation';
import { getCurrentUser } from '@/lib/auth-session';
import { formatMeters } from '@/lib/format-distance';
import { formatDuration } from '@/lib/format-duration';
import { workoutCatalog } from '@/lib/workout-catalog';
import { catalogStepZone, catalogWorkoutMetrics, expandCatalogItems, isCatalogRepeat, wattsForPct } from '@/lib/workout-catalog/metrics';
import { getTempoZoneMeta } from '@/lib/tempo-blocks';
import { plansWithWorkout } from '@/lib/plan-catalog';
import { catalogSportLabel, categoryLabel, EMPTY_CATALOG_QUERY, findCatalogWorkout, levelLabel } from '@/lib/workout-catalog/query';
import type { CatalogSport, CatalogStep } from '@/lib/workout-catalog/types';
import { catalogWorkoutToEditorBlocks } from '@/lib/workout-catalog/session';
import { buildWorkoutProfile, levelColor, pctColor } from '@/lib/workout-profile';
import { formatResolvedWorkoutTarget, formatWorkoutTarget } from '@/lib/workout-target-resolution';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const workout = findCatalogWorkout(workoutCatalog, (await params).slug);
  return { title: workout ? workout.name : 'Public library' };
}

const KIND_LABEL: Record<CatalogStep['kind'], string> = { warmup: 'Warm-up', work: 'Effort', recovery: 'Recovery', cooldown: 'Cool-down', pause: 'Rest' };
const ABOUT_HEADING: Record<CatalogSport, string> = { BIKING: 'How to ride it', RUNNING: 'How to run it', SWIMMING: 'How to swim it' };

export default async function LibraryWorkoutPage({ params, searchParams }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const [{ slug }, { from }] = await Promise.all([params, searchParams]);
  const workout = findCatalogWorkout(workoutCatalog, slug);
  if (!workout) notFound();

  const account = await accountService.getAccount(user.id);
  const performanceProfile = account?.performanceProfile ?? null;
  const ftp = performanceProfile?.cycling.ftpWatts ?? null;
  const metrics = catalogWorkoutMetrics(workout);
  const bike = workout.sport === 'BIKING';
  const steps = expandCatalogItems(workout.items);
  const origin = parseBackOrigin('library-workout', from) ?? 'library';
  const pct = (value: number) => ftp ? `${wattsForPct(value, ftp)}` : `${Math.round(value)}`;
  const pctUnit = ftp ? 'W' : '% FTP';
  const profile = buildWorkoutProfile(catalogWorkoutToEditorBlocks(workout).map((block) => {
    const written = block.target ? formatWorkoutTarget(block.target, workout.sport) : null;
    const resolved = block.target ? formatResolvedWorkoutTarget(block.target, performanceProfile, workout.sport) : null;
    return { ...block, id: block.clientId, targetLabel: [written, resolved].filter(Boolean).join(' – ') || null };
  }), { sport: workout.sport, profile: performanceProfile, ftpWatts: ftp });

  const hardestZone = getTempoZoneMeta(Math.max(...steps.map(catalogStepZone)));
  const block = (step: CatalogStep): WorkoutDetailBlock => {
    if (!bike) {
      const zone = step.kind === 'pause' ? null : getTempoZoneMeta(catalogStepZone(step));
      return {
        label: KIND_LABEL[step.kind],
        note: step.cue ?? null,
        durationSec: step.durationSec,
        distanceM: step.distanceM,
        target: zone?.label ?? null,
        unit: zone?.name ?? null,
        color: zone ? levelColor(catalogStepZone(step) - 0.5) : 'var(--border-strong)',
      };
    }
    const ranged = step.lowPct !== step.highPct;
    const ramp = ranged && (step.kind === 'warmup' || step.kind === 'cooldown');
    const [start, end] = step.kind === 'cooldown' ? [step.highPct, step.lowPct] : [step.lowPct, step.highPct];
    return {
      label: KIND_LABEL[step.kind],
      note: [step.cue, step.cadence ? `${step.cadence[0]}–${step.cadence[1]} rpm` : null].filter(Boolean).join(' – ') || null,
      durationSec: step.durationSec,
      target: ramp ? `${pct(start)} → ${pct(end)}` : ranged ? `${pct(step.lowPct)}–${pct(step.highPct)}` : pct(step.lowPct),
      unit: pctUnit,
      color: pctColor((step.lowPct + step.highPct) / 2),
    };
  };

  return (
    <WorkoutDetail
      back={backToLibrarySport(resolveBackTarget({ route: 'library-workout', from }), workout.sport)}
      title={workout.name}
      description={workout.summary}
      badges={[{ label: catalogSportLabel(workout.sport), tone: 'brand' }, { label: categoryLabel(workout.category) }, { label: levelLabel(workout.level) }]}
      durationSec={metrics.durationSec}
      actions={<LibraryWorkoutActions slug={workout.slug} name={workout.name} sport={workout.sport} durationSec={metrics.durationSec} hasSteps={steps.length > 0} from={origin} />}
      profile={profile}
      profileNote={bike ? <FtpProfileNote ftpWatts={ftp} /> : 'Height shows each block’s zone.'}
      profileLabel={`${workout.name} intensity profile: ${formatDuration(metrics.durationSec)}, ${steps.length} ${steps.length === 1 ? 'block' : 'blocks'}${bike ? `, peak ${Math.round(metrics.maxPct)}% of FTP` : ''}. Every block is listed under Blocks below.`}
      ftpWatts={bike ? ftp : null}
      about={{ heading: ABOUT_HEADING[workout.sport], paragraphs: workout.description.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) }}
      items={workout.items.map((item) => isCatalogRepeat(item) ? { repeat: item.repeat, blocks: item.steps.map(block) } : { repeat: null, blocks: [block(item)] })}
      itemsSummary={`${metrics.intervalCount}\u00A0${metrics.intervalCount === 1 ? 'effort' : 'efforts'}\u00A0– ${metrics.distanceM ? 'est.\u00A0' : ''}${formatDuration(metrics.workSec)}\u00A0of work`}
      stats={[
        { label: metrics.distanceM ? 'Duration, est.' : 'Duration', value: formatDuration(metrics.durationSec) },
        { label: 'Training load', value: String(metrics.tss), unit: 'TSS' },
        ...(metrics.distanceM ? [{ label: 'Main set', value: formatMeters(metrics.distanceM) }] : []),
        ...(bike ? [
          { label: 'Intensity factor', value: metrics.intensityFactor.toFixed(2), unit: 'IF' },
          { label: 'Normalized power, est.', value: pct(metrics.npPct), unit: pctUnit },
          { label: 'Peak target', value: pct(metrics.maxPct), unit: pctUnit },
        ] : [{ label: 'Hardest zone', value: hardestZone.label, unit: hardestZone.name }]),
      ]}
      zoneSec={metrics.zoneSec}
      usedIn={plansWithWorkout(workout.slug).map((plan) => ({ label: plan.name, href: `/athlete/templates?plan=${plan.slug}#plan-${plan.slug}` }))}
      tags={workout.tags.map((tag) => ({ label: tag, href: publicLibraryHref({ ...EMPTY_CATALOG_QUERY, sport: workout.sport, tags: [tag] }) }))}
    />
  );
}
