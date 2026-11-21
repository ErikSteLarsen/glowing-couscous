import { notFound, redirect } from 'next/navigation';
import { format, startOfWeek } from 'date-fns';
import { ActionLink, EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { parseBackOrigin, resolveBackTarget } from '@/lib/app-navigation';
import { accountService } from '@/lib/account-service';
import { createExecutionSteps } from '@/lib/athlete-execution';
import { formatSessionWhen } from '@/lib/session-display';
import { LiveSessionClient } from './LiveSessionClient';
import { RideEntryLinks } from '@/components/RideEntryLinks';

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
        <EmptyState title="Live session unavailable" description="This session could not be loaded for live execution." />
      </PageShell>
    );
  }

  const sessionOrigin = parseBackOrigin('session-live', from);
  const back = resolveBackTarget({ route: 'session-live', sessionId: detail.session.id, from });
  if (detail.session.status === 'skipped') {
    return (
      <PageShell size="wide">
        <TopBar back={back} title={`Execute ${detail.session.title}`} />
        <EmptyState
          title="Session skipped"
          description="Plan this session again before running it live."
        />
      </PageShell>
    );
  }
  const steps = createExecutionSteps(detail.session.editor.blocks, detail.session.sport, account?.performanceProfile);

  return (
    <PageShell size="wide">
      <TopBar
        back={back}
        title={`Execute ${detail.session.title}`}
        actions={detail.session.sport === 'BIKING' && detail.session.status !== 'completed' ? <RideEntryLinks sessionId={detail.session.id} from={sessionOrigin ?? undefined} /> : undefined}
      />

      <div className="flex flex-wrap items-center gap-3 border-y border-[var(--border)] py-3 text-[13px] text-[var(--text-secondary)]">
        <span>Week of {format(startOfWeek(detail.session.date, { weekStartsOn: 1 }), 'd MMM')}</span>
        <span aria-hidden="true">·</span>
        <span>{formatSessionWhen(detail.session.date, detail.session.timeLabel)}</span>
        <StatusBadge status={detail.session.status} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Surface className="space-y-4">
          <SessionBlockBar segments={detail.session.segments} />
          <LiveSessionClient sessionId={detail.session.id} blocks={steps} isDone={detail.session.status === 'completed'} />
        </Surface>

        <div className="space-y-4">
          <Surface>
            <p className="text-xs font-medium text-[var(--text-muted)]">Session total</p>
            <p className="mt-3 text-[20px] font-semibold text-[var(--text)]">{formatDuration(detail.session.durationSec)}</p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{steps.length} steps</p>
          </Surface>
          <Surface>
            <p className="text-xs font-medium text-[var(--text-muted)]">Coach cue</p>
            <p className="mt-3 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
              Follow targets and steps.
            </p>
          </Surface>
        </div>
      </div>
    </PageShell>
  );
}
