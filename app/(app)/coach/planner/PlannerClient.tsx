'use client';

import { derivePlannerSourceDurationSec, type PlannerSourceMetricBlock } from '@/lib/planner-source-metrics';
import { getTemplateCadence } from '@/lib/template-cadence';
import { PlannerDesk } from '@/components/PlannerDesk';
import type { PlannerAthlete, PlannerCalendarDay, PlannerSource } from '@/lib/planner-view';

type PlannerTemplate = {
  id: number;
  name: string;
  sport: string;
  summary: string | null;
  cadence?: string | null;
};

type PlannerLibrarySession = {
  id: number;
  title: string;
  sport: string;
  summary: string | null;
  blocks: PlannerSourceMetricBlock[];
};

type PlannerTrainingPlan = {
  id: number;
  name: string;
  sport: string;
  summary?: string | null;
  sessions: Array<{ title: string; planWeekday: number | null }>;
};

export function PlannerClient({
  athletes,
  templates,
  librarySessions,
  trainingPlans,
  calendarDays,
  calendarLabel,
  initialAthleteId,
  initialDate,
}: {
  athletes: PlannerAthlete[];
  templates: PlannerTemplate[];
  librarySessions: PlannerLibrarySession[];
  trainingPlans: PlannerTrainingPlan[];
  calendarDays: PlannerCalendarDay[];
  calendarLabel: string;
  initialAthleteId: number | null;
  initialDate: string;
}) {
  const sources: PlannerSource[] = [
    ...librarySessions.map((session) => ({
      key: `workout:${session.id}`,
      id: session.id,
      kind: 'workout' as const,
      title: session.title,
      sport: session.sport,
      summary: session.summary,
      durationSec: derivePlannerSourceDurationSec(session.blocks),
    })),
    ...templates.map((template) => ({
      key: `template:${template.id}`,
      id: template.id,
      kind: 'template' as const,
      title: template.name,
      sport: template.sport,
      summary: template.summary,
      cadence: getTemplateCadence(template.cadence),
    })),
    ...trainingPlans.map((plan) => ({
      key: `training-plan:${plan.id}`,
      id: plan.id,
      kind: 'training-plan' as const,
      title: plan.name,
      sport: plan.sport,
      summary: plan.summary ?? null,
      sessionCount: plan.sessions.length,
    })),
  ];

  return (
    <PlannerDesk
      key={initialDate}
      role="coach"
      initialDate={initialDate}
      calendarLabel={calendarLabel}
      calendarDays={calendarDays}
      sources={sources}
      athletes={athletes}
      initialAthleteId={initialAthleteId}
    />
  );
}
