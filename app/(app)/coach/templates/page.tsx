import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { templateService } from '@/lib/template-service';
import { accountService } from '@/lib/account-service';
import { CoachTemplatesClient } from './CoachTemplatesClient';

export default async function CoachTemplatesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const [templates, account] = await Promise.all([
    templateService.listForCoach(user.id),
    accountService.getAccount(user.id),
  ]);

  return (
    <PageShell size="wide">
      <TopBar
        title="Templates"
        description="Create reusable day, week, or month structures. Build the content here; place it on a calendar from Planner."
      />
      <CoachTemplatesClient templates={templates} role="COACH" performanceProfile={account?.performanceProfile} />
    </PageShell>
  );
}
