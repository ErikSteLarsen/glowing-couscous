'use client';

import { derivePlannerSourceDurationSec, type PlannerSourceMetricBlock } from '@/lib/planner-source-metrics';
import { PlannerDesk } from '@/components/PlannerDesk';
import type { PlannerAthlete, PlannerCalendarDay, CoachPlannerSource } from '@/lib/planner-view';

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
  librarySessions,
  trainingPlans,
  calendarDays,
  calendarLabel,
  initialAthleteId,
  initialDate,
  today,
}: {
  athletes: PlannerAthlete[];
  librarySessions: PlannerLibrarySession[];
  trainingPlans: PlannerTrainingPlan[];
  calendarDays: PlannerCalendarDay[];
  calendarLabel: string;
  initialAthleteId: number | null;
  initialDate: string;
  today: string;
}) {
  const sources: CoachPlannerSource[] = [
    ...librarySessions.map((session) => ({
      key: `workout:${session.id}`,
      id: session.id,
      kind: 'workout' as const,
      title: session.title,
      sport: session.sport,
      summary: session.summary,
      durationSec: derivePlannerSourceDurationSec(session.blocks),
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
      today={today}
      calendarLabel={calendarLabel}
      calendarDays={calendarDays}
      sources={sources}
      athletes={athletes}
      initialAthleteId={initialAthleteId}
    />
  );
}
