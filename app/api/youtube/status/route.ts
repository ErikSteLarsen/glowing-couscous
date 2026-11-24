import { NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { getYouTubeSearchService } from '@/lib/youtube/youtube-search-service';

/** Whether YouTube search is set up, so the ride screen can offer search or link pasting. Costs no quota. */
export async function GET() {
  const { error } = await requireAthlete();
  if (error) return error;
  return NextResponse.json({ searchConfigured: getYouTubeSearchService().isConfigured() }, { headers: { 'Cache-Control': 'no-store' } });
}
