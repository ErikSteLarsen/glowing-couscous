import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { getYouTubeSearchService, parseYouTubeSearchQuery } from '@/lib/youtube/youtube-search-service';

const noStore = { 'Cache-Control': 'no-store' };

/** Searches YouTube, or lists a channel’s videos, for the ride screen’s entertainment view. */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const params = request.nextUrl.searchParams;
    const query = parseYouTubeSearchQuery({
      q: params.get('q'),
      pageToken: params.get('pageToken'),
      channelId: params.get('channelId'),
      order: params.get('order'),
    });
    if (!query) {
      return NextResponse.json({ code: 'invalid_input', error: 'Something went wrong. Reload the page and try again.' }, { status: 400, headers: noStore });
    }

    const outcome = await getYouTubeSearchService().search({ userId: user.id, ...query });
    if (!outcome.ok) {
      return NextResponse.json({ code: outcome.code, error: outcome.error }, { status: outcome.status, headers: noStore });
    }
    return NextResponse.json(outcome.page, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ code: 'unavailable', error: 'Could not load videos. Try again.' }, { status: 500, headers: noStore });
  }
}
