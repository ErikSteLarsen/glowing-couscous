'use client';

import type { ReactNode } from 'react';

/** One toolbar for every workout collection: search on the left, the tab's own controls beside it. */
export function CollectionToolbar({ search, children }: { search: ReactNode; children?: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{search}{children}</div>;
}

/** Result count under the toolbar, with an optional reset action on the right. */
/** `heading` names the list when it is more than "N workouts"; the count then sits beside it. */
export function CollectionSummary({ heading, children, action }: { heading?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--border)] pb-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-1">
        {heading}
        <p aria-live="polite" className="data text-[13px] text-[var(--text-muted)]">{children}</p>
      </div>
      {action}
    </div>
  );
}
