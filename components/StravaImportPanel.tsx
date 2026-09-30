'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ActivityMetricPreview } from '@/components/ActivityMetricPreview';
import { Badge, Surface, dangerTextClassName, formFieldClassName, formLabelClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
import type { ImportableSession } from '@/lib/activity-import-service';
import type { ImportedActivityFile } from '@/lib/activity-file-parser';
import type { StravaConnectionSummary, StravaInboxActivitySummary } from '@/lib/strava-service';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';

type StravaDetail = ImportedActivityFile & { metadata: Record<string, unknown> };
type Draft = { title: string; sport: string; plannedSessionId: number | null };

const sportOptions = ['RUNNING', 'BIKING', 'SWIMMING', 'STRENGTH', 'STRETCHING', 'OTHER'];

export function StravaImportPanel({
  initialConnection,
  plannedSessions,
  oauthResult,
}: {
  initialConnection: StravaConnectionSummary;
  plannedSessions: ImportableSession[];
  oauthResult: string | null;
}) {
  const router = useRouter();
  const [connection, setConnection] = useState(initialConnection);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, StravaDetail>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState<Record<string, boolean>>({});
  const [importErrors, setImportErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [providerRevocationFailed, setProviderRevocationFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activityButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const oauthNotice = oauthResult === 'connected'
    ? 'Strava is connected. Recent activities are ready to review.'
    : oauthResult === 'connected:sync-error'
      ? 'Strava is connected, but the first activity sync failed. Use Sync now to retry.'
      : oauthResult === 'connected:revoke-error'
        ? 'Strava is connected, but Tempo could not confirm revocation of the previous Strava account. Remove Tempo from that account’s Strava settings.'
        : oauthResult === 'connected:sync-revoke-error'
          ? 'Strava is connected, but the first sync failed and Tempo could not confirm revocation of the previous account. Retry sync and remove Tempo from the previous account’s Strava settings.'
    : oauthResult === 'cancelled'
      ? 'Strava connection was cancelled.'
      : oauthResult === 'error:state'
        ? 'The Strava sign-in expired. Start the connection again.'
        : oauthResult === 'error:account-linked'
          ? 'That Strava account is already linked to another Tempo account.'
          : oauthResult?.startsWith('error:')
            ? 'Strava could not be connected. Check the app settings and try again.'
            : null;

  useEffect(() => {
    setConnection(initialConnection);
  }, [initialConnection]);

  useEffect(() => {
    if (!activeActivityId) return;
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    const trigger = activityButtonRefs.current[activeActivityId];
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      trigger?.focus();
    };
  }, [activeActivityId]);

  async function syncActivities() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/strava/activities', { method: 'POST' });
      const result = await response.json() as { error?: string; synced?: number };
      if (!response.ok) throw new Error(result.error || 'Strava activities could not be synced.');
      setNotice(`Checked Strava for recent activities${typeof result.synced === 'number' ? ` · ${result.synced} found` : ''}.`);
      router.refresh();
      window.dispatchEvent(new Event('tempo-strava-inbox-changed'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Strava activities could not be synced.');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Strava and remove Strava activities from Tempo? Your planned sessions and file imports will stay.')) return;
    setDisconnecting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/strava/connection', { method: 'DELETE' });
      const result = await response.json() as { error?: string; removedActivities?: number; providerRevoked?: boolean };
      if (!response.ok) throw new Error(result.error || 'Strava could not be disconnected.');
      setNotice(`Strava disconnected and ${result.removedActivities ?? 0} Strava-imported session${result.removedActivities === 1 ? '' : 's'} removed.`);
      setProviderRevocationFailed(result.providerRevoked === false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Strava could not be disconnected.');
    } finally {
      setDisconnecting(false);
    }
  }

  async function loadDetails(activity: StravaInboxActivitySummary) {
    if (details[activity.id] || loading[activity.id]) return;
    setLoading((current) => ({ ...current, [activity.id]: true }));
    setDetailErrors((current) => ({ ...current, [activity.id]: '' }));
    try {
      const response = await fetch(`/api/strava/activities/${encodeURIComponent(activity.id)}`);
      const result = await response.json() as { error?: string; activity?: StravaDetail };
      if (!response.ok || !result.activity) throw new Error(result.error || 'Activity details could not be loaded.');
      setDetails((current) => ({ ...current, [activity.id]: result.activity! }));
      setDrafts((current) => ({
        ...current,
        [activity.id]: current[activity.id] ?? { title: result.activity!.title, sport: result.activity!.sport, plannedSessionId: null },
      }));
    } catch (reason) {
      setDetailErrors((current) => ({
        ...current,
        [activity.id]: reason instanceof Error ? reason.message : 'Activity details could not be loaded.',
      }));
    } finally {
      setLoading((current) => ({ ...current, [activity.id]: false }));
    }
  }

  function openDetails(activity: StravaInboxActivitySummary) {
    setActiveActivityId(activity.id);
    setError(null);
    void loadDetails(activity);
  }

  function updateDraft(activityId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [activityId]: { ...current[activityId], ...patch } }));
  }

  async function importActivity(activityId: string) {
    const draft = drafts[activityId];
    if (!draft) return;
    setImporting((current) => ({ ...current, [activityId]: true }));
    setImportErrors((current) => ({ ...current, [activityId]: '' }));
    setNotice(null);
    try {
      const response = await fetch('/api/strava/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stravaActivityId: activityId, ...draft }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Strava activity could not be imported.');
      setNotice(`${draft.title} was imported into Tempo.`);
      window.dispatchEvent(new Event('tempo-strava-inbox-changed'));
      router.refresh();
      dialogRef.current?.close();
    } catch (reason) {
      setImportErrors((current) => ({
        ...current,
        [activityId]: reason instanceof Error ? reason.message : 'Strava activity could not be imported.',
      }));
    } finally {
      setImporting((current) => ({ ...current, [activityId]: false }));
    }
  }

  async function reviewActivity(activityId: string, action: 'discard' | 'restore') {
    setImporting((current) => ({ ...current, [activityId]: true }));
    setImportErrors((current) => ({ ...current, [activityId]: '' }));
    try {
      const response = await fetch('/api/strava/inbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [activityId], action }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Activity review could not be saved.');
      setConnection((current) => ({ ...current, activities: current.activities.map((activity) => activity.id === activityId ? { ...activity, dismissed: action === 'discard' } : activity) }));
      setNotice(action === 'discard' ? 'Dismissed for now. You can still review and import this activity here.' : 'Restored to new-activity notifications.');
      window.dispatchEvent(new Event('tempo-strava-inbox-changed'));
      dialogRef.current?.close();
      router.refresh();
    } catch (reason) {
      setImportErrors((current) => ({ ...current, [activityId]: reason instanceof Error ? reason.message : 'Activity review could not be saved.' }));
    } finally {
      setImporting((current) => ({ ...current, [activityId]: false }));
    }
  }

  const activeActivity = connection.activities.find((activity) => activity.id === activeActivityId) ?? null;
  const activeDetail = activeActivityId ? details[activeActivityId] : null;
  const activeDraft = activeActivityId ? drafts[activeActivityId] : null;
  const activeMatchingSessions = activeActivity
    ? plannedSessions.filter((session) => session.sport === (activeDraft?.sport ?? activeActivity.sport))
    : [];

  return (
    <Surface className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text)]">Sync from Strava</h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            {connection.connected
              ? connection.webhookConfigured
                ? `Connected${connection.athleteName ? ` as ${connection.athleteName}` : ''} · new activity changes sync automatically.`
                : `Connected${connection.athleteName ? ` as ${connection.athleteName}` : ''} · webhooks are not configured, so use Sync now to check for activities.`
              : 'Connect your Strava account to review activities before adding them to Tempo.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {connection.connected ? (
            <>
              <button type="button" className={secondaryButtonClassName} disabled={syncing || disconnecting} onClick={() => void syncActivities()}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button type="button" className={secondaryButtonClassName} disabled={syncing || disconnecting} onClick={() => void disconnect()}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect Strava'}
              </button>
            </>
          ) : connection.canConnect ? (
            <a className={primaryButtonClassName} href="/api/strava/connect">Connect Strava</a>
          ) : (
            <span className="max-w-64 text-right text-[12px] text-[var(--text-secondary)]">Add the Strava app credentials in the server environment to connect an account.</span>
          )}
        </div>
      </div>

      {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
      {notice ? <p role="status" className="text-[13px] text-[var(--status-success)]">{notice}</p> : null}
      {providerRevocationFailed ? (
        <p role="status" className="text-[13px] leading-[1.5] text-[var(--text-secondary)]">
          Strava did not confirm remote revocation. <a className="font-medium text-[var(--brand)] underline underline-offset-2" href="https://www.strava.com/settings/apps" target="_blank" rel="noreferrer">Remove Tempo in Strava settings</a> to finish disconnecting.
        </p>
      ) : null}
      {oauthNotice ? (
        <p role="status" className="text-[13px] leading-[1.5] text-[var(--text-secondary)]">
          {oauthNotice}
          {oauthResult === 'connected:revoke-error' || oauthResult === 'connected:sync-revoke-error' ? (
            <> <a className="font-medium text-[var(--brand)] underline underline-offset-2" href="https://www.strava.com/settings/apps" target="_blank" rel="noreferrer">Open Strava settings</a></>
          ) : null}
        </p>
      ) : null}

      {connection.connected ? connection.activities.length ? (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {connection.activities.map((activity) => (
            <button
              key={activity.id}
              ref={(element) => { activityButtonRefs.current[activity.id] = element; }}
              type="button"
              className="group flex min-h-16 w-full items-center justify-between gap-3 rounded-[3px] px-3 py-3 text-left transition-colors hover:bg-[var(--field-surface)] active:bg-[var(--sunken)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-liquid)]"
              aria-label={`Open activity details for ${activity.title}`}
              aria-haspopup="dialog"
              aria-controls="strava-activity-details"
              onClick={() => openDetails(activity)}
            >
              <span className="min-w-0">
                <span className="block break-words text-[15px] font-semibold text-[var(--text)] group-hover:text-[var(--brand)]">{activity.title}</span>
                <span className="mt-1 block text-[12px] text-[var(--text-secondary)]">
                  {format(new Date(activity.startedAt), 'EEE d MMM yyyy · HH:mm')} · {getSportLabel(activity.sport)} · {formatDuration(activity.durationSec)}
                  {activity.distanceMeters !== null ? ` · ${(activity.distanceMeters / 1000).toFixed(2)} km` : ''}
                  {activity.elevationGainMeters !== null ? ` · ${Math.round(activity.elevationGainMeters)} m up` : ''}
                </span>
              </span>
              {activity.imported ? <Badge tone="success">Imported</Badge> : activity.dismissed ? <Badge>Dismissed for now</Badge> : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="border-y border-[var(--border)] py-4 text-[13px] text-[var(--text-secondary)]">
          No recent Strava activities found. {connection.webhookConfigured ? 'New activities will appear here after the next webhook sync.' : 'Use Sync now to check again.'}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        id="strava-activity-details"
        className="fixed inset-0 z-50 m-auto max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100%-2rem))] overflow-x-hidden overflow-y-auto rounded-[5px] border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-[var(--shadow-overlay)] backdrop:bg-[var(--overlay)]"
        aria-labelledby="strava-activity-details-title"
        aria-busy={Boolean(activeActivityId && loading[activeActivityId])}
        onClose={() => setActiveActivityId(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        {activeActivity ? (
          <>
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <h2 id="strava-activity-details-title" className="break-words text-xl font-semibold text-[var(--text)]">{activeActivity.title}</h2>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                  {format(new Date(activeActivity.startedAt), 'EEE d MMM yyyy · HH:mm')} · {getSportLabel(activeActivity.sport)} · {formatDuration(activeActivity.durationSec)}
                  {activeActivity.distanceMeters !== null ? ` · ${(activeActivity.distanceMeters / 1000).toFixed(2)} km` : ''}
                  {activeActivity.elevationGainMeters !== null ? ` · ${Math.round(activeActivity.elevationGainMeters)} m up` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {activeActivity.imported ? <Badge tone="success">Imported</Badge> : null}
                <button
                  ref={closeButtonRef}
                  type="button"
                  className={secondaryButtonClassName}
                  aria-label="Close activity details"
                  onClick={() => dialogRef.current?.close()}
                >
                  Close
                </button>
              </div>
            </header>
            <div className="min-w-0 space-y-4 p-5 sm:p-7">
              {activeActivityId && detailErrors[activeActivityId] ? (
                <p role="alert" className={dangerTextClassName}>{detailErrors[activeActivityId]}</p>
              ) : null}
              {activeDetail ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryValue label="Original Strava sport" value={activeActivity.sportType} />
                    <SummaryValue label="Duration" value={formatDuration(activeDetail.durationSec)} />
                    <SummaryValue label="Distance" value={activeDetail.distanceMeters === null ? 'Not recorded' : `${(activeDetail.distanceMeters / 1000).toFixed(2)} km`} />
                    <SummaryValue label="Elevation gain" value={activeDetail.elevationGainMeters === null ? 'Not recorded' : `${Math.round(activeDetail.elevationGainMeters)} m`} />
                    {formatStravaMetadata(activeDetail.metadata).map(([label, value]) => <SummaryValue key={label} label={label} value={value} />)}
                  </div>
                  <label className="block">
                    <span className={formLabelClassName}>Activity name in Tempo</span>
                    <input className={formFieldClassName} value={activeDraft?.title ?? activeDetail.title} maxLength={140} onChange={(event) => updateDraft(activeActivity.id, { title: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className={formLabelClassName}>Categorize as</span>
                    <select className={formFieldClassName} value={activeDraft?.sport ?? activeDetail.sport} onChange={(event) => updateDraft(activeActivity.id, { sport: event.target.value, plannedSessionId: null })}>
                      {sportOptions.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className={formLabelClassName}>Planned session to complete</span>
                    <select className={formFieldClassName} value={activeDraft?.plannedSessionId ?? ''} onChange={(event) => updateDraft(activeActivity.id, { plannedSessionId: event.target.value ? Number(event.target.value) : null })}>
                      <option value="">Create a new completed session</option>
                      {activeMatchingSessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.date ? `${format(new Date(session.date), 'd MMM')} · ` : ''}{session.title} · {getSportLabel(session.sport)}
                        </option>
                      ))}
                    </select>
                    {activeMatchingSessions.length === 0 ? <p className="mt-1 text-[12px] text-[var(--text-secondary)]">No unfinished planned session for this category is available.</p> : null}
                  </label>
                  <ActivityMetricPreview points={activeDetail.points} durationSec={activeDetail.durationSec} distanceMeters={activeDetail.distanceMeters} sport={activeDraft?.sport ?? activeDetail.sport} />
                </>
              ) : loading[activeActivity.id] ? (
                <p role="status" className="text-[13px] text-[var(--text-secondary)]">Loading activity data and recorded streams…</p>
              ) : null}
            </div>
            <footer className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:px-7">
              {activeActivityId && importErrors[activeActivityId] ? (
                <p role="alert" className={dangerTextClassName}>{importErrors[activeActivityId]}</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] text-[var(--text-secondary)]">
                  {activeDraft?.plannedSessionId ? 'The planned workout stays available for comparison.' : 'Tempo will create a completed session from the recorded activity.'}
                </p>
                {!activeActivity.imported ? <button type="button" className={secondaryButtonClassName} disabled={Boolean(importing[activeActivity.id])} onClick={() => void reviewActivity(activeActivity.id, activeActivity.dismissed ? 'restore' : 'discard')}>
                  {activeActivity.dismissed ? 'Restore to notifications' : 'Dismiss for now'}
                </button> : null}
                <button type="button" className={primaryButtonClassName} disabled={Boolean(importing[activeActivity.id]) || activeActivity.imported || !activeDraft?.title.trim()} onClick={() => void importActivity(activeActivity.id)}>
                  {activeActivity.imported ? 'Already imported' : importing[activeActivity.id] ? 'Importing…' : 'Import activity'}
                </button>
              </div>
            </footer>
          </>
        ) : null}
      </dialog>
    </Surface>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-l-2 border-[var(--border)] pl-3"><p className="text-[11px] font-medium text-[var(--text-muted)]">{label}</p><p className="metric-text mt-1 wrap-anywhere text-[15px] font-semibold text-[var(--text)]">{value}</p></div>;
}

export function formatStravaMetadata(metadata: Record<string, unknown>) {
  const fields: Array<[string, unknown, (value: unknown) => string]> = [
    ['Strava sport', metadata.sportType, (value) => String(value)],
    ['Workout type', metadata.workoutType, (value) => String(value)],
    ['Moving time', metadata.movingTimeSec, (value) => formatDuration(Number(value))],
    ['Elevation high', metadata.elevationHighMeters, (value) => `${Math.round(Number(value))} m`],
    ['Elevation low', metadata.elevationLowMeters, (value) => `${Math.round(Number(value))} m`],
    ['Indoor trainer', metadata.trainer, (value) => value === true ? 'Yes' : 'No'],
    ['Commute', metadata.commute, (value) => value === true ? 'Yes' : 'No'],
    ['Calories', metadata.calories, (value) => `${Math.round(Number(value))} kcal`],
    ['Average heart rate', metadata.averageHeartrate, (value) => `${Math.round(Number(value))} bpm`],
    ['Peak heart rate', metadata.maxHeartrate, (value) => `${Math.round(Number(value))} bpm`],
    ['Average speed', metadata.averageSpeed, (value) => `${(Number(value) * 3.6).toFixed(1)} km/h`],
    ['Peak speed', metadata.maxSpeed, (value) => `${(Number(value) * 3.6).toFixed(1)} km/h`],
    ['Average power', metadata.averageWatts, (value) => `${Math.round(Number(value))} W`],
    ['Peak power', metadata.maxWatts, (value) => `${Math.round(Number(value))} W`],
    ['Weighted power', metadata.weightedAverageWatts, (value) => `${Math.round(Number(value))} W`],
    ['Average cadence', metadata.averageCadence, (value) => `${Math.round(Number(value))} rpm`],
    ['Average temperature', metadata.averageTemp, (value) => `${Math.round(Number(value))} °C`],
    ['Total work', metadata.kilojoules, (value) => `${Math.round(Number(value))} kJ`],
    ['Power source', metadata.deviceWatts, (value) => value === true ? 'Power meter' : 'Estimated'],
    ['Effort score', metadata.sufferScore, (value) => String(value)],
    ['Device', metadata.deviceName, (value) => String(value)],
    ['Recorded timezone', metadata.timezone, (value) => String(value)],
  ];
  return fields.flatMap(([label, candidate, formatValue]) => {
    if (typeof candidate === 'boolean') return [[label, formatValue(candidate)] as [string, string]];
    if (typeof candidate === 'string' && candidate.trim()) return [[label, formatValue(candidate)] as [string, string]];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return [[label, formatValue(candidate)] as [string, string]];
    return [];
  });
}
