import { formatISO } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { getCoachOverview } from '@/lib/coach-service';
import { templateService } from '@/lib/template-service';
import { BuilderClient } from './BuilderClient';

export default async function CoachBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string; athleteId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const [{ templateId, athleteId }, coach, templates] = await Promise.all([
    searchParams,
    getCoachOverview(user.id),
    templateService.listForCoach(user.id),
  ]);

  if (!coach) {
    return (
      <PageShell size="wide">
        <EmptyState title="No coach data found" description="The builder could not load your roster." />
      </PageShell>
    );
  }

  const initialTemplateId = Number(templateId);
  const initialAthleteId = Number(athleteId);

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Plan builder"
        title="Builder workspace"
        description="Assign Tempo templates to your roster without leaving the builder. Pick an athlete, choose a template, preview the session, and schedule it onto the week plan."
        actions={
          <>
            <ActionLink href="/coach/templates" tone="secondary">
              Open template library
            </ActionLink>
            <ActionLink href="/coach">
              View roster
            </ActionLink>
          </>
        }
      />

      <BuilderClient
        athletes={coach.athletes.map((athlete) => ({
          id: athlete.id,
          name: athlete.name,
          email: athlete.email,
          compliancePct: athlete.compliancePct,
          nextSession: athlete.nextSession,
        }))}
        templates={templates}
        initialAthleteId={Number.isInteger(initialAthleteId) && initialAthleteId > 0 ? initialAthleteId : null}
        initialTemplateId={Number.isInteger(initialTemplateId) && initialTemplateId > 0 ? initialTemplateId : null}
        initialScheduledDate={formatISO(new Date(), { representation: 'date' })}
      />
    </PageShell>
  );
}
