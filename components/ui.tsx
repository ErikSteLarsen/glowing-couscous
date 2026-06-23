import Link from 'next/link';
import { ReactNode } from 'react';

const pageShellWidthClasses = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
} as const;

export function PageShell({
  children,
  size = 'default',
  className = '',
}: {
  children: ReactNode;
  size?: keyof typeof pageShellWidthClasses;
  className?: string;
}) {
  return <div className={`mx-auto flex w-full flex-col gap-6 ${pageShellWidthClasses[size]} ${className}`}>{children}</div>;
}

export function TopBar({
  eyebrow,
  title,
  description,
  actions,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  align?: 'left' | 'center';
}) {
  const isCentered = align === 'center';

  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl border border-white/10 bg-[rgba(17,24,39,0.7)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur ${
        isCentered ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'
      }`}
    >
      <div className="space-y-2">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{eyebrow}</p> : null}
        <div className={`space-y-1 ${isCentered ? 'text-center' : ''}`}>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
          {description ? <p className={`text-sm text-slate-300 sm:text-base ${isCentered ? 'mx-auto max-w-xl' : 'max-w-2xl'}`}>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className={`flex flex-wrap gap-3 ${isCentered ? 'justify-center' : ''}`}>{actions}</div> : null}
    </div>
  );
}

export function ActionLink({ href, children, tone = 'primary' }: { href: string; children: ReactNode; tone?: 'primary' | 'secondary' }) {
  const className =
    tone === 'primary'
      ? 'rounded-2xl bg-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(59,90,245,0.35)] transition hover:bg-[var(--brand)]'
      : 'rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10';

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-white/10 bg-[rgba(17,24,39,0.78)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] ${className}`}>
      {children}
    </section>
  );
}

export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-300">{detail}</p> : null}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'success' | 'warning' }) {
  const classes = {
    neutral: 'bg-white/8 text-slate-200 border-white/10',
    brand: 'bg-[rgba(90,124,255,0.16)] text-[var(--color-brand-100)] border-[rgba(90,124,255,0.32)]',
    success: 'bg-[rgba(47,179,109,0.16)] text-emerald-300 border-[rgba(47,179,109,0.32)]',
    warning: 'bg-[rgba(216,163,63,0.16)] text-amber-300 border-[rgba(216,163,63,0.32)]',
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes[tone]}`}>{children}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">{description}</p>
    </div>
  );
}
