import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { prisma } from '@/lib/prisma';

export default async function AthleteProfilePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const profile = await prisma.athleteProfile.findUnique({ where: { userId: user.id } });
  if (profile) redirect('/athlete');

  return (
    <PageShell>
      <TopBar
        eyebrow="Your profile"
        title={user.name}
        description="You don't have a coach yet. Find a coach to get your weekly training plan."
        actions={<ActionLink href="/athlete/find-coach">Find a coach</ActionLink>}
      />
      <EmptyState
        title="No training plan yet"
        description="Once a coach accepts your request, your weekly plan will appear here."
      />
    </PageShell>
  );
}
