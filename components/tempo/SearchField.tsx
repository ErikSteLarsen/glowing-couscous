import type { ComponentProps } from 'react';
import { Search } from 'lucide-react';
import { formFieldClassName, formLabelClassName } from '@/components/ui';

type SearchFieldProps = Omit<ComponentProps<'input'>, 'type'> & {
  label: string;
  visibleLabel?: boolean;
  labelClassName?: string;
};

export function SearchField({ label, visibleLabel, labelClassName = '', className = '', ...props }: SearchFieldProps) {
  return (
    <label className={`block ${labelClassName}`}>
      <span className={visibleLabel ? formLabelClassName : 'sr-only'}>{label}</span>
      <span className="relative block">
        <Search aria-hidden="true" size={16} strokeWidth={1.6} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input type="search" className={`${formFieldClassName} pl-9 ${className}`} {...props} />
      </span>
    </label>
  );
}
