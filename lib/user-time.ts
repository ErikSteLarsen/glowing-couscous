/**
 * The user's calendar in their own IANA time zone. Servers run in their own zone
 * (UTC on Vercel), so "today" and day/week boundaries are derived here from the
 * zone the browser reports instead of the server clock's local calendar.
 *
 * Day keys are `yyyy-MM-dd`. Stored session dates keep their own convention
 * (UTC midnight of the calendar day); these helpers only decide which calendar
 * day it is for the user, and where that day starts and ends as UTC instants.
 */

export const TIME_ZONE_COOKIE = 'tempo-tz';
export const DEFAULT_TIME_ZONE = 'UTC';

type DayKey = string;

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallClockFormatter(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function wallClock(instant: Date, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const part of wallClockFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second };
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Offset of the zone from UTC at an instant, in milliseconds (Oslo in winter: +3 600 000). */
function zoneOffsetMs(instant: number, timeZone: string) {
  const wall = wallClock(new Date(instant), timeZone);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

function parseDayKey(day: DayKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new RangeError(`Invalid day key: ${day}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function nextDayKey(day: DayKey): DayKey {
  const parts = parseDayKey(day);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1)).toISOString().slice(0, 10);
}

/** Returns a valid IANA zone in its canonical spelling, or UTC for anything unusable. */
export function resolveTimeZone(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return DEFAULT_TIME_ZONE;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** The calendar day an instant falls on in the zone. */
export function dayKeyInZone(instant: Date, timeZone: string): DayKey {
  const wall = wallClock(instant, timeZone);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
}

/** The user's calendar day right now. */
export function todayInZone(timeZone: string, now: Date = new Date()): DayKey {
  return dayKeyInZone(now, timeZone);
}

/** Hour of day (0-23) on the user's wall clock. */
export function hourInZone(timeZone: string, now: Date = new Date()): number {
  return wallClock(now, timeZone).hour;
}

/** First instant of the calendar day in the zone, as a UTC instant. */
export function startOfDayInZone(day: DayKey, timeZone: string): Date {
  const parts = parseDayKey(day);
  const wallMidnight = Date.UTC(parts.year, parts.month - 1, parts.day);
  // The offset can change between UTC midnight and local midnight; try both.
  const candidates = [...new Set([
    wallMidnight - zoneOffsetMs(wallMidnight, timeZone),
    wallMidnight - zoneOffsetMs(wallMidnight - zoneOffsetMs(wallMidnight, timeZone), timeZone),
  ])].sort((a, b) => a - b);
  const onDay = candidates.find((candidate) => dayKeyInZone(new Date(candidate), timeZone) === day);
  // Zones that skip midnight start the day at the end of the gap.
  return new Date(onDay ?? candidates[candidates.length - 1]);
}

/** Last millisecond of the calendar day in the zone, as a UTC instant. */
export function endOfDayInZone(day: DayKey, timeZone: string): Date {
  return new Date(startOfDayInZone(nextDayKey(day), timeZone).getTime() - 1);
}
