import { redirect } from 'next/navigation';

import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { templateService } from '@/lib/template-service';

import { CoachTemplatesClient } from '../../coach/templates/CoachTemplatesClient';

export default async function AthleteTemplatesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const templates = await templateService.listForOwner(user.id);

  return (
    <PageShell size="wide">
      <TopBar
        title="Templates"
        description="Create reusable day, week, or month structures. Build the content here; place it on your calendar from Planner."
      />
      <CoachTemplatesClient
        templates={templates}
        apiBasePath="/api/athlete/templates"
        plannerHref="/athlete/planner"
        role="ATHLETE"
      />
    </PageShell>
  );
}
