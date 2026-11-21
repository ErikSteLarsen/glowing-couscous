import { notFound, redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, Surface, TopBar, sectionHeadingClassName } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration, formatDurationExact } from '@/lib/format-duration';
import { formatDistance } from '@/lib/format-distance';
import { formatTcxDateTime } from '@/lib/tcx-time';
import { parseBackOrigin, resolveBackTarget } from '@/lib/app-navigation';
import { SessionDetailClient } from './SessionDetailClient';
import { isRecordedOutcome } from '@/lib/athlete-completion-service';
import { SessionAdjustProvider, SessionHeaderActions } from './SessionActions';
import { ManualActivityCorrectionForm, type ManualActivityCorrectionDraft } from './ManualActivityCorrectionForm';
import { accountService } from '@/lib/account-service';
import { formatSessionWhen } from '@/lib/session-display';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { toDayKey } from '@/lib/training-load';
import { todayInZone } from '@/lib/user-time';
import { ImportedActivityMeasurements } from '@/components/ImportedActivityMeasurements';
import { SessionWorkoutOverview } from '@/components/SessionWorkoutOverview';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { canStartWorkout } from '@/lib/workout-start';

/** Outcomes owned by a manual log or a file import; their data is not edited through the session completion form. */
const IMPORTED_OR_LOGGED_SOURCES = ['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'];

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

  const timeZone = await getRequestTimeZone();
  const [detail, account] = await Promise.all([athleteService.loadSessionDetail(user.id, parsedSessionId, { timeZone }), accountService.getAccount(user.id)]);
  if (!detail) {
    return (
      <PageShell size="wide">
        <EmptyState title="Session not found" description="This session is unavailable or belongs to another athlete." />
      </PageShell>
    );
  }

  const sessionOrigin = parseBackOrigin('session', from);
  const returnTarget = resolveBackTarget({ route: 'session', from });
  const displayStatus = detail.session.isOverdue ? 'missed' : detail.session.status;
  const { id, title, sport, status, durationSec, hasSteps } = detail.session;
  const isSkipped = status === 'skipped';
  // Imported activities with no matched workout show their recorded data instead of a plan.
  const importedWithoutWorkout = detail.session.importedActivityId !== null && detail.session.blocks.length === 0;
  const scoreDurationSec = importedWithoutWorkout
    ? detail.session.recordedDurationSec ?? detail.session.durationSec
    : detail.session.durationSec;
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

  const isImportOrLogged = IMPORTED_OR_LOGGED_SOURCES.includes(detail.session.metricsSource ?? '');
  const isCompleted = status === 'completed';
  const startable = canStartWorkout({ sport, status, hasSteps });
  const logCompletion = !importedWithoutWorkout && !isImportOrLogged && !isCompleted && !isSkipped;
  const primary = logCompletion ? (
    <>
      <WorkoutStartChooser
        workout={{ title, sport, status, durationSec, hasSteps }}
        source={{ kind: 'session', id, from: sessionOrigin }}
      />
      <ActionLink href="#session-outcome" tone={startable ? 'secondary' : 'primary'}>Log completion</ActionLink>
    </>
  ) : null;

  const recordedOutcome = isImportOrLogged ? (
    <Surface id="session-outcome" className="space-y-3">
      <h2 className={sectionHeadingClassName}>Recorded outcome</h2>
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
  ) : null;

  const recordedActivity = detail.session.importedActivityId ? (
    <Surface id="recorded-activity" className="space-y-4">
      <div>
        <h2 className={sectionHeadingClassName}>{importedWithoutWorkout ? 'Activity data' : 'Recorded activity'}</h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          {importedWithoutWorkout
            ? 'Charts show the measurements saved with this activity.'
            : 'Compare recorded measurements with the planned workout below.'}
        </p>
      </div>
      <ImportedActivityMeasurements
        activityId={detail.session.importedActivityId}
        durationSec={detail.session.recordedDurationSec ?? detail.session.durationSec}
        sport={detail.session.sport}
      />
    </Surface>
  ) : null;

  const completion = importedWithoutWorkout ? (
    detail.session.notes.trim() ? (
      <Surface id="session-outcome" className="space-y-3">
        <h2 className={sectionHeadingClassName}>Activity notes</h2>
        <p className="border-t border-[var(--border)] pt-4 whitespace-pre-wrap break-words text-[13px] leading-[1.55] text-[var(--text)]">{detail.session.notes.trim()}</p>
      </Surface>
    ) : null
  ) : isImportOrLogged ? null : <SessionDetailClient
    id="session-outcome"
    sessionId={detail.session.id}
    initialDone={detail.session.status === 'completed'}
    isSkipped={isSkipped}
    initialNotes={detail.session.notes}
    initialDraft={detail.session.editor}
    performanceProfile={account?.performanceProfile}
    compliancePct={detail.session.compliancePct}
    isRecorded={detail.session.status === 'completed' && isRecordedOutcome(detail.session.metricsSource ? { metricsSource: detail.session.metricsSource } : null)}
  />;

  const structure = isImportOrLogged && detail.session.blocks.length === 0 ? (
    <Surface className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">Summary-only activity has no recorded workout blocks.</p>
    </Surface>
  ) : importedWithoutWorkout ? (
    <Surface className="space-y-4">{overviewHeader}</Surface>
  ) : (
    <SessionWorkoutOverview blocks={detail.session.blocks} header={overviewHeader} />
  );

  const leadsWithOutcome = isCompleted || importedWithoutWorkout;

  return (
    <PageShell size="wide" className="[overflow-wrap:anywhere]">
      <SessionAdjustProvider>
        <TopBar
          back={returnTarget}
          title={detail.session.title}
          actions={
            <SessionHeaderActions
              sessionId={id}
              title={title}
              primary={primary}
              shareable={!isImportOrLogged}
              canAdjust={logCompletion}
              sourceWorkoutId={detail.session.sourceWorkout?.id ?? null}
              move={detail.session.canReschedule ? { currentDay: toDayKey(detail.session.date), today: todayInZone(timeZone) } : null}
              statusAction={detail.session.statusAction}
              canDelete={detail.session.canDelete}
              returnHref={returnTarget.href}
            />
          }
        />

        <div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-[var(--border)] py-3 text-[13px] text-[var(--text-secondary)]">
          <span>{formatSessionWhen(detail.session.date, detail.session.timeLabel)}</span>
          <StatusBadge status={displayStatus} />
          <MetricText>{formatDuration(detail.session.durationSec)}</MetricText>
          <MetricText>{detail.session.tss === null ? 'Load unavailable' : `${detail.session.tss} TSS`}</MetricText>
          {detail.session.metricsSource === 'manual-planned' ? <span className="text-[12px]">Planned estimate</span> : null}
          {detail.session.targetLabel ? <span>{detail.session.targetLabel}</span> : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {leadsWithOutcome ? (
              <>
                {recordedOutcome}
                {completion}
                {recordedActivity}
                {structure}
              </>
            ) : (
              <>
                {structure}
                {recordedOutcome}
                {recordedActivity}
              </>
            )}

            {detail.session.summary ? (
              <section aria-labelledby="session-description" className="space-y-2">
                <h2 id="session-description" className={sectionHeadingClassName}>Description</h2>
                <p className="max-w-[68ch] whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-secondary)]">{detail.session.summary}</p>
              </section>
            ) : null}

            {leadsWithOutcome ? null : completion}
          </div>

          <aside className="space-y-4" aria-label="Session source">
            {detail.session.sourceWorkout ? (
              <Surface className="space-y-2">
                <h2 className={sectionHeadingClassName}>Reusable workout</h2>
                <p className="break-words text-[13px] font-medium text-[var(--text)]">{detail.session.sourceWorkout.title}</p>
                <p className="text-[12px] leading-[1.5] text-[var(--text-secondary)]">
                  This session is a copy. Editing the source from ⋯ will not change it.
                </p>
              </Surface>
            ) : null}
            <Surface>
              <p className="text-xs font-medium text-[var(--text-muted)]">Coach</p>
              <p className="mt-3 text-base font-semibold text-[var(--text)]">{detail.coachName ?? 'Self coached'}</p>
            </Surface>
          </aside>
        </div>
      </SessionAdjustProvider>
    </PageShell>
  );
}
