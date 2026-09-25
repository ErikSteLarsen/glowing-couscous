import { redirect } from 'next/navigation';

import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { templateService } from '@/lib/template-service';
import { accountService } from '@/lib/account-service';

import { CoachTemplatesClient } from '../../coach/templates/CoachTemplatesClient';

export default async function AthleteTemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const [templates, account] = await Promise.all([
    templateService.listForOwner(user.id),
    accountService.getAccount(user.id),
  ]);

  return (
    <PageShell>
      <TopBar
        title="Templates"
        description="Build reusable day, week, and month training templates."
      />
      <CoachTemplatesClient
        templates={templates}
        apiBasePath="/api/athlete/templates"
        plannerHref="/athlete/planner"
        role="ATHLETE"
        performanceProfile={account?.performanceProfile}
      />
    </PageShell>
  );
}
