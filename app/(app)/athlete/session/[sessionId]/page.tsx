import { notFound, redirect } from 'next/navigation';
import { format, startOfWeek } from 'date-fns';
import { ActionLink, EmptyState, PageShell, Surface, TopBar, sectionHeadingClassName } from '@/components/ui';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getSessionBlockStyle, SessionPlanCanvas } from '@/components/SessionPlanCanvas';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDurationExact } from '@/lib/format-duration';
import { getSessionOrigin, getSessionReturnTarget } from '@/lib/app-navigation';
import { SessionDetailClient } from './SessionDetailClient';
import { ShareLinkButton } from '@/components/ShareLinkButton';
import { getSportLabel } from '@/lib/sport';
import { ImportedActivityMeasurements } from '@/components/ImportedActivityMeasurements';

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

  const sessionOrigin = getSessionOrigin(from);
  const returnTarget = getSessionReturnTarget(sessionOrigin);
  const detail = await athleteService.loadSessionDetail(user.id, parsedSessionId);
  if (!detail) {
    return (
      <PageShell>
        <TopBar title="Session" back={returnTarget} />
        <EmptyState title="Session not found" description="This session is unavailable or belongs to another athlete." />
      </PageShell>
    );
  }

  const sessionAction = detail.session.status === 'completed' ? 'Review outcome' : 'Start live';
  const sessionActionHref = detail.session.status === 'completed'
    ? '#session-outcome'
    : `/athlete/live/${detail.session.id}?from=${sessionOrigin}`;

  return (
    <PageShell>
      <TopBar
        title={detail.session.title}
        description={detail.session.summary ?? 'Session details.'}
        back={returnTarget}
        actions={
          <>
            <ActionLink href={sessionActionHref}>{sessionAction}</ActionLink>
          </>
        }
      />

      <div className="page-content--standard space-y-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-[var(--border)] py-3 text-[13px] text-[var(--text-secondary)]">
          <span>{getSportLabel(detail.session.sport)}</span>
          <span aria-hidden="true">·</span>
          <span>{format(detail.session.date, 'EEE d MMM · HH:mm')}</span>
          <span aria-hidden="true">·</span>
          <span>Week of {format(startOfWeek(detail.session.date, { weekStartsOn: 1 }), 'd MMM')}</span>
          <StatusBadge status={detail.session.status} />
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_304px]">
          <div className="min-w-0 space-y-5">
            <Surface className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <h2 className={sectionHeadingClassName}>Session score</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">The full workout in its planned order.</p>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <div>
                    <p className="text-[11px] font-medium text-[var(--text-muted)]">Planned time</p>
                    <p className="metric-text mt-1 text-[20px] font-semibold text-[var(--text)]">{formatDurationExact(detail.session.durationSec)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[var(--text-muted)]">Training load</p>
                    <p className="metric-text mt-1 text-[20px] font-semibold text-[var(--text)]">{detail.session.loadAvailable === false ? 'Unavailable' : `${detail.session.tss} TSS`}</p>
                  </div>
                </div>
              </div>
              <SessionPlanCanvas blocks={detail.session.blocks} />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--border)] pt-4 text-[12px] text-[var(--text-secondary)]">
                <span>Targets are shown with each block.</span>
                {detail.session.metricsSource === 'manual-planned' ? <span>Planned estimate</span> : null}
                <span>{detail.session.blocks.length} blocks in this session</span>
              </div>
            </Surface>

            <Surface className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className={sectionHeadingClassName}>Workout blocks</h2>
                <span className="text-[12px] text-[var(--text-secondary)]">Read-only scheduled copy</span>
              </div>
              {detail.session.blocks.length ? (
                <ol className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {detail.session.blocks.map((block, index) => (
                    <li key={block.id} className={`flex min-w-0 gap-3 py-4 ${block.skipped ? 'opacity-70' : ''}`}>
                      <span className="metric-text min-w-6 pt-1 text-[12px] text-[var(--text-muted)]">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span
                            className="inline-flex min-h-7 items-center rounded-full px-3 text-[12px] font-semibold"
                            style={getSessionBlockStyle(block)}
                          >
                            {block.label}
                          </span>
                          <span className="metric-text text-[13px] font-semibold text-[var(--text)]">
                            {formatDurationExact(block.durationSec * (block.reps ?? 1))}
                          </span>
                          {block.reps ? <span className="text-[12px] text-[var(--text-secondary)]">{formatDurationExact(block.durationSec)} × {block.reps} reps</span> : null}
                          {block.skipped ? <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">Skipped in plan</span> : null}
                        </div>
                        {block.targetLabel ? <p className="mt-2 text-[13px] font-medium text-[var(--text-secondary)]">Target · {block.targetLabel}</p> : null}
                        {block.note ? <p className="mt-2 max-w-[68ch] text-[13px] leading-[1.5] text-[var(--text)]">{block.note}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="border-y border-[var(--border)] py-5 text-[13px] text-[var(--text-secondary)]">This session has no workout blocks.</p>
              )}
            </Surface>

            {detail.session.importedActivityId ? (
              <Surface className="space-y-4">
                <div>
                  <h2 className={sectionHeadingClassName}>Recorded activity</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Recorded sensor measurements are shown here; the scheduled workout blocks are listed above.</p>
                </div>
                <ImportedActivityMeasurements
                  activityId={detail.session.importedActivityId}
                  durationSec={detail.session.recordedDurationSec ?? detail.session.durationSec}
                  sport={detail.session.sport}
                />
              </Surface>
            ) : null}
          </div>

          <aside className="space-y-4">
            <Surface className="space-y-3">
              <h2 className={sectionHeadingClassName}>Session context</h2>
              <p className="text-[13px] leading-[1.5] text-[var(--text-secondary)]">
                {detail.session.summary || 'Follow the block targets and move through the workout at your own pace.'}
              </p>
              <div className="border-t border-[var(--border)] pt-3 text-[12px] leading-[1.5] text-[var(--text-secondary)]">
                {detail.session.status === 'completed'
                  ? 'This session is complete. Its planned structure is shown alongside the saved outcome.'
                  : 'Starting live opens a local timer. You can pause, move between blocks, and finish when you are ready.'}
              </div>
            </Surface>

            {detail.session.sourceWorkout ? (
              <Surface className="space-y-3">
                <div>
                  <h2 className={sectionHeadingClassName}>Reusable workout</h2>
                  <p className="mt-1 break-words text-[13px] font-medium text-[var(--text)]">{detail.session.sourceWorkout.title}</p>
                </div>
                <p className="text-[12px] leading-[1.5] text-[var(--text-secondary)]">
                  Editing the source will not change this scheduled copy.
                </p>
                <ActionLink href={`/athlete/workouts?edit=${detail.session.sourceWorkout.id}`} tone="secondary">
                  Edit source workout
                </ActionLink>
              </Surface>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 px-1">
              <ShareLinkButton sourceKind="session" sourceId={detail.session.id} />
            </div>

            <SessionDetailClient
              sessionId={detail.session.id}
              isDone={detail.session.status === 'completed'}
              notes={detail.session.notes}
              compliancePct={detail.session.compliancePct}
            />
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
