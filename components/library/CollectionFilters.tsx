'use client';

import type { ReactNode, RefObject } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  buttonFocusClassName, formLabelClassName, formSelectClassName, ghostButtonClassName, iconButtonClassName,
  nativeDialogClassName, primaryButtonClassName, secondaryButtonClassName,
} from '@/components/ui';

/**
 * Filters for every workout collection (Public library and My workouts): one
 * Filters button beside search, active filters as removable chips, and a dialog
 * of chip groups with a sort select. Each tab supplies only the groups its data supports.
 */
export const filterChipClassName = (selected: boolean) => `inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors max-md:min-h-11 ${buttonFocusClassName} ${
  selected
    ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--text)] hover:bg-[var(--selection)]'
    : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--raised)] hover:text-[var(--text)]'
}`;

export function FiltersButton({ activeCount, onOpen }: { activeCount: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={activeCount ? `Filters, ${activeCount} active` : 'Filters'}
      className={`${secondaryButtonClassName} shrink-0 max-md:min-h-11`}
      onClick={onOpen}
    >
      <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={1.6} />
      Filters
      {activeCount ? <span aria-hidden="true" className="data inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[12px] font-semibold leading-5 text-[var(--signal-ink)]">{activeCount}</span> : null}
    </button>
  );
}

export function ActiveFilterChips({ chips }: { chips: { key: string; label: string; onRemove: () => void }[] }) {
  if (!chips.length) return null;
  return (
    <ul aria-label="Active filters" className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button type="button" aria-label={`Remove ${chip.label} filter`} className={filterChipClassName(true)} onClick={chip.onRemove}>
            {chip.label}<X aria-hidden="true" size={13} strokeWidth={1.8} className="text-[var(--text-muted)]" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function FilterChipGroup<T extends string>({ legend, options, selected, onToggle }: {
  legend: string;
  options: readonly { id: T; label: string; count?: number }[];
  selected: readonly T[];
  onToggle: (id: T) => void;
}) {
  return (
    <fieldset className="flex flex-col">
      <legend className={`${formLabelClassName} mb-2.5`}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.id} type="button" aria-pressed={selected.includes(option.id)} className={filterChipClassName(selected.includes(option.id))} onClick={() => onToggle(option.id)}>
            {option.label}{option.count === undefined ? null : <span className="data text-[12px] text-[var(--text-muted)]">{option.count}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SortSelect<T extends string>({ value, options, onChange }: { value: T; options: readonly { id: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <label className="flex flex-col gap-2.5">
      <span className={formLabelClassName}>Sort</span>
      <select className={`${formSelectClassName} max-md:min-h-11`} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function FiltersDialog({ dialogRef, titleId, resultCount, clearDisabled, onClear, children }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  titleId: string;
  resultCount: number;
  clearDisabled: boolean;
  onClear: () => void;
  children: ReactNode;
}) {
  const close = () => dialogRef.current?.close();
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`${nativeDialogClassName} w-[min(36rem,calc(100%-2rem))] border-[var(--border-strong)]`}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold text-[var(--text)]">Filters</h2>
        <button type="button" aria-label="Close filters" className={iconButtonClassName} onClick={close}>
          <X aria-hidden="true" size={18} strokeWidth={1.7} />
        </button>
      </div>
      <div className="flex flex-col gap-6 px-5 py-5">{children}</div>
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <button type="button" className={`${ghostButtonClassName('default')} max-md:min-h-11`} disabled={clearDisabled} onClick={onClear}>Clear filters</button>
        <button type="button" className={`${primaryButtonClassName} max-md:min-h-11`} onClick={close}>
          {`Show ${resultCount} ${resultCount === 1 ? 'workout' : 'workouts'}`}
        </button>
      </div>
    </dialog>
  );
}
