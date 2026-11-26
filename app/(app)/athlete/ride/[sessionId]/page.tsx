import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { UnsavedRidesNotice } from '@/components/UnsavedRidesNotice';
import { getCurrentUser } from '@/lib/auth-session';
import { loginPathFor } from '@/lib/auth-callback';
import { rideSessionPath } from '@/lib/ride/launch';
import { athleteService } from '@/lib/athlete-service';
import { accountService } from '@/lib/account-service';
import { createExecutionSteps } from '@/lib/athlete-execution';
import { parseBackOrigin, resolveBackTarget, withBackOrigin } from '@/lib/app-navigation';
import { createRidePlan } from '@/lib/ride/ride-plan';
import { canStartWorkout } from '@/lib/workout-start';
import { RideClient } from './RideClient';

export const metadata: Metadata = { title: 'Ride' };

export default async function AthleteRidePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { sessionId } = await params;
  const { from } = await searchParams;
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect(loginPathFor(rideSessionPath(Number(sessionId), from)));

  const parsedSessionId = Number(sessionId);
  if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) notFound();

  const [detail, account] = await Promise.all([athleteService.loadSessionDetail(user.id, parsedSessionId), accountService.getAccount(user.id)]);
  if (!detail) {
    return (
      <PageShell size="wide">
        <div className="flex flex-col gap-6">
          <UnsavedRidesNotice userId={user.id} />
          <EmptyState title="Can’t open this ride" description="This workout could not be loaded. It may have been removed from your Calendar." />
        </div>
      </PageShell>
    );
  }

  const back = resolveBackTarget({ route: 'session-ride', sessionId: detail.session.id, from });

  if (detail.session.status === 'skipped' || detail.session.status === 'completed') {
    return (
      <PageShell size="wide">
        <TopBar back={back} title={`Ride ${detail.session.title}`} />
        <UnsavedRidesNotice userId={user.id} />
        <EmptyState
          title={detail.session.status === 'skipped' ? 'Workout skipped' : 'Workout already done'}
          description={detail.session.status === 'skipped' ? 'Choose Plan again on the workout page before you ride it.' : 'This workout already has a saved result.'}
        />
      </PageShell>
    );
  }

  if (detail.session.sport !== 'BIKING') {
    const canFollowAlong = canStartWorkout(detail.session);
    return (
      <PageShell size="wide">
        <TopBar back={back} title={`Ride ${detail.session.title}`} />
        <EmptyState
          title="Trainer rides are for bike workouts"
          description={canFollowAlong ? 'Time this workout block by block.' : 'Open the workout page to check the plan.'}
          action={(
            <ActionLink href={withBackOrigin(`/athlete/${canFollowAlong ? 'live' : 'session'}/${detail.session.id}`, parseBackOrigin('session-live', from))}>
              {canFollowAlong ? 'Use the block timer' : 'Open workout'}
            </ActionLink>
          )}
        />
      </PageShell>
    );
  }

  const profile = account?.performanceProfile;
  const steps = createExecutionSteps(detail.session.editor.blocks, detail.session.sport, profile);
  const plan = createRidePlan(detail.session.editor.blocks, profile);

  return (
    <RideClient
      userId={user.id}
      sessionId={detail.session.id}
      sessionTitle={detail.session.title}
      plan={plan}
      plannedTss={detail.session.plannedTss}
      steps={steps}
      back={back}
      heartRateMaxBpm={profile?.heartRateMaxBpm ?? null}
    />
  );
}
