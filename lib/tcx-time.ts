function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function offsetLabel(offsetMinutes: number) {
  if (offsetMinutes === 0) return 'UTC';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
  const minutes = String(absoluteMinutes % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}

export function formatActivityDateTime(value: Date | string, sourceTimezoneOffsetMinutes: number) {
  const instant = asDate(value);
  const sourceLocalTime = new Date(instant.getTime() + sourceTimezoneOffsetMinutes * 60_000);
  const dateTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(sourceLocalTime);
  return `${dateTime} (${offsetLabel(sourceTimezoneOffsetMinutes)})`;
}

export const formatTcxDateTime = formatActivityDateTime;

export function getTcxCalendarDay(value: Date, sourceTimezoneOffsetMinutes: number) {
  const sourceLocalTime = new Date(value.getTime() + sourceTimezoneOffsetMinutes * 60_000);
  const year = sourceLocalTime.getUTCFullYear();
  const month = String(sourceLocalTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(sourceLocalTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
