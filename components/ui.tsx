import Link from 'next/link';
import { ReactNode } from 'react';

const pageShellWidthClasses = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-[1140px]',
  wall: 'max-w-[1440px]',
} as const;

export const formLabelClassName = 'mb-1.5 block text-sm font-medium text-[var(--text-secondary)]';
export const formFieldClassName =
  'min-h-11 w-full rounded-[10px] border border-[var(--field-border)] bg-[var(--field-surface)] px-4 py-2.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]';
export const formSelectClassName = `${formFieldClassName} pr-10`;
export const formTextareaClassName =
  'w-full rounded-[10px] border border-[var(--field-border)] bg-[var(--field-surface)] px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]';
const buttonFocusClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]';
const buttonDisabledClassName = 'disabled:cursor-not-allowed disabled:opacity-50';
export const primaryButtonClassName =
  `inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 ${buttonFocusClassName} ${buttonDisabledClassName}`;
export const secondaryButtonClassName =
  `inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--field-focus)] hover:bg-[var(--field-surface)] ${buttonFocusClassName} ${buttonDisabledClassName}`;
export const dangerButtonClassName =
  `inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[var(--danger-border)] bg-[var(--danger-tint)] px-4 py-2.5 text-sm font-semibold text-[var(--status-danger)] transition hover:bg-[var(--danger-tint-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-danger)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${buttonDisabledClassName}`;
export const compactPrimaryButtonClassName =
  `inline-flex min-h-9 items-center justify-center rounded-[7px] bg-[var(--brand)] px-3 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 ${buttonFocusClassName} ${buttonDisabledClassName}`;
export const compactSecondaryButtonClassName =
  `inline-flex min-h-9 items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-medium text-[var(--text)] transition hover:border-[var(--field-focus)] hover:bg-[var(--field-surface)] ${buttonFocusClassName} ${buttonDisabledClassName}`;
export const compactDangerButtonClassName =
  `inline-flex min-h-9 items-center justify-center rounded-[7px] border border-[var(--danger-border)] bg-[var(--danger-tint)] px-3 py-2 text-[13px] font-medium text-[var(--status-danger)] transition hover:bg-[var(--danger-tint-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-danger)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${buttonDisabledClassName}`;
export const compactListButtonClassName =
  `flex min-h-9 w-full items-center justify-start rounded-[7px] bg-[var(--surface)] px-3 py-2 text-left text-[13px] text-[var(--text)] transition hover:bg-[var(--field-surface)] ${buttonFocusClassName} ${buttonDisabledClassName}`;
export const dangerTextClassName = 'text-sm text-[var(--status-danger)]';
export const successTextClassName = 'text-sm text-[var(--status-success)]';

export function getSegmentedChoiceClassName(selected: boolean, size: 'default' | 'compact' = 'default') {
  const sizeClassName =
    size === 'compact'
      ? 'rounded-[8px] px-3 py-2 text-[13px] font-medium'
      : 'rounded-[10px] px-4 py-2.5 text-sm font-semibold';

  return `flex-1 border transition ${sizeClassName} ${buttonFocusClassName} ${
    selected
      ? 'border-[var(--field-selected-border)] bg-[var(--brand-tint)] text-[var(--field-selected-text)]'
      : 'border-[var(--field-border)] bg-[var(--field-surface)] text-[var(--text-secondary)] hover:border-[var(--field-focus)] hover:text-[var(--text)]'
  }`;
}

export function PageShell({
  children,
  size = 'default',
  className = '',
}: {
  children: ReactNode;
  size?: keyof typeof pageShellWidthClasses;
  className?: string;
}) {
  return (
    <div className={`mx-auto flex w-full flex-col gap-6 px-5 py-7 sm:px-7 lg:px-10 ${pageShellWidthClasses[size]} ${className}`}>
      {children}
    </div>
  );
}

export function TopBar({
  title,
  description,
  actions,
  align = 'left',
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  align?: 'left' | 'center';
}) {
  const isCentered = align === 'center';

  return (
    <div className={isCentered ? 'text-center' : 'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'}>
      <div className="space-y-2">
        <div className={isCentered ? 'space-y-2 text-center' : 'space-y-2'}>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</h1>
          {description ? (
            <p className={`text-[15px] leading-[1.55] text-[var(--text-secondary)] ${isCentered ? 'mx-auto max-w-2xl' : 'max-w-3xl'}`}>
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className={`flex flex-wrap gap-3 ${isCentered ? 'justify-center' : ''}`}>{actions}</div> : null}
    </div>
  );
}

export function ActionLink({
  href,
  children,
  tone = 'primary',
  size = 'default',
}: {
  href: string;
  children: ReactNode;
  tone?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'compact';
}) {
  const className =
    tone === 'primary'
      ? size === 'compact'
        ? compactPrimaryButtonClassName
        : primaryButtonClassName
      : tone === 'secondary'
        ? size === 'compact'
          ? compactSecondaryButtonClassName
          : secondaryButtonClassName
        : `inline-flex min-h-8 items-center px-1 py-1 text-sm font-medium text-[var(--brand)] transition hover:text-[var(--text)] ${buttonFocusClassName}`;

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function Surface({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section
      id={id}
      className={`rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</p>
      <p className="metric-text mt-2 text-[26px] font-semibold tracking-[-0.02em] text-[var(--text)]">
        {value}
      </p>
      {detail ? <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{detail}</p> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning';
}) {
  const toneClasses = {
    neutral: 'border-[var(--border)] bg-[var(--field-surface)] text-[var(--text-secondary)]',
    brand: 'border-[var(--field-selected-border)] bg-[var(--brand-tint)] text-[var(--field-selected-text)]',
    success: 'border-[var(--status-success-border)] bg-[var(--status-success-tint)] text-[var(--status-success)]',
    warning: 'border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] text-[var(--status-warning)]',
  } as const;

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-3 text-[12.5px] font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--field-surface)] px-5 py-10 text-center">
      <p className="text-base font-semibold text-[var(--text)]">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
