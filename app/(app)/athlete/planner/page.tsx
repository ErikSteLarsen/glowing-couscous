import { redirect } from 'next/navigation';

import { getPlannerRedirectHref } from '@/lib/calendar-navigation';

/** Planner merged into Calendar; old links and bookmarks open its placement flow. */
export default async function AthletePlannerRedirect({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[]; source?: string | string[] }>;
}) {
  redirect(getPlannerRedirectHref(await searchParams));
}
