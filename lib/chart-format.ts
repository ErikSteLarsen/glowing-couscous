const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDay(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/** "9 Nov" */
export function formatDayShort(day: string) {
  const date = parseDay(day);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "Mon 9 Nov" */
export function formatDayLong(day: string) {
  const date = parseDay(day);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "4.5" hours with one decimal, or whole hours from ten up. */
export function formatHours(durationSec: number) {
  const hours = durationSec / 3600;
  return hours >= 10 ? String(Math.round(hours)) : hours.toFixed(1).replace(/\.0$/, '');
}

/** Rounds a value up to a clean axis maximum whose half is also a clean number. */
export function niceCeiling(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 3, 4, 5, 6, 8, 10].find((multiple) => multiple * power >= value) ?? 10;
  return step * power;
}

export function signed(value: number) {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}
