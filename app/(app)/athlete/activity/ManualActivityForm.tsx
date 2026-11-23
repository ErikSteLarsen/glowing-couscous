'use client';

import { useRef, useState, useSyncExternalStore, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ActionLink, buttonFocusClassName, formFieldClassName, formLabelClassName, formSelectClassName, formTextareaClassName, primaryButtonClassName, successTextClassName } from '@/components/ui';
import { formatDuration } from '@/lib/format-duration';
import { SPORT_OPTIONS, getSportLabel } from '@/lib/sport';

const subscribeToNoChanges = () => () => {};
const getBrowserLocalDay = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export function ManualActivityForm({ today }: { today: string }) {
  const router = useRouter();
  const requestKey = useRef(crypto.randomUUID());
  const localToday = useSyncExternalStore(subscribeToNoChanges, getBrowserLocalDay, () => today);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const completedOn = selectedDate ?? localToday;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ href: string; title: string } | null>(null);
  const [candidates, setCandidates] = useState<Array<{ id: number; title: string; date: string; plannedDurationSec: number }>>([]);
  const [candidateState, setCandidateState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [pairingChoice, setPairingChoice] = useState('');
  const [selectedSport, setSelectedSport] = useState('RUNNING');
  const [title, setTitle] = useState('');
  const candidateRequest = useRef(0);
  const selectedCandidate = candidates.find((candidate) => String(candidate.id) === pairingChoice);

  async function loadCandidates(sport: string, day: string) {
    const requestId = ++candidateRequest.current;
    setCandidates([]);
    setPairingChoice('');
    setCandidateState('loading');
    try {
      const response = await fetch(`/api/athlete/activities?sport=${encodeURIComponent(sport)}&completedOn=${encodeURIComponent(day)}`);
      const body: unknown = await response.json();
      if (requestId === candidateRequest.current && response.ok && body && typeof body === 'object' && 'candidates' in body && Array.isArray(body.candidates)) {
        setCandidates(body.candidates);
        setCandidateState('ready');
      } else if (requestId === candidateRequest.current) setCandidateState('error');
    } catch {
      if (requestId === candidateRequest.current) setCandidateState('error');
    }
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !pairingChoice || candidateState === 'loading') return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const activityTitle = selectedCandidate?.title ?? String(formData.get('title'));
    setPending(true);
    setError('');
    setSaved(null);
    try {
      const response = await fetch('/api/athlete/activities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sport: formData.get('sport'),
          title: activityTitle,
          completedOn: formData.get('completedOn'),
          durationMinutes: Number(formData.get('durationMinutes')),
          distanceKm: formData.get('distanceKm') ? Number(formData.get('distanceKm')) : null,
          rpe: formData.get('rpe') ? Number(formData.get('rpe')) : null,
          notes: formData.get('notes'),
          pairingChoice: pairingChoice === 'separate' ? 'separate' : Number(pairingChoice),
          requestKey: requestKey.current,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok || !body || typeof body !== 'object' || !('href' in body) || !('sessionId' in body)) {
        setError(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Could not save this activity. Your entries are still here; try again.');
        return;
      }
      const href = String(body.href);
      requestKey.current = crypto.randomUUID();
      setSaved({ href, title: activityTitle });
      form.reset();
      setSelectedDate(null);
      setPairingChoice('');
      setCandidates([]);
      setCandidateState('idle');
      setSelectedSport('RUNNING');
      setTitle('');
      router.refresh();
    } catch {
      setError('Could not save this activity. Your entries are still here; try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2">
        <span className={formLabelClassName}>Sport</span>
        <select name="sport" value={selectedSport} onChange={(event) => { setSelectedSport(event.target.value); void loadCandidates(event.target.value, completedOn); }} className={`${formSelectClassName} max-md:min-h-11`} required>
          {SPORT_OPTIONS.filter((sport) => sport !== 'REST').map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}
        </select>
      </label>
      <label className="space-y-2">
        <span className={formLabelClassName}>{selectedCandidate ? 'Planned workout title' : 'Title'}</span>
        <input name="title" value={selectedCandidate?.title ?? title} onChange={(event) => setTitle(event.target.value)} className={`${formFieldClassName} max-md:min-h-11`} maxLength={120} required readOnly={Boolean(selectedCandidate)} placeholder="Easy morning run" />
        {selectedCandidate ? <span className="text-xs text-[var(--text-muted)]">The planned workout title and content stay unchanged.</span> : null}
      </label>
      <label className="space-y-2">
        <span className={formLabelClassName}>Completion date</span>
        <input name="completedOn" type="date" value={completedOn} onChange={(event) => { setSelectedDate(event.target.value); void loadCandidates(selectedSport, event.target.value); }} className={`${formFieldClassName} max-md:min-h-11`} required />
      </label>
      <label className="space-y-2">
        <span className={formLabelClassName}>Time spent (minutes)</span>
        <input name="durationMinutes" type="number" min={1} max={1440} step={1} className={`${formFieldClassName} max-md:min-h-11`} required />
      </label>
      <details className="border-y border-[var(--border)] sm:col-span-2" onInvalid={(event) => { event.currentTarget.open = true; }}>
        <summary className={`min-h-11 rounded-lg py-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--raised)] ${buttonFocusClassName}`}>More details</summary>
        <div className="grid gap-4 pb-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className={formLabelClassName}>Distance (km, optional)</span>
            <input name="distanceKm" type="number" min={0.01} max={1000} step={0.01} className={`${formFieldClassName} max-md:min-h-11`} placeholder="5.2" />
          </label>
          <label className="space-y-2">
            <span className={formLabelClassName}>Effort (RPE, optional)</span>
            <select name="rpe" defaultValue="" className={`${formSelectClassName} max-md:min-h-11`}>
              <option value="">Not recorded</option>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-2 sm:col-span-2">
            <span className={formLabelClassName}>Notes (optional)</span>
            <textarea name="notes" rows={3} maxLength={2000} className={formTextareaClassName} placeholder="How it felt, route, or other details" />
          </label>
        </div>
      </details>
      <fieldset className="space-y-2 sm:col-span-2" aria-label="Planned session choice">
        <legend className={formLabelClassName}>Planned session</legend>
        {candidateState === 'idle' ? <p className="text-sm text-[var(--text-muted)]">Check for a planned session on this date, or keep the activity separate.</p> : null}
        {candidateState === 'idle' || candidateState === 'error' ? <button type="button" onClick={() => void loadCandidates(selectedSport, completedOn)} className={`min-h-11 rounded-lg text-sm text-[var(--brand)] underline underline-offset-4 hover:text-[var(--text)] ${buttonFocusClassName}`}>Check planned sessions</button> : null}
        {candidateState === 'loading' ? <p className="text-sm text-[var(--text-muted)]">Checking planned sessions…</p> : null}
        {candidateState === 'error' ? <p role="alert" className="text-sm text-[var(--status-danger)]">Could not check planned sessions. Retry or keep this activity separate.</p> : null}
        {candidateState === 'ready' && candidates.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No eligible planned session for this sport and date.</p> : null}
        {candidates.map((candidate) => <label key={candidate.id} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] max-md:min-h-11"><input type="radio" name="pairing-choice" value={`session:${candidate.id}`} checked={pairingChoice === String(candidate.id)} onChange={() => setPairingChoice(String(candidate.id))} /><span>{candidate.title} · {candidate.date} · {candidate.plannedDurationSec > 0 ? `Planned ${formatDuration(candidate.plannedDurationSec)}` : 'No planned duration'}</span></label>)}
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] max-md:min-h-11"><input type="radio" name="pairing-choice" value="separate" checked={pairingChoice === 'separate'} onChange={() => setPairingChoice('separate')} /><span>Keep as a separate activity</span></label>
        {selectedCandidate ? <p className="text-sm text-[var(--text-muted)]">Saving will complete this planned session and record a duration-only result.</p> : null}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending || !pairingChoice || candidateState === 'loading'} className={`${primaryButtonClassName} max-md:min-h-11`}>{pending ? 'Saving activity…' : pairingChoice === 'separate' ? 'Save separate activity' : selectedCandidate ? 'Complete planned session' : 'Choose how to save'}</button>
        {saved ? <span role="status" className={successTextClassName}>Saved. <ActionLink href={saved.href} tone="ghost">Review {saved.title}</ActionLink></span> : null}
        {error ? <p role="alert" className="text-sm text-[var(--status-danger)]">{error}</p> : null}
      </div>
    </form>
  );
}
