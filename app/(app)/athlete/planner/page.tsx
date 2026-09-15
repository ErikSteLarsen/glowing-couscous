import { addWeeks, format, formatISO, isValid, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

import { ActionLink, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { athletePlannerService } from '@/lib/athlete-planner-service';
import { workoutLibraryService } from '@/lib/workout-library-service';
import { accountService } from '@/lib/account-service';

import { AthletePlannerClient } from './AthletePlannerClient';

export default async function AthletePlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; templateId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { date, templateId } = await searchParams;
  const [workspace, workouts, account] = await Promise.all([
    athletePlannerService.loadWorkspace(user.id, date),
    workoutLibraryService.listForOwner('athlete', user.id),
    accountService.getAccount(user.id),
  ]);
  const parsedTemplateId = Number(templateId);
  const requestedDate = date ? parseISO(date) : new Date();
  const resolvedDate = isValid(requestedDate) ? requestedDate : new Date();
  const initialDate = formatISO(resolvedDate, { representation: 'date' });
  const previousWeekHref = `/athlete/planner?date=${format(addWeeks(workspace.period.start, -1), 'yyyy-MM-dd')}`;
  const nextWeekHref = `/athlete/planner?date=${format(addWeeks(workspace.period.start, 1), 'yyyy-MM-dd')}`;

  return (
    <PageShell size="wide" className="max-w-[1400px]">
      <TopBar
        title="Planner"
        description="Place workouts and templates on one or more days. This is where your schedule changes."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <nav aria-label="Planner week navigation" className="flex flex-wrap items-center gap-2">
              <ActionLink href={previousWeekHref} tone="secondary" size="compact">
                <ChevronLeft aria-hidden="true" className="mr-1 h-4 w-4" />
                Previous
              </ActionLink>
              <ActionLink href="/athlete/planner" tone="secondary" size="compact">
                This week
              </ActionLink>
              <ActionLink href={nextWeekHref} tone="secondary" size="compact">
                Next
                <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4" />
              </ActionLink>
            </nav>
            <ActionLink href="/athlete/templates" tone="secondary">
              Templates
            </ActionLink>
          </div>
        }
      />
      <AthletePlannerClient
        athleteId={user.id}
        templates={workspace.templates}
        workouts={workouts}
        days={workspace.days}
        periodLabel={workspace.period.label}
        initialDate={initialDate}
        initialTemplateId={Number.isInteger(parsedTemplateId) ? parsedTemplateId : null}
        performanceProfile={account?.performanceProfile}
      />
    </PageShell>
  );
}
