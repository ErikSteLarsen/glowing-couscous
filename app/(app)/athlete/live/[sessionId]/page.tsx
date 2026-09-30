import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { EmptyState, PageShell, TopBar } from '@/components/ui';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { getSessionOrigin, getSessionReturnTarget } from '@/lib/app-navigation';
import { getSportLabel } from '@/lib/sport';
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

  const sessionOrigin = getSessionOrigin(from);
  const returnTarget = getSessionReturnTarget(sessionOrigin);
  const detail = await athleteService.loadSessionDetail(user.id, parsedSessionId);
  if (!detail) {
    return (
      <PageShell>
        <TopBar title="Live session" back={returnTarget} />
        <EmptyState title="Live session unavailable" description="This session could not be loaded for live execution." />
      </PageShell>
    );
  }

  const sessionHref = `/athlete/session/${detail.session.id}?from=${sessionOrigin}`;

  return (
    <PageShell>
      <TopBar
        title={detail.session.title}
        back={{ href: sessionHref, label: 'Back to session details' }}
      />

      <div className="page-content--standard flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-[var(--border)] py-3 text-[13px] text-[var(--text-secondary)]">
        <span>{format(detail.session.date, 'EEE d MMM · HH:mm')}</span>
        <span aria-hidden="true">·</span>
        <span>{getSportLabel(detail.session.sport)}</span>
        <StatusBadge status={detail.session.status} />
      </div>

      <LiveSessionClient
        ownerId={user.id}
        sessionId={detail.session.id}
        sessionHref={sessionHref}
        blocks={detail.session.blocks}
        initialNotes={detail.session.notes}
        alreadyCompleted={detail.session.status === 'completed'}
      />
    </PageShell>
  );
}
