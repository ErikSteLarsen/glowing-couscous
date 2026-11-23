import type { ReactNode } from 'react';

export function SessionRowText({
  title,
  meta,
  titleClassName = '',
}: {
  title: string;
  meta: ReactNode;
  titleClassName?: string;
}) {
  return (
    <span className="block min-w-0 wrap-anywhere">
      <span className={`block text-sm font-medium text-[var(--text)] ${titleClassName}`}>{title}</span>
      <span className="data mt-0.5 block text-xs text-[var(--text-muted)]">{meta}</span>
    </span>
  );
}
