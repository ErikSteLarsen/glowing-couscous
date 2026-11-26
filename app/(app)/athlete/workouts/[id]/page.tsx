import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { MyWorkoutActions } from '@/components/library/MyWorkoutActions';
import { FtpProfileNote, WorkoutDetail } from '@/components/library/WorkoutDetail';
import { accountService } from '@/lib/account-service';
import { myWorkoutsHref } from '@/lib/athlete-workouts-navigation';
import { getCurrentUser } from '@/lib/auth-session';
import { formatDuration } from '@/lib/format-duration';
import { ownedWorkoutDetailItems, summarizeOwnedWorkout } from '@/lib/owned-workout-summary';
import { parsePositiveInteger } from '@/lib/route-params';
import { getSportLabel } from '@/lib/sport';
import { getTempoZoneMeta } from '@/lib/tempo-blocks';
import { wattsForPct } from '@/lib/workout-catalog/metrics';
import { workoutLibraryService } from '@/lib/workout-library-service';

type Params = { params: Promise<{ id: string }> };

async function loadWorkout(id: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');
  const workoutId = parsePositiveInteger(id);
  const workout = workoutId === null ? null : await workoutLibraryService.getForOwner('athlete', user.id, workoutId);
  return { user, workout };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { workout } = await loadWorkout((await params).id);
  return { title: workout ? workout.title : 'My workouts' };
}

/** A saved workout, in the same layout as a public library workout, with Edit instead of Customize. */
export default async function MyWorkoutPage({ params }: Params) {
  const { user, workout } = await loadWorkout((await params).id);
  if (!workout) notFound();

  const account = await accountService.getAccount(user.id);
  const performanceProfile = account?.performanceProfile ?? null;
  const ftp = performanceProfile?.cycling.ftpWatts ?? null;
  const summary = summarizeOwnedWorkout(workout, performanceProfile);
  const power = summary.axis === 'power';
  const pct = (value: number) => ftp ? `${wattsForPct(value, ftp)}` : `${Math.round(value)}`;
  const pctUnit = ftp ? 'W' : '% FTP';
  const peakZone = summary.peakZone ? getTempoZoneMeta(summary.peakZone) : null;
  const blocks = summary.profile.steps.length;

  return (
    <WorkoutDetail
      back={{ href: myWorkoutsHref(workout.sport), destination: 'Workouts', label: 'Back to Workouts' }}
      title={workout.title}
      description={summary.lead}
      badges={[{ label: getSportLabel(workout.sport), tone: 'brand' }, ...(peakZone ? [{ label: peakZone.name }] : [])]}
      durationSec={summary.durationSec}
      actions={<MyWorkoutActions id={workout.id} name={workout.title} sport={workout.sport} durationSec={summary.durationSec} hasSteps={blocks > 0} />}
      profile={summary.profile}
      profileNote={power ? <FtpProfileNote ftpWatts={ftp} /> : 'Height shows each block’s zone.'}
      profileLabel={`${workout.title} intensity profile: ${formatDuration(summary.durationSec)}, ${blocks} blocks${power ? `, peak ${Math.round(summary.maxPct)}% of FTP` : ''}. Every block is listed under Blocks below.`}
      ftpWatts={ftp}
      about={{ heading: 'Notes', paragraphs: summary.details }}
      items={ownedWorkoutDetailItems(summary.profile, ftp)}
      itemsSummary={`${summary.effortCount} ${summary.effortCount === 1 ? 'effort' : 'efforts'} – ${formatDuration(summary.workSec)} of work`}
      stats={[
        { label: 'Duration', value: formatDuration(summary.durationSec) },
        { label: 'Training load', value: String(summary.tss), unit: 'TSS' },
        ...(power && summary.intensityFactor !== null && summary.npPct !== null ? [
          { label: 'Intensity factor', value: summary.intensityFactor.toFixed(2), unit: 'IF' },
          { label: 'Normalized power, est.', value: pct(summary.npPct), unit: pctUnit },
          { label: 'Peak target', value: pct(summary.maxPct), unit: pctUnit },
        ] : peakZone ? [{ label: 'Hardest zone', value: peakZone.label, unit: peakZone.name }] : []),
      ]}
      zoneSec={summary.zoneSec}
    />
  );
}
