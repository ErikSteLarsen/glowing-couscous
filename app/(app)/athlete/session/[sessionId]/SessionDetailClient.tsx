'use client';

import { SessionComparisonDialog } from '@/components/SessionComparisonDialog';
import { Surface, sectionHeadingClassName } from '@/components/ui';

export function SessionDetailClient({
  sessionId,
  isDone,
  notes,
  compliancePct,
  isImportedWithoutWorkout = false,
}: {
  sessionId: number;
  isDone: boolean;
  notes: string;
  compliancePct: number | null;
  isImportedWithoutWorkout?: boolean;
}) {
  if (isImportedWithoutWorkout) {
    const activityNotes = notes.trim();
    if (!activityNotes) return null;

    return (
      <Surface id="session-outcome" className="space-y-3">
        <h2 className={sectionHeadingClassName}>Activity notes</h2>
        <p className="border-t border-[var(--border)] pt-4 text-[13px] leading-[1.55] text-[var(--text)] whitespace-pre-wrap break-words">
          {activityNotes}
        </p>
      </Surface>
    );
  }

  return (
    <Surface id="session-outcome" className="space-y-4">
      <div>
        <h2 className={sectionHeadingClassName}>Outcome</h2>
        <p className="mt-1 text-[13px] leading-[1.5] text-[var(--text-secondary)]">
          {isDone ? 'Saved from your completed session.' : 'Your completion and notes will appear here after you finish the live session.'}
        </p>
      </div>

      {isDone ? (
        <>
          {notes ? (
            <blockquote className="border-t border-[var(--border)] pt-4 text-[13px] leading-[1.55] text-[var(--text)]">
              {notes}
            </blockquote>
          ) : (
            <p className="border-t border-[var(--border)] pt-4 text-[13px] text-[var(--text-secondary)]">
              No session note was recorded.
            </p>
          )}
          {compliancePct !== null ? (
            <p className="text-[12px] text-[var(--text-secondary)]">Plan compliance: {Math.round(compliancePct)}%</p>
          ) : null}
          <SessionComparisonDialog
            sessionId={sessionId}
            endpoint={`/api/athlete/sessions/${sessionId}/comparison`}
          />
        </>
      ) : (
        <p className="border-t border-[var(--border)] pt-4 text-[13px] leading-[1.5] text-[var(--text-secondary)]">
          The workout plan stays unchanged here. Use Start live to follow the blocks and record the outcome.
        </p>
      )}
    </Surface>
  );
}
