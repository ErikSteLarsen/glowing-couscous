import { notFound, redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, secondaryButtonClassName, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { parseBackOrigin, resolveBackTarget, resolveStartedBackTarget, withBackOrigin } from '@/lib/app-navigation';
import { accountService } from '@/lib/account-service';
import { createExecutionSteps } from '@/lib/athlete-execution';
import { LiveSessionClient } from './LiveSessionClient';
import { canStartWorkout } from '@/lib/workout-start';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';

export default async function AthleteLivePage({
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
  if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
    notFound();
  }

  const [detail, account] = await Promise.all([athleteService.loadSessionDetail(user.id, parsedSessionId, { includeUnsaved: true }), accountService.getAccount(user.id)]);
  if (!detail) {
    return (
      <PageShell size="wide">
        <EmptyState title="Can’t open this workout" description="This workout could not be loaded." />
      </PageShell>
    );
  }

  const sessionOrigin = parseBackOrigin('session-live', from);
  const back = detail.session.unsaved ? resolveStartedBackTarget(from) : resolveBackTarget({ route: 'session-live', sessionId: detail.session.id, from });
  if (detail.session.status === 'skipped') {
    return (
      <PageShell size="wide">
        <TopBar back={back} title={`Block timer: ${detail.session.title}`} />
        <EmptyState
          title="Workout skipped"
          description="Choose Plan again on the workout page before you start it."
        />
      </PageShell>
    );
  }
  const { id, title, sport, status, durationSec } = detail.session;
  if (sport === 'SWIMMING') {
    return (
      <PageShell size="wide">
        <TopBar back={back} title={title} />
        <EmptyState
          title="Swims can’t be started here yet"
          description={status === 'completed' ? 'This swim is already marked done.' : 'Read the blocks on the workout page and mark it done after your swim.'}
          action={<ActionLink href={withBackOrigin(`/athlete/session/${id}`, sessionOrigin)}>Open workout</ActionLink>}
        />
      </PageShell>
    );
  }
  const steps = createExecutionSteps(detail.session.editor.blocks, sport, account?.performanceProfile);
  const workout = { title, sport, status, durationSec, hasSteps: steps.length > 0 };
  if (status !== 'completed' && !canStartWorkout(workout)) {
    return (
      <PageShell size="wide">
        <TopBar back={back} title={title} />
        <EmptyState title="No workout blocks" description="Open the workout page to check the plan." />
      </PageShell>
    );
  }

  return (
    <LiveSessionClient
      sessionId={id}
      blocks={steps}
      isDone={status === 'completed'}
      unsaved={detail.session.unsaved}
      title={title}
      back={back}
      workoutHref={withBackOrigin(`/athlete/session/${id}`, sessionOrigin)}
      actions={sport === 'BIKING' ? (
        <WorkoutStartChooser
          workout={workout}
          source={{ kind: 'session', id, from: sessionOrigin, liveSteps: steps }}
          triggerClassName={`${secondaryButtonClassName} max-md:min-h-11`}
        />
      ) : undefined}
    />
  );
}
