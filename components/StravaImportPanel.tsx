'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ActivityMetricPreview } from '@/components/ActivityMetricPreview';
import { Surface, dangerTextClassName, formFieldClassName, formLabelClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, StravaDetail>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [providerRevocationFailed, setProviderRevocationFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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
    setExpanded((current) => ({ ...current, [activity.id]: !current[activity.id] }));
    if (details[activity.id] || loading[activity.id]) return;
    setLoading((current) => ({ ...current, [activity.id]: true }));
    setError(null);
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
      setError(reason instanceof Error ? reason.message : 'Activity details could not be loaded.');
    } finally {
      setLoading((current) => ({ ...current, [activity.id]: false }));
    }
  }

  function updateDraft(activityId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [activityId]: { ...current[activityId], ...patch } }));
  }

  async function importActivity(activityId: string) {
    const draft = drafts[activityId];
    if (!draft) return;
    setImporting((current) => ({ ...current, [activityId]: true }));
    setError(null);
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
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Strava activity could not be imported.');
    } finally {
      setImporting((current) => ({ ...current, [activityId]: false }));
    }
  }

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
          {connection.activities.map((activity) => {
            const isExpanded = expanded[activity.id] ?? false;
            const detail = details[activity.id];
            const draft = drafts[activity.id];
            const matchingSessions = plannedSessions.filter((session) => session.sport === (draft?.sport ?? activity.sport));
            return (
              <article key={activity.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-[3px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-liquid)]"
                    aria-expanded={isExpanded}
                    onClick={() => void loadDetails(activity)}
                  >
                    <span className="block break-words text-[15px] font-semibold text-[var(--text)]">{activity.title}</span>
                    <span className="mt-1 block text-[12px] text-[var(--text-secondary)]">
                      {format(new Date(activity.startedAt), 'EEE d MMM yyyy · HH:mm')} · {getSportLabel(activity.sport)} · {formatDuration(activity.durationSec)}
                      {activity.distanceMeters !== null ? ` · ${(activity.distanceMeters / 1000).toFixed(2)} km` : ''}
                      {activity.elevationGainMeters !== null ? ` · ${Math.round(activity.elevationGainMeters)} m up` : ''}
                    </span>
                  </button>
                  <span className="flex items-center gap-3">
                    {activity.imported ? <span className="text-[11px] font-medium text-[var(--status-success)]">Imported</span> : null}
                    <span className="text-[12px] font-medium text-[var(--brand)]">{loading[activity.id] ? 'Loading…' : isExpanded ? 'Close review' : 'Review'}</span>
                  </span>
                </div>
                {isExpanded ? (
                  <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
                    {detail ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <SummaryValue label="Original Strava sport" value={activity.sportType} />
                          <SummaryValue label="Duration" value={formatDuration(detail.durationSec)} />
                          <SummaryValue label="Distance" value={detail.distanceMeters === null ? 'Not recorded' : `${(detail.distanceMeters / 1000).toFixed(2)} km`} />
                          <SummaryValue label="Elevation gain" value={detail.elevationGainMeters === null ? 'Not recorded' : `${Math.round(detail.elevationGainMeters)} m`} />
                          {formatStravaMetadata(detail.metadata).map(([label, value]) => <SummaryValue key={label} label={label} value={value} />)}
                        </div>
                        <label className="block">
                          <span className={formLabelClassName}>Activity name in Tempo</span>
                          <input className={formFieldClassName} value={draft?.title ?? detail.title} maxLength={140} onChange={(event) => updateDraft(activity.id, { title: event.target.value })} />
                        </label>
                        <label className="block">
                          <span className={formLabelClassName}>Categorize as</span>
                          <select className={formFieldClassName} value={draft?.sport ?? detail.sport} onChange={(event) => updateDraft(activity.id, { sport: event.target.value, plannedSessionId: null })}>
                            {sportOptions.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className={formLabelClassName}>Planned session to complete</span>
                          <select className={formFieldClassName} value={draft?.plannedSessionId ?? ''} onChange={(event) => updateDraft(activity.id, { plannedSessionId: event.target.value ? Number(event.target.value) : null })}>
                            <option value="">Create a new completed session</option>
                            {matchingSessions.map((session) => (
                              <option key={session.id} value={session.id}>
                                {session.date ? `${format(new Date(session.date), 'd MMM')} · ` : ''}{session.title} · {getSportLabel(session.sport)}
                              </option>
                            ))}
                          </select>
                          {matchingSessions.length === 0 ? <p className="mt-1 text-[12px] text-[var(--text-secondary)]">No unfinished planned session for this category is available.</p> : null}
                        </label>
                        <ActivityMetricPreview points={detail.points} durationSec={detail.durationSec} distanceMeters={detail.distanceMeters} sport={draft?.sport ?? detail.sport} />
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                          <p className="text-[12px] text-[var(--text-secondary)]">{draft?.plannedSessionId ? 'The planned workout stays available for comparison.' : 'Tempo will create a completed session from the recorded activity.'}</p>
                          <button type="button" className={primaryButtonClassName} disabled={Boolean(importing[activity.id]) || activity.imported || !draft?.title.trim()} onClick={() => void importActivity(activity.id)}>
                            {activity.imported ? 'Already imported' : importing[activity.id] ? 'Importing…' : 'Import activity'}
                          </button>
                        </div>
                      </>
                    ) : loading[activity.id] ? (
                      <p role="status" className="text-[13px] text-[var(--text-secondary)]">Loading activity data and recorded streams…</p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="border-y border-[var(--border)] py-4 text-[13px] text-[var(--text-secondary)]">
          No recent Strava activities found. {connection.webhookConfigured ? 'New activities will appear here after the next webhook sync.' : 'Use Sync now to check again.'}
        </p>
      ) : null}
    </Surface>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return <div className="border-l-2 border-[var(--border)] pl-3"><p className="text-[11px] font-medium text-[var(--text-muted)]">{label}</p><p className="metric-text mt-1 text-[15px] font-semibold text-[var(--text)]">{value}</p></div>;
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
