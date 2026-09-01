import { formatISO } from 'date-fns';
import { redirect } from 'next/navigation';

import { ActionLink, PageShell, TopBar } from '@/components/ui';
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

  return (
    <PageShell size="wide" className="max-w-[1600px]">
      <TopBar
        eyebrow="Planner"
        title="Build your training library"
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
        librarySessions={workspace.librarySessions}
        trainingPlans={workspace.trainingPlans}
        days={workspace.days}
        periodLabel={workspace.period.label}
        initialAthleteId={
          Number.isInteger(parsedAthleteId) && workspace.athletes.some((a) => a.id === parsedAthleteId)
            ? parsedAthleteId
            : workspace.athletes[0]?.id ?? null
        }
        initialTemplateId={
          Number.isInteger(parsedTemplateId) && workspace.templates.some((t) => t.id === parsedTemplateId)
            ? parsedTemplateId
            : null
        }
        initialDate={date ?? formatISO(new Date(), { representation: 'date' })}
      />
    </PageShell>
  );
}
