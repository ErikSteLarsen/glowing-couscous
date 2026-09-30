import { redirect } from 'next/navigation';

export default async function AthletePlannerPage({ searchParams }: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const params = new URLSearchParams({ add: '1' });
  if (date) params.set('date', date);
  redirect(`/athlete/calendar?${params}`);
}
