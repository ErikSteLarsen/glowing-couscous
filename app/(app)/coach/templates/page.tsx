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
        eyebrow="Templates"
        title="Session templates"
        actions={
          <ActionLink href="/coach/planner" tone="secondary">
            Open planner
          </ActionLink>
        }
      />

      <CoachTemplatesClient templates={templates} />
    </PageShell>
  );
}
