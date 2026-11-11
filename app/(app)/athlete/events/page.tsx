import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteEventService } from '@/lib/athlete-event-service';
import { EventsClient } from './EventsClient';

export const metadata: Metadata = { title: 'Events' };

export default async function AthleteEventsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');
  const events = await athleteEventService.list(user.id);
  if (!events) redirect('/athlete/find-coach');
  return <EventsClient initialEvents={events.map((event) => ({ ...event, eventDate: event.eventDate.toISOString() }))} today={format(new Date(), 'yyyy-MM-dd')} />;
}
