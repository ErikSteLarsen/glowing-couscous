'use client';

import { derivePlannerSourceDurationSec, type PlannerSourceMetricBlock } from '@/lib/planner-source-metrics';
import { getTemplateCadence } from '@/lib/template-cadence';
import { PlannerDesk, type PlannerDeskCalendarDay, type PlannerDeskSource } from '@/components/PlannerDesk';

type AthletePlannerWorkout = {
  id: number;
  sport: string;
  title: string;
  summary: string | null;
  blocks: PlannerSourceMetricBlock[];
};

type AthletePlannerTemplate = {
  id: number;
  name: string;
  sport: string;
  summary: string | null;
  cadence?: string | null;
};

export function AthletePlannerClient({
  templates,
  workouts,
  calendarDays,
  calendarLabel,
  initialDate,
}: {
  templates: AthletePlannerTemplate[];
  workouts: AthletePlannerWorkout[];
  calendarDays: PlannerDeskCalendarDay[];
  calendarLabel: string;
  initialDate: string;
}) {
  const sources: PlannerDeskSource[] = [
    ...workouts.map((workout) => ({
      key: `workout:${workout.id}`,
      id: workout.id,
      kind: 'workout' as const,
      title: workout.title,
      sport: workout.sport,
      summary: workout.summary,
      durationSec: derivePlannerSourceDurationSec(workout.blocks),
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
  ];

  return (
    <PlannerDesk
      key={initialDate}
      role="athlete"
      initialDate={initialDate}
      calendarLabel={calendarLabel}
      calendarDays={calendarDays}
      sources={sources}
    />
  );
}
