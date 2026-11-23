import Link from 'next/link';
import { buttonFocusClassName } from '@/components/ui';

export function MobileLibrarySwitch({ active }: { active: 'workouts' | 'templates' }) {
  return (
    <nav aria-label="Workout library" className="mb-4 grid grid-cols-2 border-b border-[var(--border)] md:hidden">
      <Link
        href="/athlete/workouts"
        aria-current={active === 'workouts' ? 'page' : undefined}
        className={`flex min-h-11 items-center justify-center border-b-2 px-3 text-[13px] font-semibold transition hover:bg-[var(--field-surface)] ${buttonFocusClassName} ${active === 'workouts' ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--text-secondary)]'}`}
      >
        Workouts
      </Link>
      <Link
        href="/athlete/templates"
        aria-current={active === 'templates' ? 'page' : undefined}
        className={`flex min-h-11 items-center justify-center border-b-2 px-3 text-[13px] font-semibold transition hover:bg-[var(--field-surface)] ${buttonFocusClassName} ${active === 'templates' ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--text-secondary)]'}`}
      >
        Routines
      </Link>
    </nav>
  );
}
