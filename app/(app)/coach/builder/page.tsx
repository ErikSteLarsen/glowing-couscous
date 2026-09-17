import { redirect } from 'next/navigation';

export default async function CoachBuilderRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ athleteId?: string }>;
}) {
  const { athleteId } = await searchParams;
  const params = new URLSearchParams();

  if (athleteId) params.set('athleteId', athleteId);

  redirect('/coach/planner' + (params.size > 0 ? `?${params.toString()}` : ''));
}
