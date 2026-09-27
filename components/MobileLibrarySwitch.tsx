import Link from 'next/link';

export function MobileLibrarySwitch({ active }: { active: 'workouts' | 'templates' }) {
  return (
    <nav aria-label="Workout library" className="mb-4 grid grid-cols-2 border-b border-[var(--border)] md:hidden">
      <Link
        href="/athlete/workouts"
        aria-current={active === 'workouts' ? 'page' : undefined}
        className={`flex min-h-11 items-center justify-center border-b-2 px-3 text-xs font-semibold uppercase tracking-[0.06em] ${active === 'workouts' ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--text-secondary)]'}`}
      >
        Workouts
      </Link>
      <Link
        href="/athlete/templates"
        aria-current={active === 'templates' ? 'page' : undefined}
        className={`flex min-h-11 items-center justify-center border-b-2 px-3 text-xs font-semibold uppercase tracking-[0.06em] ${active === 'templates' ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--text-secondary)]'}`}
      >
        Templates
      </Link>
    </nav>
  );
}
