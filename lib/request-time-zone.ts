import { cookies } from 'next/headers';
import { TIME_ZONE_COOKIE, resolveTimeZone } from './user-time.ts';

/**
 * The signed-in user's IANA time zone for this request, as reported by their
 * browser through the `tempo-tz` cookie (see components/TimeZoneSync.tsx).
 * Falls back to UTC until the browser has reported one.
 */
export async function getRequestTimeZone(): Promise<string> {
  const cookieStore = await cookies();
  return resolveTimeZone(cookieStore.get(TIME_ZONE_COOKIE)?.value);
}
