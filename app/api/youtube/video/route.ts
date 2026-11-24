import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { getYouTubeSearchService, isYouTubeVideoIdValue } from '@/lib/youtube/youtube-search-service';

const noStore = { 'Cache-Control': 'no-store' };

/** Checks one video (title, live state, embeddable, made for kids) before the ride screen embeds it. */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const videoId = request.nextUrl.searchParams.get('id');
    if (!isYouTubeVideoIdValue(videoId)) {
      return NextResponse.json({ code: 'invalid_input', error: 'Something went wrong. Reload the page and try again.' }, { status: 400, headers: noStore });
    }

    const outcome = await getYouTubeSearchService().video({ userId: user.id, videoId });
    if (!outcome.ok) {
      return NextResponse.json({ code: outcome.code, error: outcome.error }, { status: outcome.status, headers: noStore });
    }
    return NextResponse.json(outcome.lookup, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ code: 'unavailable', error: 'Could not check this video. Try again.' }, { status: 500, headers: noStore });
  }
}
