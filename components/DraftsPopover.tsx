'use client';

import { History } from 'lucide-react';
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from '@ui-sdk/react/popover';
import { buttonFocusClassName, compactSecondaryButtonClassName, ghostButtonClassName } from '@/components/ui';
import { formatDraftAge } from '@/lib/draft-recovery';

export type DraftEntry = { key: string; name: string; kind: string; savedAt: number };

/**
 * Header chip for drafts kept on this browser. Hidden when there are none; opens a
 * popover listing each draft by name and age with explicit Restore and Discard.
 */
export function DraftsPopover({ drafts, now, disabled = false, onRestore, onDiscard }: {
  drafts: DraftEntry[]; now: number; disabled?: boolean;
  onRestore: (key: string) => void; onDiscard: (key: string) => void;
}) {
  if (drafts.length === 0) return null;
  const count = `${drafts.length} unsaved ${drafts.length === 1 ? 'workout' : 'workouts'}`;
  return (
    <Popover>
      <PopoverTrigger
        className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-3 text-[13px] font-medium text-[var(--text)] transition-colors hover:border-[var(--status-warning)] max-md:min-h-11 ${buttonFocusClassName}`}
      >
        <History aria-hidden="true" size={15} strokeWidth={1.7} className="text-[var(--status-warning)]" />
        {count}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        collisionPadding={12}
        className="z-50 m-0 w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--border-strong)] ${overlayPanelClassName} p-0"
      >
        <div className="border-b border-[var(--border)] px-4 py-3">
          <PopoverTitle className="text-sm font-semibold">{count}</PopoverTitle>
          <PopoverDescription className="mt-0.5 text-[12px] text-[var(--text-secondary)]">These changes are only on this device. Restore one to keep editing, then save it.</PopoverDescription>
        </div>
        <ul className="max-h-[min(22rem,60dvh)] divide-y divide-[var(--border)] overflow-y-auto">
          {drafts.map((draft) => (
            <li key={draft.key} className="flex flex-col gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{draft.name}</p>
                <p className="text-[12px] text-[var(--text-muted)]">
                  {draft.kind} · <time dateTime={new Date(draft.savedAt).toISOString()} title={new Date(draft.savedAt).toLocaleString()}>{formatDraftAge(draft.savedAt, now)}</time>
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={disabled} aria-label={`Restore changes to ${draft.name}`} className={`${compactSecondaryButtonClassName} max-md:min-h-11`} onClick={() => onRestore(draft.key)}>Restore</button>
                <button type="button" disabled={disabled} aria-label={`Discard changes to ${draft.name}`} className={`${ghostButtonClassName('compact')} max-md:min-h-11`} onClick={() => onDiscard(draft.key)}>Discard</button>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
