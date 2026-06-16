import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { templateService } from '@/lib/template-service';
import { CoachTemplatesClient } from './CoachTemplatesClient';
import { SignOutButton } from '@/components/SignOutButton';

export default async function CoachTemplatesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const templates = await templateService.listForCoach(user.id);

  return (
    <PageShell>
      <TopBar
        eyebrow="Coach templates"
        title="Private session templates"
        description="Templates are coach-owned reusable sessions. In the MVP they are the main structured shortcut besides manual week-to-week copying."
        actions={<SignOutButton />}
      />

      <CoachTemplatesClient templates={templates.map((template) => ({ ...template }))} />
    </PageShell>
  );
}
