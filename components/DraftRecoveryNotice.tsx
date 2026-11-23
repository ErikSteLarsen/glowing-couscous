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
    {candidates.length ? <section aria-label="Unsaved changes" className="space-y-3 rounded-[10px] border border-[var(--border)] p-4">
      <h2 className="text-base font-semibold">Pick up where you left off</h2>
      <p className="text-sm text-[var(--text-secondary)]">These unsaved changes are only on this device. Restore them, check them, then save.{onElapsed ? ' A workout in progress restores paused. Choose Count time away only if you kept training while away.' : ''}</p>
      {candidates.map((draft) => <div key={`${draft.resource}:${draft.writer}`} className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{draft.surface === 'workout' ? draft.resource === 'new' ? 'New workout' : 'Workout changes' : draft.surface === 'live' ? 'Workout in progress' : 'Profile changes'}&nbsp;– {new Date(draft.savedAt).toLocaleString()}</p>
        <div className="flex flex-wrap gap-3"><button type="button" disabled={disabled} className={secondaryButtonClassName} onClick={() => onRestore(draft)}>{onElapsed ? 'Restore (paused)' : 'Restore'}</button>{onElapsed ? <button type="button" disabled={disabled} className={secondaryButtonClassName} onClick={() => onElapsed(draft)}>Count time away</button> : null}<button type="button" disabled={disabled} className={secondaryButtonClassName} onClick={() => onDiscard(draft)}>Discard</button></div>
      </div>)}
    </section> : null}
    <DraftRecoveryStatus status={status} live={Boolean(onElapsed)} />
  </div>;
}

/** Where local recovery stands for the open form: kept on this browser, or unavailable. */
export function DraftRecoveryStatus({ status, live = false }: { status: 'idle' | 'kept' | 'unavailable'; live?: boolean }) {
  if (status === 'idle') return null;
  return <p role="status" className="text-sm text-[var(--text-secondary)]">{status === 'kept' ? live ? 'Your progress is backed up on this device. Choose Finish workout to save it.' : 'Your changes are backed up on this device until you save.' : live ? 'Tempo can’t back up your progress on this device. Keep this page open until you finish.' : 'Tempo can’t back up your changes on this device. Save before you leave this page.'}</p>;
}
