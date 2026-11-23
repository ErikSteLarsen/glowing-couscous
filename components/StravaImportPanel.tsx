'use client';

import { SegmentedControl, SegmentedControlItem } from '@ui-sdk/react/segmented-control';

import { useEffect, useRef, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ActivityMetricPreview } from '@/components/ActivityMetricPreview';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempo/Menu';
import { MetricPair } from '@/components/tempo/MetricPair';
import { successTextClassName, sectionHeadingClassName, Badge, Surface, dangerTextClassName, formFieldClassName, formLabelClassName, getSegmentedChoiceClassName, iconButtonClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
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
}: {
  initialConnection: StravaConnectionSummary;
  plannedSessions: ImportableSession[];
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
  const [syncing, setSyncing] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const inboxFilterRef = useRef<HTMLButtonElement>(null);
  const activityButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setConnection(initialConnection);
  }, [initialConnection]);

  useEffect(() => {
    if (!activeActivityId) return;
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    const trigger = activityButtonRefs.current[activeActivityId];
    const inboxFilter = inboxFilterRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus();
      else inboxFilter?.focus();
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
      setNotice(`Checked Strava for recent activities${typeof result.synced === 'number' ? `\u00A0· ${result.synced} found` : ''}.`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Strava activities could not be synced.');
    } finally {
      setSyncing(false);
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
      setConnection((current) => ({ ...current, activities: current.activities.map((activity) => activity.id === activityId ? { ...activity, imported: true } : activity) }));
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
      setNotice(action === 'discard' ? 'Dismissed for now. Find this activity under All activities to restore or import it.' : 'Restored to Needs review.');
      dialogRef.current?.close();
      router.refresh();
    } catch (reason) {
      setImportErrors((current) => ({ ...current, [activityId]: reason instanceof Error ? reason.message : 'Activity review could not be saved.' }));
    } finally {
      setImporting((current) => ({ ...current, [activityId]: false }));
    }
  }

  const activeActivity = connection.activities.find((activity) => activity.id === activeActivityId) ?? null;
  const pendingActivities = connection.activities.filter((activity) => !activity.imported && !activity.dismissed);
  const visibleActivities = showAllActivities ? connection.activities : pendingActivities;
  const activeDetail = activeActivityId ? details[activeActivityId] : null;
  const activeDraft = activeActivityId ? drafts[activeActivityId] : null;
  const activeMatchingSessions = activeActivity
    ? plannedSessions.filter((session) => session.sport === (activeDraft?.sport ?? activeActivity.sport))
    : [];

  return (
    <Surface id="strava" className="scroll-mt-20 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={sectionHeadingClassName}>Strava inbox</h2>
          {!connection.connected ? (
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {connection.canConnect ? 'Strava is not connected.' : 'Strava is currently unavailable.'}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {connection.connected ? (
            <>
              <button type="button" className={`${secondaryButtonClassName} max-md:min-h-11`} disabled={refreshing || syncing} onClick={() => void syncActivities()}>
                {syncing ? 'Checking Strava…' : 'Check Strava now'}
              </button>
              <Menu>
                <MenuTrigger aria-label="Strava inbox options" className={iconButtonClassName}>
                  <Ellipsis size={18} aria-hidden="true" />
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuItem disabled={refreshing || syncing} onSelect={() => startRefresh(() => router.refresh())}>
                    {refreshing ? 'Refreshing…' : 'Refresh inbox'}
                  </MenuItem>
                  <MenuItem render={<Link href="/settings#connections" />}>Manage connections</MenuItem>
                </MenuContent>
              </Menu>
            </>
          ) : (
            <Link href="/settings#connections" className={`${secondaryButtonClassName} max-md:min-h-11`}>Manage connections</Link>
          )}
        </div>
      </div>

      {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
      {notice ? <p role="status" className={successTextClassName}>{notice}</p> : null}
      {connection.connected ? (
        <div className="space-y-3">
          <SegmentedControl value={showAllActivities ? 'all' : 'review'} onValueChange={(value) => { if (value) setShowAllActivities(value === 'all'); }} aria-label="Strava inbox filter" className="flex w-full max-w-sm gap-2">
            <SegmentedControlItem ref={inboxFilterRef} value="review" className={getSegmentedChoiceClassName(!showAllActivities)}>Needs review ({pendingActivities.length})</SegmentedControlItem>
            <SegmentedControlItem value="all" className={getSegmentedChoiceClassName(showAllActivities)}>All activities</SegmentedControlItem>
          </SegmentedControl>
        </div>
      ) : null}

      {connection.connected ? visibleActivities.length ? (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {visibleActivities.map((activity) => (
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
                  {format(new Date(activity.startedAt), 'EEE\u00A0d\u00A0MMM\u00A0yyyy\u00A0· HH:mm')}&nbsp;· {getSportLabel(activity.sport)}&nbsp;· {formatDuration(activity.durationSec)}
                  {activity.distanceMeters !== null ? `\u00A0· ${(activity.distanceMeters / 1000).toFixed(2)}\u00A0km` : ''}
                  {activity.elevationGainMeters !== null ? `\u00A0· ${Math.round(activity.elevationGainMeters)}\u00A0m up` : ''}
                </span>
              </span>
              {activity.imported ? <Badge tone="success">Imported</Badge> : activity.dismissed ? <Badge>Dismissed for now</Badge> : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="border-y border-[var(--border)] py-4 text-[13px] text-[var(--text-secondary)]">
          {showAllActivities ? 'No synced Strava activities yet.' : 'No activities need review.'}
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
                  {format(new Date(activeActivity.startedAt), 'EEE\u00A0d\u00A0MMM\u00A0yyyy\u00A0· HH:mm')}&nbsp;· {getSportLabel(activeActivity.sport)}&nbsp;· {formatDuration(activeActivity.durationSec)}
                  {activeActivity.distanceMeters !== null ? `\u00A0· ${(activeActivity.distanceMeters / 1000).toFixed(2)}\u00A0km` : ''}
                  {activeActivity.elevationGainMeters !== null ? `\u00A0· ${Math.round(activeActivity.elevationGainMeters)}\u00A0m up` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {activeActivity.imported ? <Badge tone="success">Imported</Badge> : null}
                <button
                  ref={closeButtonRef}
                  type="button"
                  className={`${secondaryButtonClassName} max-md:min-h-11`}
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
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricPair label="Original Strava sport" value={activeActivity.sportType} />
                    <MetricPair label="Duration" value={formatDuration(activeDetail.durationSec)} />
                    <MetricPair label="Distance" value={activeDetail.distanceMeters === null ? 'Not recorded' : `${(activeDetail.distanceMeters / 1000).toFixed(2)}\u00A0km`} />
                    <MetricPair label="Elevation gain" value={activeDetail.elevationGainMeters === null ? 'Not recorded' : `${Math.round(activeDetail.elevationGainMeters)}\u00A0m`} />
                    {formatStravaMetadata(activeDetail.metadata).map(([label, value]) => <MetricPair key={label} label={label} value={value} />)}
                  </dl>
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
                          {session.date ? `${format(new Date(session.date), 'd\u00A0MMM')} · ` : ''}{session.title}&nbsp;· {getSportLabel(session.sport)}
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
                {!activeActivity.imported ? <button type="button" className={`${secondaryButtonClassName} max-md:min-h-11`} disabled={Boolean(importing[activeActivity.id])} onClick={() => void reviewActivity(activeActivity.id, activeActivity.dismissed ? 'restore' : 'discard')}>
                  {activeActivity.dismissed ? 'Restore to inbox' : 'Dismiss for now'}
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

export function formatStravaMetadata(metadata: Record<string, unknown>) {
  const fields: Array<[string, unknown, (value: unknown) => string]> = [
    ['Strava sport', metadata.sportType, (value) => String(value)],
    ['Workout type', metadata.workoutType, (value) => String(value)],
    ['Moving time', metadata.movingTimeSec, (value) => formatDuration(Number(value))],
    ['Elevation high', metadata.elevationHighMeters, (value) => `${Math.round(Number(value))}\u00A0m`],
    ['Elevation low', metadata.elevationLowMeters, (value) => `${Math.round(Number(value))}\u00A0m`],
    ['Indoor trainer', metadata.trainer, (value) => value === true ? 'Yes' : 'No'],
    ['Commute', metadata.commute, (value) => value === true ? 'Yes' : 'No'],
    ['Calories', metadata.calories, (value) => `${Math.round(Number(value))}\u00A0kcal`],
    ['Average heart rate', metadata.averageHeartrate, (value) => `${Math.round(Number(value))}\u00A0bpm`],
    ['Peak heart rate', metadata.maxHeartrate, (value) => `${Math.round(Number(value))}\u00A0bpm`],
    ['Average speed', metadata.averageSpeed, (value) => `${(Number(value) * 3.6).toFixed(1)}\u00A0km/h`],
    ['Peak speed', metadata.maxSpeed, (value) => `${(Number(value) * 3.6).toFixed(1)}\u00A0km/h`],
    ['Average power', metadata.averageWatts, (value) => `${Math.round(Number(value))}\u00A0W`],
    ['Peak power', metadata.maxWatts, (value) => `${Math.round(Number(value))}\u00A0W`],
    ['Weighted power', metadata.weightedAverageWatts, (value) => `${Math.round(Number(value))}\u00A0W`],
    ['Average cadence', metadata.averageCadence, (value) => `${Math.round(Number(value))}\u00A0rpm`],
    ['Average temperature', metadata.averageTemp, (value) => `${Math.round(Number(value))} °C`],
    ['Total work', metadata.kilojoules, (value) => `${Math.round(Number(value))}\u00A0kJ`],
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
