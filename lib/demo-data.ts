import { addDays, endOfWeek, format, isSameDay, startOfWeek, subWeeks } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { templateService } from '@/lib/template-service';

export const sportLabels = {
  RUNNING: 'Running',
  BIKING: 'Biking',
  SWIMMING: 'Swimming',
  STRENGTH: 'Strength',
  STRETCHING: 'Stretching',
  REST: 'Rest',
} as const;

export async function getCoachOverview() {
  const coach = await prisma.user.findFirst({
    where: { role: 'COACH' },
    include: {
      coachedAthletes: {
        include: {
          user: true,
          planWeeks: {
            where: {
              weekStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
            },
            include: {
              sessions: true,
            },
          },
        },
      },
    },
  });

  if (coach) {
    coach.coachedAthletes.sort((left, right) => left.user.name.localeCompare(right.user.name));
  }

  return coach;
}

export async function getCoachTemplates() {
  const coach = await prisma.user.findFirst({ where: { role: 'COACH' } });
  if (!coach) {
    return [];
  }

  return templateService.listForCoach(coach.id);
}

export function getWeekDays(baseDate: Date) {
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      date,
      shortLabel: format(date, 'EEE'),
      dayNumber: format(date, 'd'),
      fullLabel: format(date, 'EEEE d MMM'),
    };
  });
}

export function groupSessionsByDay<T extends { scheduledDate: Date }>(sessions: T[], weekBaseDate: Date) {
  return getWeekDays(weekBaseDate).map((day) => ({
    ...day,
    sessions: sessions.filter((session) => isSameDay(session.scheduledDate, day.date)),
  }));
}

export function getPlannerQueryWeekStart(value?: string) {
  if (!value) {
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  }

  return startOfWeek(parsed, { weekStartsOn: 1 });
}
