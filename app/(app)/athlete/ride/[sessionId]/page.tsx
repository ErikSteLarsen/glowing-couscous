import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { UnsavedRidesNotice } from '@/components/UnsavedRidesNotice';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { accountService } from '@/lib/account-service';
import { createExecutionSteps } from '@/lib/athlete-execution';
import { getSessionOrigin } from '@/lib/app-navigation';
import { createRidePlan } from '@/lib/ride/ride-plan';
import { RideClient } from './RideClient';

export const metadata: Metadata = { title: 'Ride' };

export default async function AthleteRidePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { sessionId } = await params;
  const { from } = await searchParams;
  const parsedSessionId = Number(sessionId);
  if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) notFound();

  const [detail, account] = await Promise.all([athleteService.loadSessionDetail(user.id, parsedSessionId), accountService.getAccount(user.id)]);
  if (!detail) {
    return (
      <PageShell size="wide">
        <EmptyState title="Ride unavailable" description="This session could not be loaded." />
      </PageShell>
    );
  }

  const sessionOrigin = getSessionOrigin(from);
  const sessionHref = `/athlete/session/${detail.session.id}?from=${sessionOrigin}`;
  const back = <ActionLink href={sessionHref} tone="secondary">Back to session</ActionLink>;

  if (detail.session.sport !== 'BIKING') {
    return (
      <PageShell size="wide">
        <TopBar title={`Ride ${detail.session.title}`} actions={back} />
        <EmptyState
          title="Trainer rides are for bike sessions"
          description="Use live guidance to follow this workout step by step."
          action={<ActionLink href={`/athlete/live/${detail.session.id}?from=${sessionOrigin}`}>Start live</ActionLink>}
        />
      </PageShell>
    );
  }
  if (detail.session.status === 'skipped' || detail.session.status === 'completed') {
    return (
      <PageShell size="wide">
        <TopBar title={`Ride ${detail.session.title}`} actions={back} />
        <UnsavedRidesNotice closedSessionId={detail.session.id} />
        <EmptyState
          title={detail.session.status === 'skipped' ? 'Session skipped' : 'Session already completed'}
          description={detail.session.status === 'skipped' ? 'Plan this session again before riding it.' : 'This session already has a saved outcome.'}
          action={back}
        />
      </PageShell>
    );
  }

  const profile = account?.performanceProfile;
  const steps = createExecutionSteps(detail.session.editor.blocks, detail.session.sport, profile);
  const plan = createRidePlan(detail.session.editor.blocks, profile);

  return (
    <RideClient
      sessionId={detail.session.id}
      sessionTitle={detail.session.title}
      plan={plan}
      steps={steps}
      backHref={sessionHref}
      heartRateMaxBpm={profile?.heartRateMaxBpm ?? null}
    />
  );
}
