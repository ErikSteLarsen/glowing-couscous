import { notFound, redirect } from 'next/navigation';
import { format, startOfWeek } from 'date-fns';
import { ActionLink, EmptyState, PageShell, Surface, TopBar, sectionHeadingClassName } from '@/components/ui';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { SessionWorkoutOverview } from '@/components/SessionWorkoutOverview';
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

  const importedWithoutWorkout = detail.session.importedActivityId !== null && detail.session.blocks.length === 0;
  const scoreDurationSec = importedWithoutWorkout
    ? detail.session.recordedDurationSec ?? detail.session.durationSec
    : detail.session.durationSec;
  const sessionAction = importedWithoutWorkout
    ? 'View activity data'
    : detail.session.status === 'completed' ? 'Review outcome' : 'Start live';
  const sessionActionHref = importedWithoutWorkout
    ? '#recorded-activity'
    : detail.session.status === 'completed'
      ? '#session-outcome'
      : `/athlete/live/${detail.session.id}?from=${sessionOrigin}`;

  const overviewHeader = (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-4">
      <div>
        <h2 className={sectionHeadingClassName}>{importedWithoutWorkout ? 'Activity overview' : 'Workout overview'}</h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          {importedWithoutWorkout
            ? 'Imported activity · no planned workout matched'
            : 'The structure of your scheduled workout.'}
        </p>
      </div>
      <div className={importedWithoutWorkout
        ? 'grid w-full grid-cols-2 divide-x divide-[var(--border)] border-y border-[var(--border)] sm:w-auto sm:min-w-[20rem]'
        : 'flex flex-wrap gap-x-6 gap-y-2'}
      >
        <div className={importedWithoutWorkout ? 'py-3 pr-4 sm:pr-6' : ''}>
          <p className="text-[11px] font-medium text-[var(--text-muted)]">{importedWithoutWorkout ? 'Duration' : 'Planned time'}</p>
          <p className="metric-text mt-1 text-[20px] font-semibold text-[var(--text)]">{formatDurationExact(scoreDurationSec)}</p>
        </div>
        <div className={importedWithoutWorkout ? 'py-3 pl-4 sm:pl-6' : ''}>
          <p className="text-[11px] font-medium text-[var(--text-muted)]">Training load</p>
          <p className="metric-text mt-1 text-[20px] font-semibold text-[var(--text)]">{detail.session.loadAvailable === false ? 'Unavailable' : `${detail.session.tss} TSS`}</p>
        </div>
      </div>
    </div>
  );

  return (
    <PageShell>
      <TopBar
        title={detail.session.title}
        description={detail.session.summary ?? (importedWithoutWorkout ? 'Imported activity.' : 'Session details.')}
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
          {!importedWithoutWorkout ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Week of {format(startOfWeek(detail.session.date, { weekStartsOn: 1 }), 'd MMM')}</span>
            </>
          ) : null}
          <StatusBadge status={detail.session.status} />
        </div>

        <div className={`grid items-start gap-5 ${importedWithoutWorkout ? '' : 'xl:grid-cols-[minmax(0,1fr)_304px]'}`}>
          <div className="min-w-0 space-y-5">
            {importedWithoutWorkout ? <Surface className="space-y-4">{overviewHeader}</Surface>
              : <SessionWorkoutOverview blocks={detail.session.blocks} header={overviewHeader} />}

            {detail.session.importedActivityId ? (
              <Surface id="recorded-activity" className="space-y-4">
                <div>
                  <h2 className={sectionHeadingClassName}>{importedWithoutWorkout ? 'Activity data' : 'Recorded activity'}</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                    {importedWithoutWorkout
                      ? 'Charts show the measurements saved with this activity.'
                      : 'Compare recorded measurements with the scheduled workout blocks above.'}
                  </p>
                </div>
                <ImportedActivityMeasurements
                  activityId={detail.session.importedActivityId}
                  durationSec={detail.session.recordedDurationSec ?? detail.session.durationSec}
                  sport={detail.session.sport}
                />
              </Surface>
            ) : null}

            {importedWithoutWorkout ? (
              <SessionDetailClient
                sessionId={detail.session.id}
                isDone={detail.session.status === 'completed'}
                notes={detail.session.notes}
                compliancePct={detail.session.compliancePct}
                isImportedWithoutWorkout
              />
            ) : null}
          </div>

          {!importedWithoutWorkout ? <aside className="space-y-4">
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
          </aside> : null}
        </div>
      </div>
    </PageShell>
  );
}
