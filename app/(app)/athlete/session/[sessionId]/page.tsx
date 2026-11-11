import { notFound, redirect } from 'next/navigation';
import { format, startOfWeek } from 'date-fns';
import { ActionLink, EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { formatDistance } from '@/lib/format-distance';
import { formatTcxDateTime } from '@/lib/tcx-time';
import { getSessionOrigin, getSessionReturnTarget } from '@/lib/app-navigation';
import { SessionDetailClient } from './SessionDetailClient';
import { SessionStatusControl } from './SessionStatusControl';
import { ManualActivityCorrectionForm, type ManualActivityCorrectionDraft } from './ManualActivityCorrectionForm';
import { ShareLinkButton } from '@/components/ShareLinkButton';
import { accountService } from '@/lib/account-service';
import { formatSessionWhen } from '@/lib/session-display';
import { toDayKey } from '@/lib/training-load';
import { SessionRescheduleAction } from '@/components/SessionRescheduleAction';
import { ImportedActivityMeasurements } from '@/components/ImportedActivityMeasurements';

export default async function AthleteSessionPage({
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
        <EmptyState title="Session not found" description="This session is unavailable or belongs to another athlete." />
      </PageShell>
    );
  }

  const sessionOrigin = getSessionOrigin(from);
  const returnTarget = getSessionReturnTarget(sessionOrigin);
  const isOverdue = detail.session.isOverdue;
  const displayStatus = isOverdue ? 'missed' : detail.session.status;
  const isSkipped = detail.session.status === 'skipped';
  const sessionAction = detail.session.status === 'completed' ? 'Review outcome' : 'Start live';
  const sessionActionHref = detail.session.status === 'completed'
    ? '#session-outcome'
    : `/athlete/live/${detail.session.id}?from=${sessionOrigin}`;
  const manualCorrectionDraft: ManualActivityCorrectionDraft | null = detail.session.metricsSource === 'manual-unplanned'
    ? {
        kind: 'manual-unplanned',
        title: detail.session.title,
        sport: detail.session.sport,
        completedOn: detail.session.activityCompletedAt?.toISOString().slice(0, 10) ?? detail.session.date.toISOString().slice(0, 10),
        durationMinutes: String(Math.round((detail.session.activityDurationSec ?? 0) / 60)),
        distanceKm: detail.session.activityDistanceMeters === null ? '' : (detail.session.activityDistanceMeters / 1000).toFixed(3),
        rpe: detail.session.activityRpe === null ? '' : String(detail.session.activityRpe),
        notes: detail.session.activityNotes ?? '',
      }
    : detail.session.metricsSource === 'manual-paired'
      ? {
          kind: 'manual-paired',
          plannedTitle: detail.session.title,
          plannedDate: detail.session.date.toISOString().slice(0, 10),
          durationMinutes: String(Math.round((detail.session.activityDurationSec ?? 0) / 60)),
          distanceKm: detail.session.activityDistanceMeters === null ? '' : (detail.session.activityDistanceMeters / 1000).toFixed(3),
          rpe: detail.session.activityRpe === null ? '' : String(detail.session.activityRpe),
          notes: detail.session.activityNotes ?? '',
        }
      : null;

  return (
    <PageShell size="wide">
      <TopBar
        title={detail.session.title}
        description={detail.session.summary ?? 'Session details.'}
        actions={
          <>
            <ActionLink href={returnTarget.href} tone="secondary">
              {returnTarget.label}
            </ActionLink>
            {isSkipped ? null : <ActionLink href={sessionActionHref}>{sessionAction}</ActionLink>}
            {isOverdue ? (
              <SessionRescheduleAction
                mode="dialog"
                sessionId={detail.session.id}
                title={detail.session.title}
                currentDay={toDayKey(detail.session.date)}
                today={toDayKey(new Date())}
              />
            ) : null}
            {['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'].includes(detail.session.metricsSource ?? '') ? null : <ShareLinkButton sourceKind="session" sourceId={detail.session.id} />}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 border-y border-[var(--border)] py-3 text-[13px] text-[var(--text-secondary)]">
        <span>Week of {format(startOfWeek(detail.session.date, { weekStartsOn: 1 }), 'd MMM')}</span>
        <span aria-hidden="true">·</span>
        <span>{formatSessionWhen(detail.session.date, detail.session.timeLabel)}</span>
        <StatusBadge status={displayStatus} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Surface className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={displayStatus} />
              <MetricText>{formatDuration(detail.session.durationSec)}</MetricText>
              <MetricText>{detail.session.tss === null ? 'Load unavailable' : `${detail.session.tss} TSS`}</MetricText>
              {detail.session.metricsSource === 'manual-planned' ? (
                <span className="text-[12px] text-[var(--text-secondary)]">Planned estimate</span>
              ) : null}
              {detail.session.targetLabel ? <span className="text-[13px] text-[var(--text-secondary)]">{detail.session.targetLabel}</span> : null}
            </div>
            <SessionStatusControl sessionId={detail.session.id} action={detail.session.statusAction} />
            <SessionBlockBar segments={detail.session.segments} />
          </Surface>

          {['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'].includes(detail.session.metricsSource ?? '') ? (
            <Surface id="session-outcome" className="space-y-3">
              <h2 className="text-base font-medium text-[var(--text)]">Recorded outcome</h2>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--text-secondary)]">
                <span>Duration <MetricText>{formatDuration(detail.session.activityDurationSec ?? 0)}</MetricText></span>
                {detail.session.activityDistanceMeters === null ? null : <span>Distance <MetricText>{formatDistance(detail.session.activityDistanceMeters)}</MetricText></span>}
                <span>RPE <MetricText>{detail.session.activityRpe === null ? 'Not recorded' : detail.session.activityRpe}</MetricText></span>
                <span>Training load <MetricText>{detail.session.activityTss === null ? 'Unavailable' : `${detail.session.activityTss} TSS`}</MetricText></span>
              </div>
              {['tcx-import', 'fit-import', 'gpx-import'].includes(detail.session.metricsSource ?? '')
                && detail.session.activityStartedAt
                && detail.session.activityCompletedAt
                && detail.session.activityTimezoneOffsetMinutes !== null ? (
                  <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                    <p>Recorded start <MetricText>{formatTcxDateTime(detail.session.activityStartedAt, detail.session.activityTimezoneOffsetMinutes)}</MetricText></p>
                    <p>{detail.session.metricsSource === 'tcx-import' ? 'Estimated finish' : 'Recorded finish'} <MetricText>{formatTcxDateTime(detail.session.activityCompletedAt, detail.session.activityTimezoneOffsetMinutes)}</MetricText></p>
                    <p className="text-xs text-[var(--text-muted)]">{detail.session.metricsSource === 'fit-import' ? 'Timezone is derived from the FIT Activity local timestamp.' : detail.session.metricsSource === 'gpx-import' ? 'Recorded times and timezone come from the GPX trackpoints.' : 'Finish time is calculated from the recorded start and duration.'}</p>
                  </div>
                ) : null}
              {detail.session.metricsSource === 'gpx-import' && detail.session.activityDistanceMeters !== null ? <p className="text-xs text-[var(--text-muted)]">Distance is summed from timed trackpoints; GPS coordinates are not stored.</p> : null}
              {detail.session.activityNotes ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">{detail.session.activityNotes}</p> : <p className="text-sm text-[var(--text-muted)]">No notes recorded.</p>}
              {['manual-paired', 'tcx-import', 'fit-import', 'gpx-import'].includes(detail.session.metricsSource ?? '') && detail.session.plannedDurationSec > 0 ? (
                <div className="border-t border-[var(--border)] pt-3 text-sm text-[var(--text-secondary)]">
                  <h3 className="font-medium text-[var(--text)]">Duration comparison</h3>
                  <p className="mt-1">Actual {formatDuration(detail.session.activityDurationSec ?? 0)} · planned {formatDuration(detail.session.plannedDurationSec)}</p>
                </div>
              ) : null}
              <p className="text-xs text-[var(--text-muted)]">{detail.session.metricsSource === 'fit-import' ? 'Imported FIT activity' : detail.session.metricsSource === 'gpx-import' ? 'Imported GPX activity' : detail.session.metricsSource === 'tcx-import' ? 'Imported TCX activity' : detail.session.metricsSource === 'manual-paired' ? 'Manually logged activity' : 'Logged activity'}{detail.session.plannedDurationSec > 0 ? ' · duration compared with the planned workout' : ' · no planned comparison'}</p>
              {manualCorrectionDraft && detail.session.activityId !== null && detail.session.activityUpdatedAt ? (
                <ManualActivityCorrectionForm
                  activityId={detail.session.activityId}
                  initialUpdatedAt={detail.session.activityUpdatedAt.toISOString()}
                  initialDraft={manualCorrectionDraft}
                />
              ) : null}
            </Surface>
          ) : null}

          {detail.session.importedActivityId ? (
            <Surface id="recorded-activity" className="space-y-4">
              <div>
                <h2 className="text-base font-medium text-[var(--text)]">Recorded activity</h2>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Compare recorded measurements with the scheduled workout blocks below.</p>
              </div>
              <ImportedActivityMeasurements
                activityId={detail.session.importedActivityId}
                durationSec={detail.session.recordedDurationSec ?? detail.session.durationSec}
                sport={detail.session.sport}
              />
            </Surface>
          ) : null}

          <Surface className="space-y-3">
            <p className="text-xs font-medium text-[var(--text-muted)]">
              {['manual-paired', 'tcx-import', 'fit-import', 'gpx-import'].includes(detail.session.metricsSource ?? '') ? 'Planned workout blocks' : 'Blocks'}
            </p>
            {['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'].includes(detail.session.metricsSource ?? '') && detail.session.blocks.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Summary-only activity has no recorded workout blocks.</p>
            ) : null}
            {detail.session.blocks.map((block) => (
              <div key={block.id} className="rounded-[10px] border border-[var(--border)] bg-[var(--field-surface)] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex min-h-7 items-center rounded-full px-3 text-[12px] font-semibold"
                    style={{ backgroundColor: block.tint, color: block.color }}
                  >
                    {block.label}
                  </span>
                  <MetricText>{formatDuration(block.durationSec)}</MetricText>
                  {block.skipped ? <span className="text-xs text-[var(--text-muted)]">Skipped</span> : null}
                  {block.reps ? <MetricText>{block.reps} reps</MetricText> : null}
                  {block.targetLabel ? <span className="text-[12px] text-[var(--text-secondary)]">{block.targetLabel}</span> : null}
                </div>
                {block.note ? <p className="mt-3 text-[13px] leading-[1.5] text-[var(--text)]">{block.note}</p> : null}
              </div>
            ))}
          </Surface>
        </div>

        <div className="space-y-4">
          <Surface>
            <p className="text-xs font-medium text-[var(--text-muted)]">
              Coach
            </p>
            <p className="mt-3 text-base font-semibold text-[var(--text)]">
              {detail.coachName ?? 'Self coached'}
            </p>
          </Surface>
        </div>
      </div>

      {/* Full width so the correction editor is not squeezed into the summary aside. */}
      {['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'].includes(detail.session.metricsSource ?? '') ? null : <SessionDetailClient
        id="session-outcome"
        sessionId={detail.session.id}
        initialDone={detail.session.status === 'completed'}
        isSkipped={isSkipped}
        initialNotes={detail.session.notes}
        initialDraft={detail.session.editor}
        performanceProfile={account?.performanceProfile}
        canDelete={detail.session.canDelete}
        returnHref={returnTarget.href}
      />}
    </PageShell>
  );
}
