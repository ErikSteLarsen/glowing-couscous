import { PageShell, TopBar } from '@/components/ui';
import { getCurrentCoach } from '@/lib/demo-session';
import { templateService } from '@/lib/template-service';
import { CoachTemplatesClient } from './CoachTemplatesClient';

export default async function CoachTemplatesPage() {
  const coach = await getCurrentCoach();
  const templates = coach ? await templateService.listForCoach(coach.id) : [];

  return (
    <PageShell>
      <TopBar
        eyebrow="Coach templates"
        title="Private session templates"
        description="Templates are coach-owned reusable sessions. In the MVP they are the main structured shortcut besides manual week-to-week copying."
      />

      <CoachTemplatesClient templates={templates.map((template) => ({ ...template }))} />
    </PageShell>
  );
}
