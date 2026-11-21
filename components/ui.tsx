import Link from 'next/link';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import type { BackTarget } from '@/lib/app-navigation';
import { ReactNode } from 'react';

const pageShellWidthClasses = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-[1140px]',
  wall: 'max-w-[1440px]',
} as const;

export const pageHeadingClassName = 'text-[1.75rem] font-medium leading-tight tracking-[-0.02em] text-balance text-[var(--text)] sm:text-3xl';
export const sectionHeadingClassName = 'text-base font-medium tracking-[-0.01em] text-[var(--text)]';
export const eyebrowClassName = 'text-xs font-medium text-[var(--text-muted)]';
export const formLabelClassName = 'mb-1.5 block text-[13px] font-medium text-[var(--text-secondary)]';
const fieldBaseClassName =
  'w-full rounded-lg border border-[var(--field-border)] bg-[var(--field-surface)] px-3 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-muted)] hover:border-[var(--field-border-hover)] focus:border-[var(--field-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--field-focus)]/40 disabled:cursor-not-allowed disabled:opacity-60';
export const formFieldClassName = `min-h-10 py-2 ${fieldBaseClassName}`;
export const formSelectClassName = `${formFieldClassName} pr-10`;
export const formTextareaClassName = `py-2.5 leading-relaxed ${fieldBaseClassName}`;
export const buttonFocusClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]';
const buttonDisabledClassName = 'disabled:cursor-not-allowed disabled:opacity-50';
const standardButtonBaseClassName =
  `inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,border-color,color,transform] active:scale-[0.98] ${buttonFocusClassName} ${buttonDisabledClassName}`;
const compactButtonBaseClassName =
  `inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-[background-color,border-color,color] ${buttonFocusClassName} ${buttonDisabledClassName}`;
export const primaryButtonClassName =
  `${standardButtonBaseClassName} bg-[var(--brand)] text-[var(--signal-ink)] hover:bg-[var(--signal-hover)]`;
export const secondaryButtonClassName =
  `${standardButtonBaseClassName} border border-[var(--border-strong)] bg-transparent text-[var(--text)] hover:bg-[var(--raised)]`;
export const dangerButtonClassName =
  `${standardButtonBaseClassName} border border-[var(--danger-border)] bg-[var(--danger-tint)] text-[var(--status-danger)] hover:bg-[var(--danger-tint-strong)] focus-visible:ring-[var(--status-danger)]`;
export const compactPrimaryButtonClassName =
  `${compactButtonBaseClassName} bg-[var(--brand)] text-[var(--signal-ink)] hover:bg-[var(--signal-hover)]`;
export const compactSecondaryButtonClassName =
  `${compactButtonBaseClassName} border border-[var(--border-strong)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--raised)] hover:text-[var(--text)]`;
export const compactDangerButtonClassName =
  `${compactButtonBaseClassName} border border-[var(--danger-border)] bg-[var(--danger-tint)] text-[var(--status-danger)] hover:bg-[var(--danger-tint-strong)] focus-visible:ring-[var(--status-danger)]`;
export const compactListButtonClassName =
  `flex min-h-8 w-full items-center justify-start rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[var(--text)] transition-colors hover:bg-[var(--raised)] ${buttonFocusClassName} ${buttonDisabledClassName}`;
export const dangerTextClassName = 'text-sm text-[var(--status-danger)]';
export const successTextClassName = 'text-sm text-[var(--status-success)]';

export function ghostButtonClassName(size: 'default' | 'compact') {
  return size === 'compact'
    ? `inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium text-[var(--brand)] transition-colors hover:bg-[var(--brand-tint)] hover:text-[var(--text)] ${buttonFocusClassName}`
    : `inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--brand)] transition-colors hover:bg-[var(--brand-tint)] hover:text-[var(--text)] ${buttonFocusClassName}`;
}

/** Icon-only round step button, as used for period navigation. */
export const iconButtonClassName =
  `inline-flex size-10 max-md:size-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--raised)] hover:text-[var(--text)] ${buttonFocusClassName} ${buttonDisabledClassName}`;

export function getSegmentedChoiceClassName(selected: boolean, size: 'default' | 'compact' = 'default') {
  const sizeClassName =
    size === 'compact'
      ? 'min-h-8 rounded-md px-2.5 py-1 text-[13px] font-medium'
      : 'min-h-10 rounded-lg px-4 py-2 text-sm font-medium';

  return `flex min-w-0 flex-1 items-center justify-center border transition-colors ${sizeClassName} ${buttonFocusClassName} ${
    selected
      ? 'border-[var(--field-selected-border)] bg-[var(--brand-tint)] text-[var(--field-selected-text)]'
      : 'border-[var(--field-border)] bg-[var(--field-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
  }`;
}

/** Segmented switch in the instrument style: a raised track with a lifted active option. */
export function getSwitchOptionClassName(selected: boolean) {
  return `inline-flex min-h-8 items-center justify-center rounded-md px-3 text-[13px] font-medium transition-colors ${buttonFocusClassName} ${
    selected ? 'bg-[var(--border-strong)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
  }`;
}

