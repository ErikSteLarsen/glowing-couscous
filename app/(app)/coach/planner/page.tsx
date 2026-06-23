import { formatISO } from 'date-fns';
import { redirect } from 'next/navigation';

import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { coachPlannerService } from '@/lib/coach-planner-service';

import { PlannerClient } from './PlannerClient';

export default async function CoachPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; athleteId?: string; templateId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const { date, athleteId, templateId } = await searchParams;
  const workspace = await coachPlannerService.loadWorkspace(user.id, date);
  const parsedAthleteId = Number(athleteId);
  const parsedTemplateId = Number(templateId);

  if (workspace.athletes.length === 0) {
    return (
      <PageShell size="wide">
        <EmptyState title="No athletes available" description="Add an athlete to your roster before planning sessions." />
      </PageShell>
    );
  }

  return (
    <PageShell size="wide" className="max-w-[1600px]">
      <TopBar
        eyebrow="Planner"
        title="Plan the training week"
        description="Click a day to plan, build the session visually, or preload structure from a saved template."
        actions={
          <>
            <ActionLink href="/coach/templates" tone="secondary">
              Templates
            </ActionLink>
            <ActionLink href="/coach">Roster</ActionLink>
          </>
        }
      />

      <PlannerClient
        athletes={workspace.athletes}
        templates={workspace.templates}
        days={workspace.days}
        periodLabel={workspace.period.label}
        initialAthleteId={
          Number.isInteger(parsedAthleteId) &&
          workspace.athletes.some((athlete) => athlete.id === parsedAthleteId)
            ? parsedAthleteId
            : workspace.athletes[0].id
        }
        initialTemplateId={
          Number.isInteger(parsedTemplateId) &&
          workspace.templates.some((template) => template.id === parsedTemplateId)
            ? parsedTemplateId
            : null
        }
        initialDate={date ?? formatISO(new Date(), { representation: 'date' })}
      />
    </PageShell>
  );
}
