import { format } from 'date-fns';

export function formatSessionWhen(date: Date, timeLabel: string | null) {
  const dayLabel = format(date, 'EEE d MMM');
  return timeLabel ? `${dayLabel} · ${timeLabel}` : dayLabel;
}
