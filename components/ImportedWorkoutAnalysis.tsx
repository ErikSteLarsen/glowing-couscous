'use client';

import { useEffect, useId, useState } from 'react';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { dangerTextClassName, formFieldClassName, formLabelClassName, secondaryButtonClassName, sectionHeadingClassName } from '@/components/ui';
import { formatAnalysisDuration, formatAnalysisPace } from '@/lib/activity-analysis';
import { analysisTimelineSegments } from '@/lib/activity-analysis-view';
import type { ActivityAnalysisView, AnalysisCorrection } from '@/lib/activity-analysis-service';

export function ImportedWorkoutAnalysis({ activityId }: { activityId: number }) {
  const [view, setView] = useState<ActivityAnalysisView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const headingId = useId();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/activity-imports/${activityId}/analysis`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load the workout analysis.');
        if (!active) return;
        setView(data); setError('');
        if (['queued', 'processing', 'retry'].includes(data.status)) timer = setTimeout(() => { if (document.visibilityState === 'visible') void load(); else timer = setTimeout(() => void load(), 15000); }, 5000);
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Could not load the workout analysis.'); }
    }
    void load();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [activityId, revision]);

  async function request() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/activity-imports/${activityId}/analysis`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start the analysis. Try again.');
      setRevision(r => r + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Try again.'); }
    finally { setBusy(false); }
  }
  if (!view && !error) return <p role="status" className="text-sm text-[var(--text-secondary)]">Loading workout analysis…</p>;
  if (view && !view.eligible) return null;
  const pending = view && ['queued', 'processing', 'retry'].includes(view.status);
  const result = view?.result;
  const candidate = result?.candidates.find(c => c.id === result.selectedCandidateId);
  return <section aria-labelledby={headingId} className="space-y-4 border-b border-[var(--border)] pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id={headingId} className={sectionHeadingClassName}>Workout analysis</h3>
      {!pending && view?.eligible ? <button type="button" disabled={busy} className={secondaryButtonClassName} onClick={() => void request()}>{busy ? 'Starting…' : result ? 'Analyze again' : view.status === 'failed' ? 'Try again' : 'Analyze workout'}</button> : null}
    </div>
    {error ? <p role="alert" className={dangerTextClassName}>{error} <button className={secondaryButtonClassName} onClick={() => setRevision(r => r + 1)}>Reload</button></p> : null}
    {pending ? <p role="status" className="text-sm text-[var(--text-secondary)]">{view.status === 'retry' ? 'The analysis will try again shortly.' : 'Analyzing your workout…'} Your recorded data is below.</p> : null}
    {view?.error && !pending ? <p className="text-sm text-[var(--text-secondary)]">{view.error}</p> : null}
    {view?.eligible && view.status === 'not-requested' ? <p className="max-w-[68ch] text-sm text-[var(--text-secondary)]">Find the efforts and recoveries in your run. Interval numbers may be sent to an AI service. Your location and private notes are never sent.</p> : null}
    {result ? <>
      <p className="max-w-[68ch] text-sm leading-relaxed text-[var(--text)]">{result.summary}</p>
      <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <div><dt className="text-[var(--text-secondary)]">{result.workSummary.repetitions ? 'Average interval pace' : 'Average work pace'}</dt><dd className="metric-text mt-1 font-semibold">{formatAnalysisPace(result.workSummary.paceSecPerKm)}</dd></div>
        <div><dt className="text-[var(--text-secondary)]">Work time</dt><dd className="metric-text mt-1 font-semibold">{formatAnalysisDuration(result.workSummary.durationSec)}</dd></div>
        <div><dt className="text-[var(--text-secondary)]">Work distance</dt><dd className="metric-text mt-1 font-semibold">{result.workSummary.distanceMeters === null ? 'Not available' : `${(result.workSummary.distanceMeters / 1000).toFixed(2)}\u00A0km`}</dd></div>
      </dl>
      {result.workSummary.coverage < 0.95 ? <p className="text-sm text-[var(--text-secondary)]">Pace and distance only count parts with data – {Math.round(result.workSummary.coverage * 100)}% of work covered.</p> : null}
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-semibold">What you did</h4><span className="text-xs text-[var(--text-secondary)]">{result.intensityBasis === 'pace' ? 'Estimated pace zones' : result.intensityBasis === 'heart-rate' ? 'Recorded HR zones' : 'Intensity unknown'} – Actual times</span></div>
        <SessionBlockBar segments={analysisTimelineSegments(result)} size="authoring" />
        <p className="text-xs text-[var(--text-secondary)]">Width shows time. Height and color show estimated intensity. Uncolored bars have no intensity data.</p>
      </div>
      {candidate ? <p className="text-sm"><span className="font-semibold">Probably planned as: </span>{candidate.label}{candidate.recoverySec === null ? '' : ` with ${formatAnalysisDuration(candidate.recoverySec)} easy recovery`}</p> : null}
      {result.targetPaceSecPerKm ? <p className="text-sm text-[var(--text-secondary)]">Likely target pace is {formatAnalysisPace(result.targetPaceSecPerKm)}, from the middle of your efforts.</p> : null}
      <p className="text-sm text-[var(--text-secondary)]">{result.emphasis}&nbsp;– {result.confidence === 'moderate' ? 'Moderate' : 'Low'} confidence – {result.source === 'ai' ? 'Explained by AI from your data' : 'Calculated by Tempo'}</p>
      {view?.profileChanged ? <p className="text-sm text-[var(--text-secondary)]">Your Profile zones have changed since this analysis. Analyze again to use them.</p> : null}
      <details className="border-t border-[var(--border)] pt-3">
        <summary className="rounded-[var(--radius-control)] py-2 hover:bg-[var(--raised)] text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">Reps and details</summary>
        <div tabIndex={0} role="region" aria-label="Workout evidence, scroll horizontally to see all columns" className="mt-3 overflow-x-auto rounded-[var(--radius-control)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
          <table className="w-full text-left text-xs"><caption className="sr-only">Each part of the workout with its recorded data. Pace leaves out gaps in the data.</caption>
            <thead><tr className="border-b border-[var(--border)]">{['Part', 'Time', 'Duration', 'Pace /km', 'HR', 'Zones', 'Data'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-2 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{result.segments.map((s, i) => <tr key={s.id} className="border-b border-[var(--border)]"><th scope="row" className="whitespace-nowrap px-2 py-3 font-medium">{i + 1}.&nbsp;{({ warmup: 'Warm-up', work: 'Effort', recovery: 'Recovery', cooldown: 'Cool-down', unknown: 'Unknown' })[s.kind]}</th><td className="metric-text whitespace-nowrap px-2">{formatAnalysisDuration(s.startSec)}–{formatAnalysisDuration(s.endSec)}</td><td className="metric-text px-2">{formatAnalysisDuration(s.durationSec)}</td><td className="metric-text whitespace-nowrap px-2">{formatAnalysisPace(s.paceSecPerKm)}</td><td className="metric-text whitespace-nowrap px-2">{s.averageHrBpm === null ? '—' : `${Math.round(s.averageHrBpm)}\u00A0bpm`}</td><td className="whitespace-nowrap px-2"><span className="block">Pace {s.paceZone === null ? '—' : `Z${s.paceZone}`}</span><span className="block text-[var(--text-secondary)]">HR {s.hrZone === null ? '—' : `Z${s.hrZone}`}</span></td><td className="metric-text px-2">{Math.round(s.coverage * 100)}%</td></tr>)}</tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">{result.limitations.map(text => <li key={text}>{text}</li>)}</ul>
      </details>
      <AnalysisCorrectionForm activityId={activityId} saved={view?.correction ?? null} suggested={candidate?.durationSec ? { repetitions: result.workSummary.repetitions, durationSec: candidate.durationSec, recoverySec: candidate.recoverySec, paceSecPerKm: result.targetPaceSecPerKm === null ? null : Math.round(result.targetPaceSecPerKm) } : null} onSaved={() => setRevision(r => r + 1)} />
    </> : null}
  </section>;
}

function AnalysisCorrectionForm({ activityId, saved, suggested, onSaved }: { activityId: number; saved: AnalysisCorrection | null; suggested: AnalysisCorrection | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  return <details className="border-t border-[var(--border)] pt-3">
    <summary className="py-2 text-sm font-medium hover:bg-[var(--raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">{saved ? `Your plan: ${saved.repetitions} × ${formatAnalysisDuration(saved.durationSec)}` : 'What was the plan? Confirm or fix it'}</summary>
    <p className="my-3 text-xs text-[var(--text-secondary)]">This is saved on its own. It doesn’t change the analysis or your recorded data.</p>
    <form key={JSON.stringify(saved)} className="space-y-3" onSubmit={async event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      setBusy(true); setMessage('');
      try {
        const seconds = (name: string) => { const [m, s] = String(form.get(name)).split(':').map(Number); return m * 60 + s; };
        const data = { repetitions: Number(form.get('repetitions')), durationSec: seconds('durationSec'),
          recoverySec: form.get('recoverySec') ? seconds('recoverySec') : null, paceSecPerKm: form.get('paceSecPerKm') ? seconds('paceSecPerKm') : null };
        const response = await fetch(`/api/activity-imports/${activityId}/analysis`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save. Try again.');
        setMessage('Plan saved.'); onSaved();
      } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not save. Try again.'); }
      finally { setBusy(false); }
    }}>
      <div className="grid gap-3 sm:grid-cols-2">{([
        ['repetitions', 'Repetitions', 1, 100], ['durationSec', 'Effort duration (m:ss)', 1, 3600],
        ['recoverySec', 'Recovery (m:ss, optional)', 0, 3600], ['paceSecPerKm', 'Target pace (m:ss /km, optional)', 120, 1800],
      ] as const).map(([name, label, min, max]) => {
        const value = (saved ?? suggested)?.[name];
        return <label key={name}><span className={formLabelClassName}>{label}</span><input name={name} type={name === 'repetitions' ? 'number' : 'text'} inputMode={name === 'repetitions' ? 'numeric' : 'text'} pattern={name === 'repetitions' ? undefined : '[0-9]+:[0-5][0-9]'} min={min} max={max} step="1" required={name === 'repetitions' || name === 'durationSec'} defaultValue={value == null ? '' : name === 'repetitions' ? value : formatAnalysisDuration(value)} className={formFieldClassName} /></label>;
      })}</div>
      <button type="submit" disabled={busy} className={secondaryButtonClassName}>{busy ? 'Saving…' : 'Save plan'}</button>
      {message ? <p role="status" className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
    </form>
  </details>;
}
