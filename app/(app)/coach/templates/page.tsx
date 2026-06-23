import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
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
        eyebrow="Coach templates"
        title="Private session templates"
        description="Templates are coach-owned reusable sessions. In the MVP they are the main structured shortcut besides manual week-to-week copying."
      />

      <CoachTemplatesClient templates={templates.map((template) => ({ ...template }))} />
    </PageShell>
  );
}
