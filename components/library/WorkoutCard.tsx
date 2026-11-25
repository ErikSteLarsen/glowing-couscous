import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/**
 * The shared workout card: Workouts (both tabs), Tempo Ride and Activity.
 * The title owns the card's one primary target and stretches over the whole card;
 * footer actions sit above that overlay. Compose with the parts below.
 */
export function WorkoutCard({ children, current = false }: { children: ReactNode; current?: boolean }) {
  return (
    <article
      data-current={current || undefined}
      className="tile tile--interactive group relative flex h-full flex-col rounded-2xl p-4 has-[[data-card-target]:focus-visible]:border-[var(--brand)] data-[current]:border-[var(--brand)]"
    >
      {children}
    </article>
  );
}

const targetClassName = "rounded-sm text-left outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']";

type TargetProps =
  | ({ href: string } & Omit<ComponentProps<typeof Link>, 'href' | 'className'>)
  | ({ href?: undefined } & Omit<ComponentProps<'button'>, 'className' | 'type'>);

/** Title row: the name is the card's link or button; `aside` is its leading value (duration). */
export function WorkoutCardHeader({ aside, children, level: Heading = 'h3', ...target }: TargetProps & { aside?: ReactNode; children: ReactNode; level?: 'h3' | 'h4' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Heading className="min-w-0 text-base font-medium leading-snug text-[var(--text)] [overflow-wrap:anywhere]">
        {target.href !== undefined
          ? <Link {...target} data-card-target className={targetClassName}>{children}</Link>
          : <button type="button" {...target} data-card-target className={targetClassName}>{children}</button>}
      </Heading>
      {aside ? <span className="data shrink-0 text-[13px] text-[var(--text-secondary)]">{aside}</span> : null}
    </div>
  );
}

export function WorkoutCardMeta({ children, id }: { children: ReactNode; id?: string }) {
  return <p id={id} className="mt-0.5 flex min-w-0 gap-x-3 overflow-hidden whitespace-nowrap text-[12px] text-[var(--text-muted)] [&>*]:truncate">{children}</p>;
}

/** Profile sits above the title in the library and below the meta line elsewhere. */
export function WorkoutCardProfile({ children, position = 'top' }: { children: ReactNode; position?: 'top' | 'inline' }) {
  return <div className={position === 'top' ? 'mb-3' : 'mt-3'}>{children}</div>;
}

export function WorkoutCardSummary({ children, lines = 2 }: { children: ReactNode; lines?: 1 | 2 }) {
  return <p className={`mt-2 ${lines === 1 ? 'truncate' : 'line-clamp-2'} text-[13px] leading-relaxed text-[var(--text-secondary)]`}>{children}</p>;
}

/** Metrics on the left, actions on the right; actions stay clickable above the card target. */
export function WorkoutCardFooter({ metrics, actions, id }: { metrics: { label: string; value: ReactNode; hideLabel?: boolean }[]; actions?: ReactNode; id?: string }) {
  return (
    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
      <dl id={id} className="data flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)]">
        {metrics.map((metric, index) => (
          <div key={index} className="flex gap-1">
            <dt className={metric.hideLabel ? 'sr-only' : undefined}>{metric.label}</dt>
            <dd className="text-[var(--text)]">{metric.value}</dd>
          </div>
        ))}
      </dl>
      {actions ? <div className="relative z-10 flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

/** Card grids share one column rhythm: 1 on phones, then 2, 3 and 4 as the container grows. */
export function WorkoutCardGrid({ children, label }: { children: ReactNode; label?: string }) {
  return <ul aria-label={label} className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">{children}</ul>;
}
