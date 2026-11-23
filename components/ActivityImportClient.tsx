'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ActivityMetricPreview } from '@/components/ActivityMetricPreview';
import { formatStravaMetadata, StravaImportPanel } from '@/components/StravaImportPanel';
import { EmptyState, Surface, buttonFocusClassName, dangerButtonClassName, dangerTextClassName, formFieldClassName, formLabelClassName, ghostButtonClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
import { parseActivityFile, type ImportedActivityFile } from '@/lib/activity-file-parser';
import type { ImportableSession, ImportedActivityHistory } from '@/lib/activity-import-service';
import type { StravaConnectionSummary } from '@/lib/strava-service';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';

type ImportDraft = {
  key: string;
  filename: string;
  activity: ImportedActivityFile;
  plannedSessionId: number | null;
  error: string | null;
  importing: boolean;
  analyzeWorkout?: boolean;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES_PER_PICK = 10;

export function ActivityImportClient({
  initialActivities,
  plannedSessions,
  initialStravaConnection,
}: {
  initialActivities: ImportedActivityHistory[];
  plannedSessions: ImportableSession[];
  initialStravaConnection: StravaConnectionSummary;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [parsing, setParsing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedTelemetry, setLoadedTelemetry] = useState<Record<number, NonNullable<ImportedActivityHistory['telemetry']>>>({});
  const [loadingTelemetry, setLoadingTelemetry] = useState<Record<number, boolean>>({});
  const [telemetryErrors, setTelemetryErrors] = useState<Record<number, string>>({});
  const [deletingActivityId, setDeletingActivityId] = useState<number | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  async function loadTelemetry(activityId: number) {
    if (loadedTelemetry[activityId] || loadingTelemetry[activityId]) return;
    setLoadingTelemetry((current) => ({ ...current, [activityId]: true }));
    setTelemetryErrors((current) => ({ ...current, [activityId]: '' }));
    try {
      const response = await fetch(`/api/activity-imports/${activityId}`);
      const result = await response.json() as { error?: string; telemetry?: NonNullable<ImportedActivityHistory['telemetry']> };
      if (!response.ok || !result.telemetry) throw new Error(result.error || 'Measurements could not be loaded.');
      setLoadedTelemetry((current) => ({ ...current, [activityId]: result.telemetry! }));
    } catch (error) {
      setTelemetryErrors((current) => ({ ...current, [activityId]: error instanceof Error ? error.message : 'Measurements could not be loaded.' }));
    } finally {
      setLoadingTelemetry((current) => ({ ...current, [activityId]: false }));
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setFileError(null);
    setNotice(null);
    const selected = Array.from(files);
    if (selected.length > MAX_FILES_PER_PICK) {
      setFileError(`Choose up to ${MAX_FILES_PER_PICK} files at a time.`);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setParsing(true);
    const parsed: ImportDraft[] = [];
    const seenKeys = new Set(drafts.map((draft) => draft.key));
    for (const file of selected) {
      const key = `${file.name}-${file.lastModified}-${file.size}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      try {
        if (file.size > MAX_FILE_SIZE) throw new Error('Files must be 20 MB or smaller.');
        if (!/\.(fit|tcx|gpx)$/i.test(file.name)) throw new Error('Choose a .FIT, .TCX, or .GPX activity file.');
        const activity = parseActivityFile(file.name, await file.arrayBuffer());
        parsed.push({ key, filename: file.name, activity, plannedSessionId: null, error: null, importing: false });
      } catch (error) {
        parsed.push({
          key,
          filename: file.name,
          activity: emptyActivity(),
          plannedSessionId: null,
          error: error instanceof Error ? error.message : 'This activity file could not be read.',
          importing: false,
        });
      }
    }
    setDrafts((current) => [...current, ...parsed]);
    setParsing(false);
    if (fileInput.current) fileInput.current.value = '';
  }

  function updateDraft(key: string, update: Partial<ImportDraft>) {
    setDrafts((current) => current.map((draft) => draft.key === key ? { ...draft, ...update } : draft));
  }

  async function importActivity(draft: ImportDraft) {
    updateDraft(draft.key, { importing: true, error: null });
    setNotice(null);
    try {
      const response = await fetch('/api/activity-imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft.activity, plannedSessionId: draft.plannedSessionId, analyzeWorkout: draft.analyzeWorkout === true }),
      });
      const result = await response.json() as { error?: string; activityId?: number; sessionId?: number };
      if (!response.ok) throw new Error(result.error || 'The activity could not be imported.');
      setDrafts((current) => current.filter((item) => item.key !== draft.key));
      setNotice(`${draft.activity.title} was added to your completed activities.`);
      router.refresh();
    } catch (error) {
      updateDraft(draft.key, {
        importing: false,
        error: error instanceof Error ? error.message : 'The activity could not be imported. Try again.',
      });
    }
  }

  async function deleteImportedActivity(activity: ImportedActivityHistory) {
    const message = activity.standalone
      ? 'Delete this imported activity and its standalone completed session?'
      : 'Delete this imported activity? Its recorded measurements will be removed and the planned session restored to its previous state.';
    if (!window.confirm(message)) return;
    setDeletingActivityId(activity.id);
    setHistoryError(null);
    setHistoryNotice(null);
    try {
      const response = await fetch(`/api/activity-imports/${activity.id}`, { method: 'DELETE' });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'The imported activity could not be deleted.');
      setLoadedTelemetry((current) => {
        const next = { ...current };
        delete next[activity.id];
        return next;
      });
      setHistoryNotice(`${activity.title} was removed from your imports.`);
      router.refresh();
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'The imported activity could not be deleted. Try again.');
    } finally {
      setDeletingActivityId(null);
    }
  }

  return (
    <>
      <Surface id="activity-files" className="scroll-mt-20 space-y-4">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text)]">Activity files</h2>
          <p className="mt-1 max-w-[72ch] text-[13px] leading-[1.5] text-[var(--text-secondary)]">
            Choose FIT, TCX, or GPX files, then review them before saving. You can match them to planned sessions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".fit,.FIT,.tcx,.TCX,.gpx,.GPX"
            multiple
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={(event) => void addFiles(event.currentTarget.files)}
          />
          <button type="button" className={`${primaryButtonClassName} max-md:min-h-11`} disabled={parsing} onClick={() => fileInput.current?.click()}>
            {parsing ? 'Reading files…' : 'Choose activity files'}
          </button>
          <p className="text-[12px] text-[var(--text-secondary)]">Up to 10 files at a time, 20 MB each</p>
        </div>
        {fileError ? <p role="alert" className={dangerTextClassName}>{fileError}</p> : null}
        {notice ? <p role="status" className="text-sm text-[var(--status-success)]">{notice}</p> : null}
        <p className="text-[12px] leading-[1.5] text-[var(--text-muted)]">
          The original file is read in this browser and is not uploaded or kept. After import, Tempo stores the validated activity summary and sensor samples with your completed session until you delete the import.
        </p>
      </Surface>

      {drafts.length ? (
        <section aria-label="Files ready to import" className="space-y-4">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text)]">Review before importing</h2>
          {drafts.map((draft) => (
            <Surface key={draft.key} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <p className="break-words text-[15px] font-semibold text-[var(--text)]">{draft.activity.title || draft.filename}</p>
                  <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{draft.filename}</p>
                </div>
                <button
                  type="button"
                  className={`${secondaryButtonClassName} max-md:min-h-11`}
                  onClick={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))}
                >
                  Remove
                </button>
              </div>
              {draft.error ? (
                <p role="alert" className={dangerTextClassName}>{draft.error}</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryValue label="Sport" value={getSportLabel(draft.activity.sport)} />
                    <SummaryValue label="Started" value={format(new Date(draft.activity.startedAt), 'EEE d MMM · HH:mm')} />
                    <SummaryValue label="Duration" value={formatDuration(draft.activity.durationSec)} />
                    <SummaryValue label="Distance" value={draft.activity.distanceMeters === null ? 'Not recorded' : `${(draft.activity.distanceMeters / 1000).toFixed(2)}\u00A0km`} />
                    {draft.activity.elevationGainMeters !== null ? (
                      <SummaryValue label="Elevation gain" value={`${Math.round(draft.activity.elevationGainMeters)}\u00A0m`} />
                    ) : null}
                  </div>
                  <label className="block">
                    <span className={formLabelClassName}>Activity name</span>
                    <input
                      className={`${formFieldClassName} max-md:min-h-11`}
                      value={draft.activity.title}
                      maxLength={140}
                      onChange={(event) => updateDraft(draft.key, { activity: { ...draft.activity, title: event.target.value } })}
                    />
                  </label>
                  <label className="block">
                  <span className={formLabelClassName}>Same-sport session to complete</span>
                    <select
                      className={`${formFieldClassName} max-md:min-h-11`}
                      value={draft.plannedSessionId ?? ''}
                      onChange={(event) => updateDraft(draft.key, { plannedSessionId: event.target.value ? Number(event.target.value) : null })}
                    >
                      <option value="">Create a new completed session</option>
                      {plannedSessions.filter((session) => session.sport === draft.activity.sport).map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.date ? `${format(new Date(session.date), 'd\u00A0MMM')} · ` : ''}{session.title}&nbsp;· {getSportLabel(session.sport)}
                        </option>
                      ))}
                    </select>
                    {plannedSessions.every((session) => session.sport !== draft.activity.sport) ? (
                      <p className="mt-1 text-[12px] text-[var(--text-secondary)]">No unfinished planned session for this sport is available, so this activity will become a new completed session.</p>
                    ) : null}
                  </label>
                  <ActivityMetricPreview points={draft.activity.points} durationSec={draft.activity.durationSec} distanceMeters={draft.activity.distanceMeters} sport={draft.activity.sport} />
                  {draft.activity.sport === 'RUNNING' ? <label className="flex min-h-11 items-start gap-3 text-sm text-[var(--text)]">
                    <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--brand)]" checked={draft.analyzeWorkout === true} onChange={event => updateDraft(draft.key, { analyzeWorkout: event.target.checked })} />
                    <span><span className="block font-medium">Interpret intervals after import</span><span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)]">Use a device-original file you have permission to analyze. Calculated interval metrics may be sent to the configured AI provider; location and private notes are excluded.</span></span>
                  </label> : null}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      {draft.plannedSessionId ? 'The selected session’s planned workout stays available for comparison.' : 'Tempo will create a completed session with this activity data.'}
                    </p>
                    <button type="button" className={`${primaryButtonClassName} max-md:min-h-11`} disabled={draft.importing} onClick={() => void importActivity(draft)}>
                      {draft.importing ? 'Importing…' : 'Import activity'}
                    </button>
                  </div>
                </>
              )}
            </Surface>
          ))}
        </section>
      ) : null}

      <StravaImportPanel initialConnection={initialStravaConnection} plannedSessions={plannedSessions} />

      <section aria-labelledby="import-history-heading" className="space-y-4">
        <div>
          <h2 id="import-history-heading" className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text)]">Import history</h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Saved Strava and file imports are included in your completed activity history.</p>
        </div>
        {historyNotice ? <p role="status" className="text-sm text-[var(--status-success)]">{historyNotice}</p> : null}
        {historyError ? <p role="alert" className={dangerTextClassName}>{historyError}</p> : null}
        {initialActivities.length === 0 ? (
          <EmptyState title="No imports yet" description="Review a Strava activity above or choose a FIT, TCX, or GPX file to add your first activity." />
        ) : (
          <div className="space-y-3">
            {initialActivities.map((activity) => (
              <details
                key={activity.id}
                className="group border-b border-[var(--border)] py-3 first:border-t"
                onToggle={(event) => {
                  if (event.currentTarget.open) void loadTelemetry(activity.id);
                  else setLoadedTelemetry((current) => {
                    const next = { ...current };
                    delete next[activity.id];
                    return next;
                  });
                }}
              >
                <summary className={`flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--raised)] [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="block break-words text-[15px] font-semibold text-[var(--text)]">{activity.title}</span>
                    <span className="mt-1 block text-[12px] text-[var(--text-secondary)]">
                      {format(new Date(activity.completedAt), 'EEE\u00A0d\u00A0MMM\u00A0yyyy\u00A0· HH:mm')}&nbsp;· {getSportLabel(activity.sport)}&nbsp;· {formatDuration(activity.durationSec)}&nbsp;· {activity.source === 'strava' ? 'Strava' : 'File'}
                      {activity.distanceMeters !== null ? `\u00A0· ${(activity.distanceMeters / 1000).toFixed(2)}\u00A0km` : ''}
                      {activity.sessionTitle !== activity.title ? ` · Matched to ${activity.sessionTitle}` : ''}
                    </span>
                  </span>
                  <span className="text-[12px] font-medium text-[var(--brand)]">
                    <span className="group-open:hidden">Show measurements</span>
                    <span className="hidden group-open:inline">Hide measurements</span>
                  </span>
                </summary>
                <div className="mt-4 space-y-5 border-t border-[var(--border)] pt-4">
                  {loadingTelemetry[activity.id] ? (
                    <p role="status" className="text-[13px] text-[var(--text-secondary)]">Loading activity measurements…</p>
                  ) : telemetryErrors[activity.id] ? (
                    <p role="alert" className={dangerTextClassName}>{telemetryErrors[activity.id]}</p>
                  ) : loadedTelemetry[activity.id] ? (
                    <ActivityMetricPreview
                      points={loadedTelemetry[activity.id].points}
                      durationSec={activity.durationSec}
                      distanceMeters={activity.distanceMeters}
                      sport={activity.sport}
                    />
                  ) : null}
                  {activity.source === 'strava' && activity.sourceMetadata ? (
                    <section aria-label="Imported Strava activity details" className="space-y-3">
                      <h3 className="text-[13px] font-semibold text-[var(--text)]">Strava activity details</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {formatStravaMetadata(activity.sourceMetadata).map(([label, value]) => (
                          <SummaryValue key={label} label={label} value={value} />
                        ))}
                      </div>
                    </section>
                  ) : null}
                  <Link className={`${ghostButtonClassName('default')} max-md:min-h-11`} href={`/athlete/session/${activity.sessionId}?from=imports`}>
                    Review completed session
                  </Link>
                  <button
                    type="button"
                    className={`${dangerButtonClassName} max-md:min-h-11`}
                    disabled={deletingActivityId !== null}
                    onClick={() => void deleteImportedActivity(activity)}
                  >
                    {deletingActivityId === activity.id ? 'Deleting…' : 'Delete imported activity'}
                  </button>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-[var(--border)] pl-3">
      <p className="text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
      <p className="metric-text mt-1 text-[15px] font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}

function emptyActivity(): ImportedActivityFile {
  return { title: '', sport: 'OTHER', startedAt: '', durationSec: 0, distanceMeters: null, elevationGainMeters: null, points: [] };
}
