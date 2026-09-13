import { redirect } from 'next/navigation';
import { ActionLink, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { templateService } from '@/lib/template-service';
import { CoachTemplatesClient } from './CoachTemplatesClient';

export default async function CoachTemplatesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const templates = await templateService.listForCoach(user.id);

  return (
    <PageShell size="wide">
      <TopBar
        title="Templates"
        description="Create reusable day, week, or month structures. Build the content here; place it on a calendar from Planner."
        actions={
          <ActionLink href="/coach/planner" tone="secondary">Open Planner</ActionLink>
        }
      />
       <CoachTemplatesClient templates={templates} role="COACH" />
    </PageShell>
  );
}
