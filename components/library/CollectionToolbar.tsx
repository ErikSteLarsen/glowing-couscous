'use client';

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { formFieldClassName } from '@/components/ui';

/** One toolbar for every workout collection: search on the left, the tab's own controls beside it. */
export function CollectionToolbar({ search, children }: { search: ReactNode; children?: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{search}{children}</div>;
}

export function CollectionSearch({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label: string; placeholder: string }) {
  return (
    <label className="relative min-w-48 flex-1 @2xl:max-w-md">
      <span className="sr-only">{label}</span>
      <Search aria-hidden="true" size={16} strokeWidth={1.6} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={80}
        className={`${formFieldClassName} pl-9 max-md:min-h-11`}
        autoComplete="off"
      />
    </label>
  );
}

/** Result count under the toolbar, with an optional reset action on the right. */
export function CollectionSummary({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--border)] pb-3">
      <p aria-live="polite" className="data text-[13px] text-[var(--text-muted)]">{children}</p>
      {action}
    </div>
  );
}
