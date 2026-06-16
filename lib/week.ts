import { addDays, format, isSameDay, startOfWeek } from 'date-fns';

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
