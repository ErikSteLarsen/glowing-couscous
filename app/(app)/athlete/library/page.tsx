import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Bike } from 'lucide-react';
import { LibraryBrowser } from '@/components/library/LibraryBrowser';
import { ActionLink, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { workoutCatalog } from '@/lib/workout-catalog';
import { createCatalogListEntries, parseCatalogQuery } from '@/lib/workout-catalog/query';

export const metadata: Metadata = { title: 'Library' };

export default async function AthleteLibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const query = parseCatalogQuery(await searchParams);

  return (
    <PageShell size="wall">
      <TopBar
        title="Workout library"
        description="Structured indoor bike workouts, targeted in % of FTP. Ride one now, schedule it, or copy it into your workouts to edit."
        actions={<ActionLink href="/athlete/ride" tone="secondary"><Bike aria-hidden="true" size={16} strokeWidth={1.6} />Ride home</ActionLink>}
      />
      <LibraryBrowser entries={createCatalogListEntries(workoutCatalog)} initialQuery={query} />
    </PageShell>
  );
}
