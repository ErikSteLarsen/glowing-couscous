import Link from 'next/link';
import { PageShell, TopBar, secondaryButtonClassName } from '@/components/ui';

export default async function AccountDeletedPage({ searchParams }: { searchParams: Promise<{ strava?: string }> }) {
  const { strava } = await searchParams;
  return <PageShell><TopBar title="Account deleted" description="Your account and personal data have been removed from Tempo’s active database." /><div className="space-y-5 text-sm">
    <p>Shared workout structure remains under owner [deleted], unless you removed its public links beforehand. Other users’ saved copies and training history remain theirs.</p>
    {strava === 'manual' ? <p role="alert">Tempo removed your Strava tokens and imported data, but could not confirm revocation at Strava. Remove Tempo from your <a href="https://www.strava.com/settings/apps" className="underline">Strava app settings</a>.</p> : null}
    <p>Drafts kept on other devices and existing backup copies are outside this deletion action.</p>
    <Link href="/login" className={secondaryButtonClassName}>Back to sign in</Link>
  </div></PageShell>;
}
