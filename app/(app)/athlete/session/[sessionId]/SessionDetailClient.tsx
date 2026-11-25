'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
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
  sectionHeadingClassName,
  successTextClassName,
  Surface,
} from '@/components/ui';
import { updateSessionEditorFields, type SessionEditorDraft } from '@/lib/session-editor';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { useAdjustRequest } from './SessionActions';

export function SessionDetailClient({
  sessionId,
  initialDone,
  isSkipped = false,
  unplanned = false,
  initialNotes,
  initialDraft,
  id,
  performanceProfile = null,
  compliancePct = null,
  isRecorded = false,
}: {
  sessionId: number;
  initialDone: boolean;
  isSkipped?: boolean;
  /** Never planned: without its result it leaves the Calendar. */
  unplanned?: boolean;
  initialNotes: string;
  initialDraft: SessionEditorDraft;
  id?: string;
  performanceProfile?: PerformanceProfile | null;
  compliancePct?: number | null;
  /** The outcome holds measured data owned by its recording or import; only its note is editable here. */
  isRecorded?: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const isDone = initialDone;
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [isPending, startTransition] = useTransition();

  // The header ⋯ menu asks for the planned-adjustment editor; open it once per request.
  const adjustRequest = useAdjustRequest();
  const [handledAdjustRequest, setHandledAdjustRequest] = useState(adjustRequest);
  if (adjustRequest !== handledAdjustRequest) {
    setHandledAdjustRequest(adjustRequest);
    if (!isDone && !isSkipped && !isRecorded) {
      setDraft(updateSessionEditorFields(initialDraft, { athleteNotes: notes }));
      setIsEditing(true);
    }
  }

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
          const payload = await response.json().catch(() => ({ error: 'Could not save. Try again.' }));
          setMessageTone('danger');
          setMessage(payload.error ?? 'Could not save. Try again.');
          return;
        }

        if (unplanned && !nextDone) {
          router.replace('/athlete/calendar');
          router.refresh();
          return;
        }
        setMessageTone('success');
        setMessage(isRecorded ? 'Note saved.' : nextDone ? 'Workout marked as done.' : 'Workout marked as not done.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach Tempo. Check your connection and try again.');
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
          const payload = await response.json().catch(() => ({ error: `Could not save ${isDone ? 'your result' : 'your changes'}. Try again.` }));
          setMessageTone('danger');
          setMessage(payload.error ?? 'Could not save your changes. Try again.');
          return;
        }

        setNotes(draft.athleteNotes.trim());
        setIsEditing(false);
        setMessageTone('success');
        setMessage(isDone ? 'Result updated.' : 'Changes to this workout saved.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach Tempo. Check your connection and try again.');
      }
    });
  }

  if (isSkipped) {
    return (
      <Surface id={id} className="scroll-mt-20 space-y-3 md:scroll-mt-6">
        <h2 className={sectionHeadingClassName}>Skipped</h2>
        <p className="text-[13px] text-[var(--text-secondary)]">
          You skipped this workout, so there’s no result to log. Choose Plan again to change it, start it or mark it as done.
        </p>
      </Surface>
    );
  }

  return (
    <Surface id={id} className="scroll-mt-20 space-y-4 md:scroll-mt-6">
      {isEditing ? null : <div>
        <h2 className={sectionHeadingClassName}>{isDone ? 'Result' : 'How did it go?'}</h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          {isRecorded ? (
            <>
              This result comes from a recorded activity. You can edit the note. The recorded data stays as it is.{' '}
              {unplanned ? 'To remove the ride, choose Delete ride in the ⋯ menu.' : (
                <>
                  To remove the activity, delete it on the{' '}
                  <Link href="/athlete/import" className="text-[var(--brand)] underline-offset-4 hover:underline">Import</Link> page.
                </>
              )}
            </>
          ) : isDone ? 'Check your result, or fix what was logged.' : 'Add a note if you like, then mark the workout as done.'}
          {isDone && compliancePct !== null ? ` Plan compliance: ${Math.round(compliancePct)}%.` : ''}
        </p>
      </div>}

      {!isEditing && isDone ? (
        <div className="flex flex-wrap gap-3 max-md:[&>button]:min-h-11">
          <SessionComparisonDialog
            sessionId={sessionId}
            endpoint={`/api/athlete/sessions/${sessionId}/comparison`}
            label={unplanned ? 'Compare workout and result' : undefined}
          />
          {isRecorded ? null : (
            <button type="button" className={compactSecondaryButtonClassName} disabled={isPending} onClick={() => {
              setDraft(updateSessionEditorFields(initialDraft, { athleteNotes: notes }));
              setIsEditing(true);
            }}>
              Fix result
            </button>
          )}
        </div>
      ) : null}

      {isEditing ? (
        // Marks the open editor so the page layout gives it the full width.
        <div data-session-editing="" className="space-y-4 border-t border-[var(--border)] pt-4">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">{isDone ? 'Fix result' : 'Change this workout'}</p>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
              {isDone
                ? 'Change what you actually did. The plan stays as it was, and the workout stays done.'
                : 'Only this planned workout changes. Your saved workout stays as it is.'}
            </p>
          </div>
          <WorkoutBuilder
            draft={draft}
            onChange={setDraft}
            showSchedule
            summaryPlaceholder="Purpose, or why you changed it"
            performanceProfile={performanceProfile}
          />
          <label className="block space-y-2">
            <span className={formLabelClassName}>Your note</span>
            <textarea
              value={draft.athleteNotes}
              onChange={(event) => setDraft(updateSessionEditorFields(draft, { athleteNotes: event.target.value }))}
              className={`${formTextareaClassName} min-h-24`}
              placeholder="What changed, and how did it feel?"
            />
          </label>
          <label className="block space-y-2">
            <span className={formLabelClassName}>{isDone ? 'RPE you felt (1–10)' : 'Planned RPE (1–10)'}</span>
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
          <div className="flex flex-wrap gap-3 max-md:[&>button]:min-h-11">
            <button type="button" className={secondaryButtonClassName} onClick={() => { setDraft(initialDraft); setIsEditing(false); }} disabled={isPending}>
              Cancel
            </button>
            <button type="button" className={primaryButtonClassName} onClick={saveEditor} disabled={isPending}>
              {isPending ? 'Saving…' : isDone ? 'Save result' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : null}

      {!isEditing ? (
        <>
          <label className="block space-y-2">
            <span className={formLabelClassName}>Note</span>
            <textarea
              id="session-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`${formTextareaClassName} min-h-28`}
              placeholder="How did it feel?"
            />
          </label>

          <div className="flex flex-wrap gap-3 max-md:[&>button]:min-h-11">
            <button
              type="button"
              onClick={() => save(true)}
              disabled={isPending}
              className={primaryButtonClassName}
            >
              {isDone ? 'Save note' : 'Mark as done'}
            </button>
            {isDone && !isRecorded ? (
              <button
                type="button"
                onClick={() => { if (!unplanned || window.confirm('Remove this workout from your Calendar? It wasn’t planned, so its result is deleted.')) save(false); }}
                disabled={isPending}
                className={secondaryButtonClassName}
              >
                {unplanned ? 'Remove from Calendar' : 'Mark as not done'}
              </button>
            ) : null}
            {isDone ? null : (
              <SessionComparisonDialog
                sessionId={sessionId}
                endpoint={`/api/athlete/sessions/${sessionId}/comparison`}
              />
            )}
          </div>
        </>
      ) : null}

      {message ? <p role={messageTone === 'success' ? 'status' : 'alert'} aria-live="polite" className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}
    </Surface>
  );
}
