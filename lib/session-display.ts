import { format } from 'date-fns';

export function formatSessionWhen(date: Date, timeLabel: string | null) {
  const dayLabel = format(date, 'EEE\u00A0d\u00A0MMM');
  return timeLabel ? `${dayLabel}, ${timeLabel}` : dayLabel;
}
