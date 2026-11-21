import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-session';
import { legacyLibraryRedirectHref } from '@/lib/athlete-workouts-navigation';

export default async function AthleteLibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  redirect(legacyLibraryRedirectHref(await searchParams));
}
