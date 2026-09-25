import { notFound, redirect } from 'next/navigation';
import { format, startOfWeek } from 'date-fns';
import { ActionLink, EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration, formatDurationExact } from '@/lib/format-duration';
import { getSessionOrigin, getSessionReturnTarget } from '@/lib/app-navigation';
import { SessionDetailClient } from './SessionDetailClient';
import { ShareLinkButton } from '@/components/ShareLinkButton';
import { accountService } from '@/lib/account-service';

export default async function AthleteSessionPage({
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

  const [detail, account] = await Promise.all([athleteService.loadSessionDetail(user.id, parsedSessionId), accountService.getAccount(user.id)]);
  if (!detail) {
    return (
      <PageShell>
        <TopBar title="Session" />
        <EmptyState title="Session not found" description="This session is unavailable or belongs to another athlete." />
      </PageShell>
    );
  }

  const sessionOrigin = getSessionOrigin(from);
  const returnTarget = getSessionReturnTarget(sessionOrigin);
  const sessionAction = detail.session.status === 'completed' ? 'Review outcome' : detail.session.status === 'missed' ? 'Review session' : 'Start live';
  const sessionActionHref = detail.session.status === 'completed' || detail.session.status === 'missed'
    ? '#session-outcome'
    : `/athlete/live/${detail.session.id}?from=${sessionOrigin}`;

  return (
    <PageShell>
      <TopBar
        title={detail.session.title}
        description={detail.session.summary ?? 'Session details.'}
        actions={
          <>
            <ActionLink href={returnTarget.href} tone="secondary">
              {returnTarget.label}
            </ActionLink>
            <ActionLink href={sessionActionHref}>{sessionAction}</ActionLink>
            <ShareLinkButton sourceKind="session" sourceId={detail.session.id} />
          </>
        }
      />

      <div className="page-content--standard flex flex-wrap items-center gap-3 border-y border-[var(--border)] py-3 text-[13px] text-[var(--text-secondary)]">
        <span>Week of {format(startOfWeek(detail.session.date, { weekStartsOn: 1 }), 'd MMM')}</span>
        <span aria-hidden="true">·</span>
        <span>{format(detail.session.date, 'EEE d MMM · HH:mm')}</span>
        <StatusBadge status={detail.session.status} />
      </div>

      <div className="page-content--standard grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Surface className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={detail.session.status} />
              <MetricText>{formatDuration(detail.session.durationSec)}</MetricText>
              <MetricText>{detail.session.tss} TSS</MetricText>
              {detail.session.metricsSource === 'manual-planned' ? (
                <span className="text-[12px] text-[var(--text-secondary)]">Planned estimate</span>
              ) : null}
              {detail.session.targetLabel ? <span className="text-[13px] text-[var(--text-secondary)]">{detail.session.targetLabel}</span> : null}
            </div>
            <SessionBlockBar segments={detail.session.segments} />
          </Surface>

          <Surface className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Blocks
            </p>
            {detail.session.blocks.map((block) => (
              <div key={block.id} className="rounded-[10px] border border-[var(--border)] bg-[var(--field-surface)] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex min-h-7 items-center rounded-full px-3 text-[12px] font-semibold"
                    style={{ backgroundColor: block.tint, color: block.color }}
                  >
                    {block.label}
                  </span>
                  <MetricText>{formatDurationExact(block.durationSec)}</MetricText>
                  {block.reps ? <MetricText>{block.reps} reps</MetricText> : null}
                  {block.targetLabel ? <span className="text-[12px] text-[var(--text-secondary)]">{block.targetLabel}</span> : null}
                </div>
                {block.note ? <p className="mt-3 text-[13px] leading-[1.5] text-[var(--text)]">{block.note}</p> : null}
              </div>
            ))}
          </Surface>
        </div>

        <div className="space-y-4">
          <SessionDetailClient
              id="session-outcome"
            sessionId={detail.session.id}
            initialDone={detail.session.status === 'completed'}
            initialNotes={detail.session.notes}
            initialDraft={detail.session.editor}
            performanceProfile={account?.performanceProfile}
          />
        </div>
      </div>
    </PageShell>
  );
}
