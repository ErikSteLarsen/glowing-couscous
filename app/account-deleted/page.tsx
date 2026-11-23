import Link from 'next/link';
import { PageShell, TopBar, secondaryButtonClassName } from '@/components/ui';

export default async function AccountDeletedPage({ searchParams }: { searchParams: Promise<{ strava?: string }> }) {
  const { strava } = await searchParams;
  return <PageShell><TopBar title="Account deleted" description="Your account and your training data have been deleted from Tempo." /><div className="space-y-5 text-sm">
    <p>Workouts you shared still work through their links, shown as owned by [deleted], unless you turned the links off first. Copies other people saved, and their training history, stay theirs.</p>
    {strava === 'manual' ? <p role="alert">Tempo removed your Strava connection and imported activities, but couldn’t confirm that Strava removed Tempo’s access. Remove Tempo in your <a href="https://www.strava.com/settings/apps" className="underline hover:text-[var(--brand)]">Strava app settings</a>.</p> : null}
    <p>Unsaved changes on your other devices, and existing backups, weren’t deleted.</p>
    <Link href="/login" className={secondaryButtonClassName}>Back to sign in</Link>
  </div></PageShell>;
}