export const switchTrackClassName = 'inline-flex gap-0.5 rounded-lg bg-[var(--raised)] p-0.5';

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

/** Authentication has its own reading-width frame, outside the workspace. */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return <main className="auth-page-layout">{children}</main>;
}


const backTextClassName = `-ml-2 inline-flex min-h-10 max-w-full items-center gap-1.5 self-start rounded-lg px-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)] max-md:min-h-11 ${buttonFocusClassName}`;
const backIconClassName = `inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)] max-md:size-11 ${buttonFocusClassName}`;

function BackLinkContent({ destination }: { destination: string }) {
  return (
    <>
      <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.6} className="shrink-0" />
      <span className="truncate"><span className="sr-only">Back to </span>{destination}</span>
    </>
  );
}

/**
 * The one back control for pages below a top-level destination. Resolve the
 * target with `resolveBackTarget` in `lib/app-navigation.ts`. `compact` is the
 * icon-only form for chrome-less screens such as the ride page.
 */
export function BackLink({ target, variant = 'default' }: { target: BackTarget; variant?: 'default' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <Link href={target.href} aria-label={target.label} title={target.label} className={backIconClassName}>
        <ArrowLeft aria-hidden="true" size={20} strokeWidth={1.6} />
      </Link>
    );
  }

  return (
    <Link href={target.href} className={backTextClassName}>
      <BackLinkContent destination={target.destination} />
    </Link>
  );
}

/** BackLink's look for an in-page view that closes back to its list, such as the workout editor. */
export function BackButton({ destination, onClick, disabled }: { destination: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${backTextClassName} disabled:cursor-not-allowed disabled:opacity-50`}>
      <BackLinkContent destination={destination} />
    </button>
  );
}

export function TopBar({
  title,
  description,
  eyebrow,
  actions,
  back,
  align = 'left',
}: {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  back?: BackTarget;
  align?: 'left' | 'center';
}) {
  const isCentered = align === 'center';
  const titleBlock = (
    <div className={isCentered ? 'space-y-1.5 text-center' : 'min-w-0 space-y-1.5'}>
      {eyebrow ? <p className={`data ${eyebrowClassName}`}>{eyebrow}</p> : null}
      <h1 className={pageHeadingClassName}>{title}</h1>
      {description ? (
        <p className={`text-sm leading-relaxed text-[var(--text-muted)] ${isCentered ? 'mx-auto max-w-2xl' : 'max-w-3xl'}`}>
          {description}
        </p>
      ) : null}
    </div>
  );

  return (
    <header className={`min-h-[64px] ${isCentered ? 'text-center' : 'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'}`}>
      {back ? (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="page-back"><BackLink target={back} /></div>
          {titleBlock}
        </div>
      ) : titleBlock}
      {actions ? <div className={`flex flex-wrap items-center gap-2 ${isCentered ? 'justify-center' : ''}`}>{actions}</div> : null}
    </header>
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
    <section id={id} className={`tile rounded-2xl p-5 ${className}`}>
      {children}
    </section>
  );
}

export function Disclosure({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-[var(--border)]">
      <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--raised)] [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
        {summary}
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-[var(--text-muted)] group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-[var(--border)] p-4">{children}</div>
    </details>
  );
}

const statTileToneClassNames = {
  good: 'text-[var(--status-success)]',
  watch: 'text-[var(--status-warning)]',
  neutral: 'text-[var(--text-muted)]',
} as const;

/** A square of reading: label, a large tabular value with a quiet unit, and optional detail. */
export function StatTile({
  label,
  value,
  unit,
  detail,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: ReactNode;
  tone?: 'good' | 'watch' | 'neutral';
}) {
  const toneClassName = statTileToneClassNames[tone ?? 'neutral'];

  return (
    <div className="tile flex min-h-[7.5rem] flex-col rounded-2xl p-4">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="data mt-auto pt-3 text-[1.75rem] font-medium leading-none tracking-[-0.02em] text-[var(--text)]">
        {value}
        {unit ? <span className="ml-1 text-[0.5em] font-normal text-[var(--text-muted)]">{unit}</span> : null}
      </p>
      {detail ? <p className={`data mt-2 text-xs ${toneClassName}`}>{detail}</p> : null}
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
    neutral: 'border-[var(--border-strong)] text-[var(--text-secondary)]',
    brand: 'border-[var(--status-planned-border)] bg-[var(--brand-tint)] text-[var(--brand)]',
    success: 'border-[var(--status-success-border)] bg-[var(--status-success-tint)] text-[var(--status-success)]',
    warning: 'border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] text-[var(--status-warning)]',
  } as const;

  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="tile-empty rounded-2xl px-5 py-10 text-center">
      <p className="text-base font-medium text-[var(--text)]">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-muted)]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
