import Link from 'next/link';
import { AuthPageShell, Surface, TopBar, primaryButtonClassName } from '@/components/ui';

export default function NotFound() {
  return (
    <AuthPageShell>
      <TopBar title="We couldn’t find that page" description="The link may be old, or the page may have moved." align="center" />
      <Surface className="mx-auto w-full max-w-md space-y-4 text-center">
        <p className="text-sm text-[var(--text-secondary)]">Check the address, or go back to Tempo Home and continue from there.</p>
        <Link href="/" className={primaryButtonClassName}>Back to Home</Link>
      </Surface>
    </AuthPageShell>
  );
}
