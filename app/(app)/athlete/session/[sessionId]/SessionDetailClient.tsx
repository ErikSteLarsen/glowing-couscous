'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { WorkoutBuilder } from '@/components/WorkoutBuilder';
import { SessionComparisonDialog } from '@/components/SessionComparisonDialog';
import {
  compactSecondaryButtonClassName,
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  formTextareaClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  successTextClassName,
  Surface,
} from '@/components/ui';
import { updateSessionEditorFields, type SessionEditorDraft } from '@/lib/session-editor';
import type { PerformanceProfile } from '@/lib/performance-profile';

export function SessionDetailClient({
  sessionId,
  initialDone,
  initialNotes,
  initialDraft,
  id,
  performanceProfile = null,
}: {
  sessionId: number;
  initialDone: boolean;
  initialNotes: string;
  initialDraft: SessionEditorDraft;
  id?: string;
  performanceProfile?: PerformanceProfile | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [isDone, setIsDone] = useState(initialDone);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [isPending, startTransition] = useTransition();

  function save(nextDone: boolean) {
    setMessage('');
    setMessageTone('success');
    startTransition(async () => {
      try {
        const response = await fetch(`/api/athlete/sessions/${sessionId}/completion`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isDone: nextDone,
            notes,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: 'Failed to update completion' }));
          setMessageTone('danger');
          setMessage(payload.error ?? 'Failed to update completion');
          return;
        }

        setIsDone(nextDone);
        setMessageTone('success');
        setMessage(nextDone ? 'Session marked complete.' : 'Session moved back to planned.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  function saveEditor() {
    setMessage('');
    setMessageTone('success');
    startTransition(async () => {
      try {
        const response = await fetch(`/api/athlete/sessions/${sessionId}${isDone ? '/actual' : ''}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: `Failed to save ${isDone ? 'actual correction' : 'session adjustment'}` }));
          setMessageTone('danger');
          setMessage(payload.error ?? 'Failed to save session adjustment');
          return;
        }

        setIsEditing(false);
        setMessageTone('success');
        setMessage(isDone ? 'Actual correction saved.' : 'Planned session adjustment saved.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  return (
    <Surface id={id} className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Completion
        </p>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
          {isDone ? 'Review the outcome or correct what was recorded.' : 'Add a note, then complete the session.'}
        </p>
      </div>

      {!isEditing ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" className={compactSecondaryButtonClassName} onClick={() => setIsEditing(true)}>
            {isDone ? 'Correct completed outcome' : 'Adjust planned session'}
          </button>
          <SessionComparisonDialog
            sessionId={sessionId}
            endpoint={`/api/athlete/sessions/${sessionId}/comparison`}
          />
        </div>
      ) : null}

      {isEditing ? (
        <div className="space-y-4 border-t border-[var(--border)] pt-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{isDone ? 'Actual correction' : 'Planned adjustment'}</p>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
              {isDone
                ? 'Correct what was actually completed. The coach baseline and completed status stay intact.'
                : 'Only this scheduled session changes. The coach baseline and reusable source stay intact.'}
            </p>
          </div>
          <WorkoutBuilder
            draft={draft}
            onChange={setDraft}
            showSchedule
            summaryPlaceholder="Session intent or adjustment context"
            performanceProfile={performanceProfile}
          />
          <label className="block space-y-2">
            <span className={formLabelClassName}>Athlete note</span>
            <textarea
              value={draft.athleteNotes}
              onChange={(event) => setDraft(updateSessionEditorFields(draft, { athleteNotes: event.target.value }))}
              className={`${formTextareaClassName} min-h-24`}
              placeholder="What should your coach know?"
            />
          </label>
          <label className="block space-y-2">
            <span className={formLabelClassName}>Planned RPE (1-10)</span>
            <input
              type="number"
              min="1"
              max="10"
              step="1"
              value={draft.rpe ?? ''}
              onChange={(event) => setDraft(updateSessionEditorFields(draft, { rpe: event.target.value ? Number(event.target.value) : null }))}
              className={formFieldClassName}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={secondaryButtonClassName} onClick={() => { setDraft(initialDraft); setIsEditing(false); }} disabled={isPending}>
              Cancel
            </button>
            <button type="button" className={primaryButtonClassName} onClick={saveEditor} disabled={isPending}>
              {isPending ? 'Saving...' : isDone ? 'Save actual correction' : 'Save adjustment'}
            </button>
          </div>
        </div>
      ) : null}

      {!isEditing ? (
        <>
          <label className="block space-y-2">
            <span className={formLabelClassName}>Session note</span>
            <textarea
              id="session-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`${formTextareaClassName} min-h-28`}
              placeholder="How did the session feel?"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => save(true)}
              disabled={isPending}
              className={primaryButtonClassName}
            >
              {isDone ? 'Update completion' : 'Mark complete'}
            </button>
            {isDone ? (
              <button
                type="button"
                onClick={() => save(false)}
                disabled={isPending}
                className={secondaryButtonClassName}
              >
                Mark planned again
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {message ? <p role={messageTone === 'success' ? 'status' : 'alert'} aria-live="polite" className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}
    </Surface>
  );
}
