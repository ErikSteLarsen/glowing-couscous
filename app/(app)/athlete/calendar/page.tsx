import { parseTemplateRoutine } from '@/lib/template-routine';
import { format, isValid, parseISO } from 'date-fns';
import { redirect } from 'next/navigation';
import { PageShell } from '@/components/ui';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { templateService } from '@/lib/template-service';
import { workoutLibraryService } from '@/lib/workout-library-service';
import { derivePlannerSourceDurationSec } from '@/lib/planner-source-metrics';
import { TrainingCalendar } from './TrainingCalendar';

export default async function AthleteCalendarPage({ searchParams }: {
  searchParams: Promise<{ date?: string; weekStart?: string; view?: string; add?: string; template?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');
  const params = await searchParams;
  const requested = parseISO(params.date ?? params.weekStart ?? '');
  const date = format(isValid(requested) ? requested : new Date(), 'yyyy-MM-dd');
  const view = params.view === 'month' ? 'month' : 'week';
  const [calendar, templates, workouts] = await Promise.all([
    athleteService.loadCalendarView(user.id, date, view),
    templateService.listForOwner(user.id),
    workoutLibraryService.listForOwner('athlete', user.id),
  ]);
  if (!calendar) redirect('/login');
  const sources = [
    ...workouts.map(workout => ({ key: `workout:${workout.id}`, id: workout.id,
      kind: 'workout' as const, title: workout.title, sport: workout.sport,
      summary: workout.summary, durationSec: derivePlannerSourceDurationSec(workout.blocks) })),
    ...templates.map(template => ({ key: `template:${template.id}`, id: template.id,
      kind: 'template' as const, title: template.name, sport: parseTemplateRoutine(template.routineJson)?.entries[0].sport ?? 'RUNNING',
      summary: template.summary, routineEntries: parseTemplateRoutine(template.routineJson)?.entries.map(({ weekday, title }) => ({ weekday, title })) })),
  ];
  return <PageShell><TrainingCalendar date={date} view={view} label={calendar.period.label}
    today={format(new Date(), 'yyyy-MM-dd')} initiallyAdding={params.add === '1'} initialTemplateId={params.template ? Number(params.template) : undefined} sources={sources}
    days={(view === 'month' ? calendar.weeks.flat() : calendar.days).map(day => ({ ...day, sessions: day.sessions.map(session => ({ ...session,
      durationSec: session.recordedDurationSec ?? session.durationSec })) }))} /></PageShell>;
}
