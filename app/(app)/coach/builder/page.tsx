import { redirect } from 'next/navigation';

export default async function CoachBuilderRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string; athleteId?: string }>;
}) {
  const { templateId, athleteId } = await searchParams;
  const params = new URLSearchParams();

  if (templateId) params.set('templateId', templateId);
  if (athleteId) params.set('athleteId', athleteId);

  redirect('/coach/planner' + (params.size > 0 ? `?${params.toString()}` : ''));
}
