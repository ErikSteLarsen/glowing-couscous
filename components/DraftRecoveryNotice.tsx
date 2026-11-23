'use client';

import { secondaryButtonClassName } from '@/components/ui';
import type { RecoveryDraft } from '@/lib/draft-recovery';

export function DraftRecoveryNotice({ candidates, status, onRestore, onDiscard, onElapsed, disabled = false }: {
  candidates: RecoveryDraft[]; status: 'idle' | 'kept' | 'unavailable';
  onRestore: (draft: RecoveryDraft) => void; onDiscard: (draft: RecoveryDraft) => void;
  disabled?: boolean;
  onElapsed?: (draft: RecoveryDraft) => void;
}) {
  return <div className="space-y-3">
    {candidates.length ? <section aria-label="Recoverable drafts" className="space-y-3 rounded-[10px] border border-[var(--border)] p-4">
      <h2 className="text-base font-semibold">Recover unfinished work</h2>
      <p className="text-sm text-[var(--text-secondary)]">These drafts are kept on this browser only. Review them before saving.{onElapsed ? ' Live restores paused. Count elapsed time only if you continued exercising while away.' : ''}</p>
      {candidates.map((draft) => <div key={`${draft.resource}:${draft.writer}`} className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{draft.surface === 'workout' ? draft.resource === 'new' ? 'New workout' : 'Workout edit' : draft.surface === 'live' ? 'Live checkpoint' : 'Profile changes'}&nbsp;· {new Date(draft.savedAt).toLocaleString()}</p>
        <div className="flex flex-wrap gap-3"><button type="button" disabled={disabled} className={secondaryButtonClassName} onClick={() => onRestore(draft)}>{onElapsed ? 'Restore paused' : 'Restore'}</button>{onElapsed ? <button type="button" disabled={disabled} className={secondaryButtonClassName} onClick={() => onElapsed(draft)}>Count elapsed time</button> : null}<button type="button" disabled={disabled} className={secondaryButtonClassName} onClick={() => onDiscard(draft)}>Discard draft</button></div>
      </div>)}
    </section> : null}
    <DraftRecoveryStatus status={status} live={Boolean(onElapsed)} />
  </div>;
}

/** Where local recovery stands for the open form: kept on this browser, or unavailable. */
export function DraftRecoveryStatus({ status, live = false }: { status: 'idle' | 'kept' | 'unavailable'; live?: boolean }) {
  if (status === 'idle') return null;
  return <p role="status" className="text-sm text-[var(--text-secondary)]">{status === 'kept' ? live ? 'Checkpoint kept on this browser. Finish workout saves the session outcome.' : 'Draft kept on this browser. Save to update your account.' : live ? 'Local recovery is unavailable. Keep this page open to preserve Live progress.' : 'Local recovery is unavailable. Keep this page open and save your changes before leaving.'}</p>;
}
