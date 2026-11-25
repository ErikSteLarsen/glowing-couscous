import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth-session';
import { loginPathFor } from '@/lib/auth-callback';
import { SEND_PATH } from '@/lib/youtube/send-to-ride';
import { SendToRide } from './SendToRide';

export const metadata: Metadata = { title: 'Send to ride' };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/** The small window the "Send to Wattonaut" bookmark opens on a YouTube video: it hands the video to an open ride tab. */
export default async function SendToRidePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const url = first(params.u);
  const startSec = first(params.t);
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') {
    const query = new URLSearchParams();
    if (url) query.set('u', url);
    if (startSec) query.set('t', startSec);
    redirect(loginPathFor(`${SEND_PATH}${query.size ? `?${query}` : ''}`));
  }
  return <SendToRide url={url} startSec={startSec} />;
}
