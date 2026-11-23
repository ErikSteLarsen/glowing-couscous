export const plannedTimeErrorMessage = 'Enter a start time between 00:00 and 23:59.';

const plannedTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

// Empty input means the session is untimed and is stored as null.
export function parsePlannedTime(input: unknown): { ok: true; timeLabel: string | null } | { ok: false; error: string } {
  if (input === undefined || input === null || input === '') return { ok: true, timeLabel: null };
  if (typeof input !== 'string' || !plannedTimePattern.test(input)) return { ok: false, error: plannedTimeErrorMessage };
  return { ok: true, timeLabel: input };
}
