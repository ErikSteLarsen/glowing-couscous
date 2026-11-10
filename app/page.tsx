import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { TrainingScene } from '@/components/landing/TrainingScene';
import { primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    if (!hasAppRole(user)) redirect('/setup');
    redirect(user.role === 'COACH' ? '/coach' : '/athlete');
  }

  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden bg-[var(--background)]">
      <TrainingScene />
      <header className="relative mx-auto flex w-full max-w-[1440px] items-center gap-2.5 px-5 pt-6 sm:px-7 lg:px-10">
        <BrandMark />
        <span className="text-[15px] font-semibold text-[var(--text)]">Tempo</span>
      </header>
      <main id="main" className="relative mx-auto w-full max-w-[1440px] px-5 pt-[clamp(1.5rem,8dvh,5rem)] sm:px-7 lg:px-10">
        <h1 className="max-w-[18ch] text-4xl font-medium leading-[1.1] tracking-[-0.02em] text-balance text-[var(--text)] sm:text-5xl">
          Plan, follow, and review your own training.
        </h1>
        <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-[var(--text-secondary)]">
          Build workouts for running, cycling, swimming, and strength. Place them on your week, follow each
          session, and log what you actually did.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/signup" className={`${primaryButtonClassName} min-h-11 px-5`}>
            Create account
          </Link>
          <Link href="/login" className={`${secondaryButtonClassName} min-h-11 bg-[var(--background)] px-5`}>
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
