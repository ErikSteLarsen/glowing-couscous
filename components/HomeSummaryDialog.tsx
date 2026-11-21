'use client';

import type { ReactNode } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog';
import { buttonFocusClassName, iconButtonClassName, sectionHeadingClassName } from '@/components/ui';

/**
 * A Home summary tile that opens its full view in a dialog. The tile is the
 * trigger, so focus returns to it when the dialog closes. Phones get a
 * full-width bottom sheet; wider screens a centered panel. The body scrolls
 * inside the dialog, never the page.
 */
export function HomeSummaryDialog({
  label,
  title,
  description,
  summary,
  children,
  className = '',
}: {
  /** Visible tile heading. */
  label: string;
  /** Dialog title; defaults to the tile label. */
  title?: string;
  description?: ReactNode;
  /** Compact tile content: a value, a sparkline, one line. */
  summary: ReactNode;
  /** Full view shown in the dialog. */
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={`tile group flex min-w-0 flex-col gap-3 rounded-2xl p-4 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--raised)] ${buttonFocusClassName} ${className}`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm text-[var(--text-secondary)]">{label}</span>
          <span className="inline-flex items-center gap-0.5 text-xs text-[var(--text-muted)] group-hover:text-[var(--text)]">
            Details
            <ChevronRight aria-hidden="true" size={14} strokeWidth={1.8} />
          </span>
        </span>
        {summary}
      </DialogTrigger>
      <DialogBackdrop className="fixed inset-0 bg-black/60" />
      <DialogContent className="fixed inset-x-0 bottom-0 mx-auto grid max-h-[calc(100dvh-1rem)] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-overlay)] outline-none md:inset-y-0 md:my-auto md:h-fit md:max-h-[calc(100dvh-4rem)] md:w-[calc(100%-4rem)] md:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 pt-5 pb-4">
          <div className="min-w-0">
            <DialogTitle className={sectionHeadingClassName}>{title ?? label}</DialogTitle>
            {description ? <DialogDescription className="mt-1 text-[13px] text-[var(--text-muted)]">{description}</DialogDescription> : null}
          </div>
          <DialogClose type="button" className={iconButtonClassName} aria-label="Close">
            <X aria-hidden="true" size={18} />
          </DialogClose>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
