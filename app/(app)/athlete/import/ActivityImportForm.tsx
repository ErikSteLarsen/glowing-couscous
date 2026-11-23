'use client';

import { MetricPair } from '@/components/tempo/MetricPair';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { sectionHeadingClassName, ActionLink, formFieldClassName, primaryButtonClassName } from '@/components/ui';
import { getSportLabel } from '@/lib/sport';
import { formatDuration } from '@/lib/format-duration';
import { formatActivityDateTime } from '@/lib/tcx-time';

type Preview = {
  activity: {
    sport: string;
    title: string;
    startedAt: string;
    completedAt: string;
    completedOn: string;
    sourceTimezoneOffsetMinutes: number;
    durationSec: number;
    distanceMeters: number | null;
  };
  duplicate: boolean;
  sessionId?: number;
  candidates: Array<{ id: number; title: string; date: string; plannedDurationSec: number }>;
  sourceFormat: 'tcx' | 'fit' | 'gpx';
};

class ImportRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function distanceLabel(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2).replace(/\.00$/, '')}\u00A0km` : `${meters}\u00A0m`;
}

export function ActivityImportForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [savedHref, setSavedHref] = useState('');
  const [pairingChoice, setPairingChoice] = useState('');
  const [gpxSelected, setGpxSelected] = useState(false);
  const [gpxSport, setGpxSport] = useState('');

  async function request(url: string, body: FormData) {
    const response = await fetch(url, { method: 'POST', body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new ImportRequestError(typeof result.error === 'string' ? result.error : 'Could not import this activity. Try again.', response.status);
    return result;
  }

  async function previewFile() {
    const file = inputRef.current?.files?.[0];
    if (!file) { setError('Choose a .tcx, .fit, or .gpx activity file.'); return; }
    const isGpx = file.name.toLowerCase().endsWith('.gpx');
    if (isGpx && !gpxSport) { setError('Choose Running, Cycling, or Swimming for this GPX activity.'); return; }
    setPending(true);
    setError('');
    setPreview(null);
    setPairingChoice('');
    setSavedHref('');
    try {
      const form = new FormData();
      form.set('file', file);
      if (isGpx) form.set('sport', gpxSport);
      const result = await request('/api/athlete/activities/import/preview', form);
      if (result.sourceFormat === 'gpx' && result.duplicate) setGpxSport(result.activity.sport);
      setPreview(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this activity file.');
    } finally { setPending(false); }
  }

  async function confirmImport() {
    const file = inputRef.current?.files?.[0];
    if (!file || !preview || preview.duplicate || !pairingChoice) return;
    setPending(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('confirmed', 'true');
      form.set('pairingChoice', pairingChoice);
      if (preview.sourceFormat === 'gpx') form.set('sport', gpxSport);
      const result = await request('/api/athlete/activities/import', form);
      const href = String(result.href ?? '');
      setSavedHref(href);
      setPreview(null);
      setGpxSelected(false);
      setGpxSport('');
      if (inputRef.current) inputRef.current.value = '';
      router.refresh();
    } catch (cause) {
      if (cause instanceof ImportRequestError && cause.status === 409) {
        setPreview(null);
        setPairingChoice('');
      }
      setError(cause instanceof Error ? cause.message : 'Could not save this activity. Your file is still selected; try again.');
    } finally { setPending(false); }
  }

  return (
    <div className="space-y-4 border-t border-[var(--border)] pt-4">
      <div>
        <h2 className={sectionHeadingClassName}>Import activity summary</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">Save the activity summary and file source. For sensor samples and running workout analysis, use Choose activity files above.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-2">
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">TCX, FIT, or GPX file (5 MB maximum)</span>
          <input ref={inputRef} type="file" accept=".tcx,.fit,.gpx,application/vnd.garmin.tcx+xml,application/gpx+xml,application/xml,text/xml,application/octet-stream" disabled={pending} onChange={(event) => { const selected = event.currentTarget.files?.[0]; setGpxSelected(selected?.name.toLowerCase().endsWith('.gpx') ?? false); setGpxSport(''); setPreview(null); setPairingChoice(''); setSavedHref(''); setError(''); }} className={`${formFieldClassName} h-auto min-h-10 py-2 max-md:min-h-11 file:mr-3 file:rounded-md file:border-0 file:bg-[var(--raised)] control-hover:file:bg-[var(--selection)] file:px-3 file:py-1 file:text-sm file:text-[var(--text)]`} />
        </label>
        {gpxSelected ? (
          <label className="min-w-0 space-y-2 sm:w-48">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">Activity type</span>
            <select value={gpxSport} onChange={(event) => { setGpxSport(event.target.value); setPreview(null); setPairingChoice(''); setError(''); }} disabled={pending} className={`${formFieldClassName} max-md:min-h-11`} required>
              <option value="">Choose a sport</option>
              <option value="RUNNING">Running</option>
              <option value="BIKING">Cycling</option>
              <option value="SWIMMING">Swimming</option>
            </select>
          </label>
        ) : null}
        <button type="button" onClick={previewFile} disabled={pending || (gpxSelected && !gpxSport)} className={`${primaryButtonClassName} max-md:min-h-11`}>{pending && !preview ? 'Reading file…' : 'Review activity'}</button>
      </div>
      {gpxSelected ? <p className="text-xs text-[var(--text-muted)]">GPX does not reliably identify sport. Choose the activity type before review.</p> : null}
      {preview ? (
        <section aria-labelledby="activity-preview-heading" className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 id="activity-preview-heading" className="font-medium text-[var(--text)]">Review before saving</h3>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Sport', getSportLabel(preview.activity.sport)],
              ['Activity', preview.activity.title],
              ['Recorded start', formatActivityDateTime(preview.activity.startedAt, preview.activity.sourceTimezoneOffsetMinutes)],
              [preview.sourceFormat === 'tcx' ? 'Estimated finish' : 'Recorded finish', formatActivityDateTime(preview.activity.completedAt, preview.activity.sourceTimezoneOffsetMinutes)],
              ['Timezone source', preview.sourceFormat === 'fit' ? 'FIT Activity local timestamp' : preview.sourceFormat === 'gpx' ? 'Timed GPX trackpoints' : 'TCX start timestamp offset'],
              ['Duration', formatDuration(preview.activity.durationSec)],
              [preview.sourceFormat === 'gpx' ? 'Track distance' : 'Distance', preview.activity.distanceMeters === null ? 'Not recorded' : distanceLabel(preview.activity.distanceMeters)],
            ].map(([label, value]) => <MetricPair key={label} label={label} value={value} />)}
          </dl>
          <p className="text-sm text-[var(--text-muted)]">{preview.sourceFormat === 'fit' ? 'Finish time comes from the FIT Session summary. Calendar placement uses the local completion date derived from the FIT Activity local timestamp.' : preview.sourceFormat === 'gpx' ? 'Start, finish, duration, and track distance come from timed GPS points. Tempo discards their coordinates after import and uses the trackpoint UTC offset for Calendar placement.' : 'Finish time is estimated from the recorded start time and activity duration. Calendar placement uses the activity’s local completion date.'}</p>
          {!preview.duplicate ? <fieldset className="space-y-2" aria-label="Activity pairing choice">
            <legend className="font-medium text-sm text-[var(--text)]">How should this activity be saved?</legend>
            <label className="flex gap-3 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--text-secondary)]">
              <input type="radio" name="pairingChoice" value="separate" checked={pairingChoice === 'separate'} onChange={() => setPairingChoice('separate')} />
              <span><span className="block text-[var(--text)]">Keep as separate activity</span><span>Save it without changing a planned session.</span></span>
            </label>
            {preview.candidates.map((candidate) => <label key={candidate.id} className="flex gap-3 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--text-secondary)]">
              <input type="radio" name="pairingChoice" value={`session:${candidate.id}`} checked={pairingChoice === `session:${candidate.id}`} onChange={() => setPairingChoice(`session:${candidate.id}`)} />
              <span><span className="block text-[var(--text)]">{candidate.title}&nbsp;· {format(new Date(`${candidate.date}T12:00:00.000Z`), 'EEE\u00A0d\u00A0MMM\u00A0yyyy')}</span><span>Planned duration {formatDuration(candidate.plannedDurationSec)}</span></span>
            </label>)}
            {preview.candidates.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No open self-planned {getSportLabel(preview.activity.sport).toLowerCase()} sessions on {preview.activity.completedOn}.</p> : null}
          </fieldset> : null}
          {preview.duplicate ? (
            <p role="status" className="text-sm text-[var(--text-secondary)]">This file was already imported. <ActionLink href={`/athlete/session/${preview.sessionId}?from=activity`} tone="ghost">Review saved activity</ActionLink></p>
          ) : <button type="button" onClick={confirmImport} disabled={pending || !pairingChoice} className={`${primaryButtonClassName} max-md:min-h-11`}>{pending ? 'Saving activity…' : 'Confirm and import activity'}</button>}
        </section>
      ) : null}
      {savedHref ? <p role="status" className="text-sm text-[var(--status-success)]">Activity imported. <ActionLink href={savedHref} tone="ghost">Review outcome</ActionLink></p> : null}
      {error ? <p role="alert" className="text-sm text-[var(--status-danger)]">{error}</p> : null}
    </div>
  );
}
