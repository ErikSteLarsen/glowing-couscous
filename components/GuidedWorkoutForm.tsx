'use client';

import { useEffect, useState } from 'react';

import { formLabelClassName, formSelectClassName, primaryButtonClassName, secondaryButtonClassName, dangerTextClassName } from '@/components/ui';
import { GUIDED_DURATIONS, GUIDED_INTENSITIES, GUIDED_SPORTS, type GuidedWorkoutInput } from '@/lib/guided-workout';
import { getSportLabel } from '@/lib/sport';
import { normalizeSessionEditorDraft, type SessionEditorDraft } from '@/lib/session-editor';

export type GuidedWorkoutInfo = { source: 'ai' | 'guided'; selectedPattern: string; reason: string; context: string };

export function GuidedWorkoutForm({ onGenerated, onCancel }: {
  onGenerated: (draft: SessionEditorDraft, info: GuidedWorkoutInfo) => void;
  onCancel: () => void;
}) {
  const [sport, setSport] = useState<GuidedWorkoutInput['sport']>('RUNNING');
  const [durationMinutes, setDurationMinutes] = useState<GuidedWorkoutInput['durationMinutes']>(45);
  const [intensity, setIntensity] = useState<GuidedWorkoutInput['intensity']>('easy');
  const [intervals, setIntervals] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [aiStatus, setAiStatus] = useState<'available' | 'unavailable' | 'checking'>('checking');

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function check(attempt: number) {
      try {
        const response = await fetch('/api/athlete/workouts/ai-status');
        const value = response.ok ? await response.json() as { status?: string } : null;
        if (!active) return;
        const status = value?.status === 'available' ? 'available' : value?.status === 'checking' ? 'checking' : 'unavailable';
        setAiStatus(status);
        if (status === 'checking' && attempt < 3) timer = setTimeout(() => void check(attempt + 1), 2_000);
      } catch { if (active) setAiStatus('unavailable'); }
    }
    void check(0);
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, []);

  async function generate() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/athlete/workouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, durationMinutes, intensity, intervals }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; draft?: SessionEditorDraft } & Partial<GuidedWorkoutInfo>;
      if (!response.ok || !result.ok || !result.draft || !result.source || !result.selectedPattern || !result.reason || !result.context) {
        setError(result.error ?? 'Could not build a workout. Try again.');
        return;
      }
      onGenerated(normalizeSessionEditorDraft(result.draft), {
        source: result.source,
        selectedPattern: result.selectedPattern,
        reason: result.reason,
        context: result.context,
      });
    } catch {
      setError('Could not reach Tempo. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return <section aria-labelledby="guided-workout-title" className="space-y-5 border-y border-[var(--border)] bg-[var(--surface)] px-4 py-5 sm:px-6">
    <div className="space-y-1">
      <h3 id="guided-workout-title" className="text-base font-semibold text-[var(--text)]">Build a guided workout</h3>
      <p className="max-w-[65ch] text-sm leading-6 text-[var(--text-secondary)]">Pick four things. Tempo looks at your last four weeks of training and suggests a workout you can edit before you save it. When AI is on, Tempo sends a short summary of that training to an AI service. Your notes and recorded data stay in Tempo.</p>
      <p role="status" className="text-sm font-medium text-[var(--text)]">{aiStatus === 'available' ? 'AI is on. It designs the whole workout.' : aiStatus === 'checking' ? 'Checking whether AI is on. You can build a workout either way.' : 'AI is off. Tempo builds the workout from its standard patterns.'}</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block space-y-2"><span className={formLabelClassName}>Sport</span><select className={formSelectClassName} value={sport} disabled={pending} onChange={(event) => setSport(event.target.value as GuidedWorkoutInput['sport'])}>{GUIDED_SPORTS.map((option) => <option key={option} value={option}>{getSportLabel(option)}</option>)}</select></label>
      <label className="block space-y-2"><span className={formLabelClassName}>Length</span><select className={formSelectClassName} value={durationMinutes} disabled={pending} onChange={(event) => setDurationMinutes(Number(event.target.value) as GuidedWorkoutInput['durationMinutes'])}>{GUIDED_DURATIONS.map((option) => <option key={option} value={option}>{option} minutes</option>)}</select></label>
      <label className="block space-y-2"><span className={formLabelClassName}>Effort</span><select className={formSelectClassName} value={intensity} disabled={pending} onChange={(event) => setIntensity(event.target.value as GuidedWorkoutInput['intensity'])}>{GUIDED_INTENSITIES.map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</select></label>
      <fieldset className="space-y-2"><legend className={formLabelClassName}>Intervals</legend><div className="flex min-h-10 items-center gap-4 text-sm text-[var(--text)]"><label className="inline-flex items-center gap-2"><input type="radio" name="guided-intervals" checked={!intervals} disabled={pending} onChange={() => setIntervals(false)} />No</label><label className="inline-flex items-center gap-2"><input type="radio" name="guided-intervals" checked={intervals} disabled={pending} onChange={() => setIntervals(true)} />Yes</label></div></fieldset>
    </div>
    {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={primaryButtonClassName} disabled={pending} onClick={generate}>{pending ? 'Building workout…' : 'Build workout'}</button>
      <button type="button" className={secondaryButtonClassName} disabled={pending} onClick={onCancel}>Cancel</button>
      <span className="text-xs leading-5 text-[var(--text-secondary)]">Nothing is saved until you choose Save workout.</span>
    </div>
  </section>;
}
