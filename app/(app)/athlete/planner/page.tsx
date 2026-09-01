import { formatISO } from 'date-fns';
import { redirect } from 'next/navigation';

import { ActionLink, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { athletePlannerService } from '@/lib/athlete-planner-service';

import { AthletePlannerClient } from './AthletePlannerClient';

export default async function AthletePlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; templateId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { date, templateId } = await searchParams;
  const workspace = await athletePlannerService.loadWorkspace(user.id, date);
  const parsedTemplateId = Number(templateId);

  return (
    <PageShell size="wide" className="max-w-[1400px]">
      <TopBar
        eyebrow="Planner"
        title="Create sessions"
        actions={
          <ActionLink href="/athlete/templates" tone="secondary">
            Templates
          </ActionLink>
        }
      />
      <AthletePlannerClient
        athleteId={user.id}
        templates={workspace.templates}
        days={workspace.days}
        periodLabel={workspace.period.label}
        initialDate={date ?? formatISO(new Date(), { representation: 'date' })}
        initialTemplateId={Number.isInteger(parsedTemplateId) ? parsedTemplateId : null}
      />
    </PageShell>
  );
}
