import { notFound, redirect } from 'next/navigation';
import { format, startOfWeek } from 'date-fns';
import { EmptyState, PageShell, secondaryButtonClassName, Surface, TopBar } from '@/components/ui';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { parseBackOrigin, resolveBackTarget } from '@/lib/app-navigation';
import { accountService } from '@/lib/account-service';
import { createExecutionSteps } from '@/lib/athlete-execution';
import { formatSessionWhen } from '@/lib/session-display';
import { LiveSessionClient } from './LiveSessionClient';
import { canStartWorkout } from '@/lib/workout-start';
import { buildWorkoutProfile } from '@/lib/workout-profile';
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

  const [detail, account] = await Promise.all([athleteService.loadSessionDetail(user.id, parsedSessionId), accountService.getAccount(user.id)]);
  if (!detail) {
    return (
      <PageShell size="wide">
        <EmptyState title="Can’t open this workout" description="This workout could not be loaded." />
      </PageShell>
    );
  }

  const sessionOrigin = parseBackOrigin('session-live', from);
  const back = resolveBackTarget({ route: 'session-live', sessionId: detail.session.id, from });
  if (detail.session.status === 'skipped') {
    return (
      <PageShell size="wide">
        <TopBar back={back} title={`Follow along: ${detail.session.title}`} />
        <EmptyState
          title="Workout skipped"
          description="Choose Plan again on the workout page before you start it."
        />
      </PageShell>
    );
  }
  const { id, title, sport, status, durationSec } = detail.session;
  const steps = createExecutionSteps(detail.session.editor.blocks, sport, account?.performanceProfile);
  const workout = { title, sport, status, durationSec, hasSteps: steps.length > 0 };
  const ftpWatts = account?.performanceProfile.cycling.ftpWatts ?? null;
  const profile = buildWorkoutProfile(
    detail.session.editor.blocks.map((block) => ({ ...block, id: block.clientId })),
    { sport, profile: account?.performanceProfile ?? null, ftpWatts },
  );
  if (status !== 'completed' && !canStartWorkout(workout)) {
    return (
      <PageShell size="wide">
        <TopBar back={back} title={title} />
        <EmptyState title="No workout blocks" description="Open the workout page to check the plan." />
      </PageShell>
    );
  }

  return (
    <PageShell size="wide">
      <TopBar
        back={back}
        title={`Follow along: ${detail.session.title}`}
        actions={detail.session.sport === 'BIKING' ? (
          <WorkoutStartChooser
            workout={workout}
            source={{ kind: 'session', id, from: sessionOrigin, liveSteps: steps }}
            triggerClassName={`${secondaryButtonClassName} max-md:min-h-11`}
          />
        ) : undefined}
      />

      <div className="flex flex-wrap items-center gap-3 border-y border-[var(--border)] py-3 text-[13px] text-[var(--text-secondary)]">
        <span>Week of {format(startOfWeek(detail.session.date, { weekStartsOn: 1 }), 'd\u00A0MMM')}</span>
        <span>{formatSessionWhen(detail.session.date, detail.session.timeLabel)}</span>
        <StatusBadge status={detail.session.status} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Surface className="space-y-4">
          <LiveSessionClient sessionId={detail.session.id} blocks={steps} isDone={detail.session.status === 'completed'} profile={profile} ftpWatts={ftpWatts} title={title} />
        </Surface>

        <div className="space-y-4">
          <Surface>
            <p className="text-xs font-medium text-[var(--text-muted)]">Total time</p>
            <p className="mt-3 text-[20px] font-semibold text-[var(--text)]">{formatDuration(detail.session.durationSec)}</p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{steps.length} {steps.length === 1 ? 'block' : 'blocks'}</p>
          </Surface>
          <Surface>
            <p className="text-xs font-medium text-[var(--text-muted)]">How to do it</p>
            <p className="mt-3 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
              Follow each block and its target.
            </p>
          </Surface>
        </div>
      </div>
    </PageShell>
  );
}
