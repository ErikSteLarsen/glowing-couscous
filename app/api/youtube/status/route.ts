import { NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { getYouTubeVideoService } from '@/lib/youtube/youtube-video-service';

/** Whether Tempo can check videos (a YouTube API key is set), so the ride screen can say up front that videos open on YouTube. Costs no quota. */
export async function GET() {
  const { error } = await requireAthlete();
  if (error) return error;
  return NextResponse.json({ configured: getYouTubeVideoService().isConfigured() }, { headers: { 'Cache-Control': 'no-store' } });
}
