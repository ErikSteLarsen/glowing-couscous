import { redirect } from 'next/navigation';

import { ActionLink, PageShell, TopBar } from '@/components/ui';
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
        eyebrow="Templates"
        title="Session templates"
        actions={
          <ActionLink href="/athlete/planner" tone="secondary">
            Open planner
          </ActionLink>
        }
      />
      <CoachTemplatesClient
        templates={templates}
        apiBasePath="/api/athlete/templates"
        plannerHref="/athlete/planner"
      />
    </PageShell>
  );
}
