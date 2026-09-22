import { notFound, redirect } from 'next/navigation';
import { format, startOfWeek } from 'date-fns';
import { ActionLink, EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { getSessionOrigin } from '@/lib/app-navigation';
import { LiveSessionClient } from './LiveSessionClient';

export default async function AthleteLivePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const { sessionId } = await params;
  const { from } = await searchParams;
  const parsedSessionId = Number(sessionId);
  if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
    notFound();
  }

  const detail = await athleteService.loadSessionDetail(user.id, parsedSessionId);
  if (!detail) {
    return (
      <PageShell>
        <TopBar title="Live session" />
        <EmptyState title="Live session unavailable" description="This session could not be loaded for live execution." />
      </PageShell>
    );
  }

  const sessionOrigin = getSessionOrigin(from);

  return (
    <PageShell>
      <TopBar
        title={`Execute ${detail.session.title}`}
        actions={<ActionLink href={`/athlete/session/${detail.session.id}?from=${sessionOrigin}`} tone="secondary">Back to session</ActionLink>}
      />

      <div className="flex flex-wrap items-center gap-3 border-y border-[var(--border)] py-3 text-[13px] text-[var(--text-secondary)]">
        <span>Week of {format(startOfWeek(detail.session.date, { weekStartsOn: 1 }), 'd MMM')}</span>
        <span aria-hidden="true">·</span>
        <span>{format(detail.session.date, 'EEE d MMM · HH:mm')}</span>
        <StatusBadge status={detail.session.status} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Surface className="space-y-4">
          <SessionBlockBar segments={detail.session.segments} />
          <LiveSessionClient sessionId={detail.session.id} blocks={detail.session.blocks} />
        </Surface>

        <div className="space-y-4">
          <Surface>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Session total</p>
            <p className="mt-3 text-[20px] font-semibold text-[var(--text)]">{formatDuration(detail.session.durationSec)}</p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{detail.session.blocks.length} blocks</p>
          </Surface>
          <Surface>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Coach cue</p>
            <p className="mt-3 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
              Follow targets and steps.
            </p>
          </Surface>
        </div>
      </div>
    </PageShell>
  );
}
