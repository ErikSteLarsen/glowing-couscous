'use client';

import Link from 'next/link';
import { TopBar, secondaryButtonClassName } from '@/components/ui';
import { getCalendarHref, type CalendarPlacement as PlacementKind, type CalendarView } from '@/lib/calendar-navigation';
import { derivePlannerSourceDurationSec, type PlannerSourceMetricBlock } from '@/lib/planner-source-metrics';
import { getTemplateCadence } from '@/lib/template-cadence';
import { PlannerDesk, type PlannerDeskCalendarDay, type PlannerDeskSource, type PlannerDeskSourceKind } from '@/components/PlannerDesk';

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

export function CalendarPlacement({
  view,
  placement,
  templates,
  workouts,
  calendarDays,
  calendarLabel,
  initialDate,
  today,
  initialSourceKey,
  initialSourceTab,
  initialMessage,
}: {
  view: CalendarView;
  placement: PlacementKind;
  templates: AthletePlannerTemplate[];
  workouts: AthletePlannerWorkout[];
  calendarDays: PlannerDeskCalendarDay[];
  calendarLabel: string;
  initialDate: string;
  today: string;
  initialSourceKey: string;
  initialSourceTab: PlannerDeskSourceKind;
  initialMessage: string;
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
      // Routines apply to a Monday week or a whole month (athlete-planner-service);
      // the legacy "day" column default would offer a range the service refuses.
      cadence: getTemplateCadence(template.cadence) === 'month' ? 'month' as const : 'week' as const,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <TopBar
        back={{ href: getCalendarHref(view, initialDate), destination: 'Calendar', label: 'Back to Calendar' }}
        title={placement === 'template' ? 'Apply a routine' : 'Add to calendar'}
        actions={<Link href={getCalendarHref(view, initialDate)} className={secondaryButtonClassName}>Done</Link>}
      />
      <PlannerDesk
      key={`${initialDate}:${initialSourceKey}`}
      role="athlete"
      initialDate={initialDate}
      today={today}
      calendarLabel={calendarLabel}
      calendarDays={calendarDays}
      sources={sources}
      initialSourceKey={initialSourceKey}
      initialSourceTab={initialSourceTab}
      initialMessage={initialMessage}
      getNavigationHref={(date, sourceKey) => {
        const href = getCalendarHref(view, date, { place: placement });
        return sourceKey ? `${href}&${new URLSearchParams({ source: sourceKey })}` : href;
      }}
    />
    </div>
  );
}
