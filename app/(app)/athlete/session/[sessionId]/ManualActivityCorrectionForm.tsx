'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  formTextareaClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  successTextClassName,
} from '@/components/ui';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';

type ManualUnplannedDraft = {
  kind: 'manual-unplanned';
  title: string;
  sport: string;
  completedOn: string;
  durationMinutes: string;
  distanceKm: string;
  rpe: string;
  notes: string;
};

type ManualPairedDraft = {
  kind: 'manual-paired';
  plannedTitle: string;
  plannedDate: string;
  durationMinutes: string;
  distanceKm: string;
  rpe: string;
  notes: string;
};

export type ManualActivityCorrectionDraft = ManualUnplannedDraft | ManualPairedDraft;

type ManualUnplannedChanges = Partial<Omit<ManualUnplannedDraft, 'kind'>>;
type ManualPairedChanges = Partial<Pick<ManualPairedDraft, 'durationMinutes' | 'distanceKm' | 'rpe' | 'notes'>>;

export function ManualActivityCorrectionForm({
  activityId,
  initialUpdatedAt,
  initialDraft,
}: {
  activityId: number;
  initialUpdatedAt: string;
  initialDraft: ManualActivityCorrectionDraft;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const [isConflict, setIsConflict] = useState(false);
  const [saved, setSaved] = useState(false);

  function clearFeedback() {
    setError('');
    setIsConflict(false);
    setSaved(false);
  }

  function updateUnplannedDraft(update: ManualUnplannedChanges) {
    setDraft((current) => current.kind === 'manual-unplanned' ? { ...current, ...update } : current);
    clearFeedback();
  }

  function updatePairedDraft(update: ManualPairedChanges) {
    setDraft((current) => current.kind === 'manual-paired' ? { ...current, ...update } : current);
    clearFeedback();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError('');
    setIsConflict(false);
    setSaved(false);

    const payload = {
      expectedUpdatedAt: updatedAt,
      durationMinutes: Number(draft.durationMinutes),
      distanceKm: draft.distanceKm.trim() ? Number(draft.distanceKm) : null,
      rpe: draft.rpe ? Number(draft.rpe) : null,
      notes: draft.notes,
      ...(draft.kind === 'manual-unplanned'
        ? { title: draft.title, sport: draft.sport, completedOn: draft.completedOn }
        : {}),
    };

    try {
      const response = await fetch(`/api/athlete/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : 'Could not save your changes. Your entries are still here. Try again.');
        setIsConflict(response.status === 409);
        return;
      }
      if (!body || typeof body !== 'object' || !('updatedAt' in body) || typeof body.updatedAt !== 'string') {
        setError('Your changes were saved, but Tempo couldn’t confirm the latest version. Reload the page before you edit again.');
        setIsConflict(true);
        router.refresh();
        return;
      }

      setUpdatedAt(body.updatedAt);
      setSavedDraft(draft);
      setIsEditing(false);
      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not reach Tempo. Your entries are still here. Try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-3">
      {!isEditing ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={secondaryButtonClassName} disabled={isPending} onClick={() => { setDraft(savedDraft); setError(''); setSaved(false); setIsEditing(true); }}>
            Edit activity
          </button>
          {saved ? <span role="status" className={successTextClassName}>Changes saved.</span> : null}
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <p className="text-sm font-medium text-[var(--text)]">Edit activity</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
              {draft.kind === 'manual-unplanned'
                ? 'Change the details you logged. Activities logged by hand have no TSS.'
                : 'Change what you did. The planned workout, its date and its steps stay as they are.'}
            </p>
          </div>

          {draft.kind === 'manual-unplanned' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className={formLabelClassName}>Sport</span>
                <select value={draft.sport} onChange={(event) => updateUnplannedDraft({ sport: event.target.value })} className={formSelectClassName} required>
                  {SPORT_OPTIONS.filter((sport) => sport !== 'REST').map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className={formLabelClassName}>Title</span>
                <input value={draft.title} onChange={(event) => updateUnplannedDraft({ title: event.target.value })} className={formFieldClassName} maxLength={120} required />
              </label>
              <label className="space-y-2">
                <span className={formLabelClassName}>Date</span>
                <input type="date" value={draft.completedOn} onChange={(event) => updateUnplannedDraft({ completedOn: event.target.value })} className={formFieldClassName} required />
              </label>
              <label className="space-y-2">
                <span className={formLabelClassName}>Duration (minutes)</span>
                <input type="number" min={1} max={1440} step={1} value={draft.durationMinutes} onChange={(event) => updateUnplannedDraft({ durationMinutes: event.target.value })} className={formFieldClassName} required />
              </label>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Planned workout: {draft.plannedTitle}&nbsp;· {draft.plannedDate}</p>
          )}

          {draft.kind === 'manual-paired' ? (
            <label className="block space-y-2">
              <span className={formLabelClassName}>Duration (minutes)</span>
              <input type="number" min={1} max={1440} step={1} value={draft.durationMinutes} onChange={(event) => updatePairedDraft({ durationMinutes: event.target.value })} className={formFieldClassName} required />
            </label>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className={formLabelClassName}>Distance (km, optional)</span>
              <input type="number" min={0.01} max={1000} step={0.001} value={draft.distanceKm} onChange={(event) => draft.kind === 'manual-unplanned' ? updateUnplannedDraft({ distanceKm: event.target.value }) : updatePairedDraft({ distanceKm: event.target.value })} className={formFieldClassName} placeholder="5.2" />
            </label>
            <label className="space-y-2">
              <span className={formLabelClassName}>RPE (optional)</span>
              <select value={draft.rpe} onChange={(event) => draft.kind === 'manual-unplanned' ? updateUnplannedDraft({ rpe: event.target.value }) : updatePairedDraft({ rpe: event.target.value })} className={formSelectClassName}>
                <option value="">Not recorded</option>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-2">
            <span className={formLabelClassName}>Notes (optional)</span>
            <textarea value={draft.notes} onChange={(event) => draft.kind === 'manual-unplanned' ? updateUnplannedDraft({ notes: event.target.value }) : updatePairedDraft({ notes: event.target.value })} className={`${formTextareaClassName} min-h-24`} maxLength={2000} />
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="button" className={secondaryButtonClassName} onClick={() => { setDraft(savedDraft); setError(''); setIsEditing(false); }} disabled={isPending}>Cancel</button>
            <button type="submit" className={primaryButtonClassName} disabled={isPending}>{isPending ? 'Saving…' : 'Save changes'}</button>
          </div>
          {error ? <p role="alert" className="text-sm text-[var(--status-danger)]">{error}</p> : null}
          {isConflict ? <button type="button" className="text-sm text-[var(--accent)] underline underline-offset-4 hover:text-[var(--text)]" onClick={() => window.location.reload()}>Discard your changes and reload</button> : null}
        </form>
      )}
    </div>
  );
}
