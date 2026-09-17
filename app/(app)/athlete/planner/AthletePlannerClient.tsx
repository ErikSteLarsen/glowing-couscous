'use client';

import { getTemplateCadence } from '@/lib/template-cadence';
import { PlannerDesk, type PlannerDeskCalendarDay, type PlannerDeskSource } from '@/components/PlannerDesk';

type AthletePlannerWorkout = {
  id: number;
  sport: string;
  title: string;
  summary: string | null;
  blocks: Array<{ durationSec: number }>;
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
      durationSec: workout.blocks.reduce((total, block) => total + block.durationSec, 0),
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
