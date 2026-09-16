import Link from 'next/link';
import { ReactNode } from 'react';

const pageShellWidthClasses = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-[1140px]',
  wall: 'max-w-[1440px]',
} as const;

export const pageHeadingClassName = 'text-[40px] font-normal leading-none tracking-[-0.045em] text-[var(--text)] max-md:text-[34px]';
export const sectionHeadingClassName = 'text-[20px] font-semibold tracking-[-0.02em] text-[var(--text)]';
export const formLabelClassName = 'mb-1.5 block text-[13px] font-medium text-[var(--text-secondary)]';
export const formFieldClassName =
  'min-h-10 w-full rounded-[3px] border border-[var(--field-border)] bg-[var(--field-surface)] px-3 py-2 text-[13px] text-[var(--text)] outline-none shadow-[var(--shadow-inset)] transition placeholder:text-[var(--text-muted)] focus:border-[var(--field-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]';
export const formSelectClassName = `${formFieldClassName} pr-10`;
export const formTextareaClassName =
  'w-full rounded-[3px] border border-[var(--field-border)] bg-[var(--field-surface)] px-3 py-2.5 text-[13px] text-[var(--text)] outline-none shadow-[var(--shadow-inset)] transition placeholder:text-[var(--text-muted)] focus:border-[var(--field-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]';
export const buttonFocusClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]';
const buttonDisabledClassName = 'disabled:cursor-not-allowed disabled:opacity-50';
const standardButtonBaseClassName =
  `inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-[3px] px-4 py-2 text-[13px] font-semibold tracking-[0.01em] transition ${buttonFocusClassName} ${buttonDisabledClassName}`;
const compactButtonBaseClassName =
  `inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded-[3px] px-2.5 py-1.5 text-xs font-medium tracking-[0.01em] transition ${buttonFocusClassName} ${buttonDisabledClassName}`;
export const primaryButtonClassName =
  `${standardButtonBaseClassName} bg-[var(--brand)] text-[var(--signal-ink)] shadow-[var(--shadow-raised)] hover:bg-[var(--signal-hover)]`;
export const secondaryButtonClassName =
  `${standardButtonBaseClassName} border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-inset)] hover:border-[var(--field-focus)] hover:bg-[var(--field-surface)]`;
export const dangerButtonClassName =
  `${standardButtonBaseClassName} border border-[var(--danger-border)] bg-[var(--danger-tint)] text-[var(--status-danger)] hover:bg-[var(--danger-tint-strong)] focus-visible:ring-[var(--status-danger)]`;
export const compactPrimaryButtonClassName =
  `${compactButtonBaseClassName} bg-[var(--brand)] text-[var(--signal-ink)] hover:bg-[var(--signal-hover)]`;
export const compactSecondaryButtonClassName =
  `${compactButtonBaseClassName} border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--field-focus)] hover:bg-[var(--field-surface)] hover:text-[var(--text)]`;
export const compactDangerButtonClassName =
  `${compactButtonBaseClassName} border border-[var(--danger-border)] bg-[var(--danger-tint)] text-[var(--status-danger)] hover:bg-[var(--danger-tint-strong)] focus-visible:ring-[var(--status-danger)]`;
export const compactListButtonClassName =
  `flex min-h-8 w-full items-center justify-start rounded-[3px] bg-[var(--surface)] px-2.5 py-1.5 text-left text-xs text-[var(--text)] transition hover:bg-[var(--field-surface)] ${buttonFocusClassName} ${buttonDisabledClassName}`;
export const dangerTextClassName = 'text-sm text-[var(--status-danger)]';
export const successTextClassName = 'text-sm text-[var(--status-success)]';

export function ghostButtonClassName(size: 'default' | 'compact') {
  return size === 'compact'
    ? `inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded-[3px] px-2 py-1.5 text-xs font-medium text-[var(--brand)] transition hover:bg-[var(--brand-tint)] hover:text-[var(--text)] ${buttonFocusClassName}`
    : `inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-[3px] px-2 py-2 text-[13px] font-medium text-[var(--brand)] transition hover:bg-[var(--brand-tint)] hover:text-[var(--text)] ${buttonFocusClassName}`;
}

export function getSegmentedChoiceClassName(selected: boolean, size: 'default' | 'compact' = 'default') {
  const sizeClassName =
    size === 'compact'
      ? 'min-h-8 rounded-[3px] px-2.5 py-1.5 text-xs font-medium'
      : 'min-h-10 rounded-[3px] px-4 py-2 text-[13px] font-semibold';

  return `flex min-w-0 flex-1 items-center justify-center border transition ${sizeClassName} ${buttonFocusClassName} ${
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
    <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-7 lg:px-10">
      <div className={`flex w-full flex-col gap-6 py-7 ${pageShellWidthClasses[size]} ${className}`}>
        {children}
      </div>
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
    <div className={`ink-topbar min-h-[72px] ${isCentered ? 'text-center' : 'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'}`}>
      <div className="space-y-2">
        <div className={isCentered ? 'space-y-2 text-center' : 'space-y-2'}>
          <h1 className={pageHeadingClassName}>{title}</h1>
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
        : ghostButtonClassName(size);

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
      className={`rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-inset)] ${className}`}
    >
      {children}
    </section>
  );
}

export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-inset)]">
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
      className={`inline-flex min-h-7 items-center rounded-full border px-3 text-[12.5px] font-medium shadow-[var(--shadow-inset)] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-[3px] border border-dashed border-[var(--border)] bg-[var(--field-surface)] px-5 py-10 text-center">
      <p className="text-base font-semibold text-[var(--text)]">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
