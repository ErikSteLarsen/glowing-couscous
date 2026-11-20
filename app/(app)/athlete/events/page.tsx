import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteEventService } from '@/lib/athlete-event-service';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { todayInZone } from '@/lib/user-time';
import { EventsClient } from './EventsClient';

export const metadata: Metadata = { title: 'Events' };

export default async function AthleteEventsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');
  const events = await athleteEventService.list(user.id);
  if (!events) redirect('/athlete/find-coach');
  return <EventsClient initialEvents={events.map((event) => ({ ...event, eventDate: event.eventDate.toISOString() }))} today={todayInZone(await getRequestTimeZone())} />;
}
