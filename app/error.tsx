'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AuthPageShell, Surface, TopBar, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AuthPageShell>
      <TopBar title="We couldn’t load this page" description="Try again, or return to TempoBuilder Home." align="center" />
      <Surface className="mx-auto w-full max-w-md space-y-4 text-center">
        <p role="alert" className="text-sm text-[var(--text-secondary)]">An unexpected error stopped this page from loading.</p>
        {error.digest ? <p className="text-xs text-[var(--text-muted)]">Error code: {error.digest}</p> : null}
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className={primaryButtonClassName}>Try again</button>
          <Link href="/" className={secondaryButtonClassName}>Back to Home</Link>
        </div>
      </Surface>
    </AuthPageShell>
  );
}
