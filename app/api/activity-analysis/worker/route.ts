import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { activityAnalysisService } from '@/lib/activity-analysis-service';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const expected = Buffer.from(process.env.ACTIVITY_ANALYSIS_WORKER_SECRET ?? '');
  const received = Buffer.from(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '');
  if (!expected.length || received.length !== expected.length || !timingSafeEqual(expected, received)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  return NextResponse.json({ processed: await activityAnalysisService.processPending() });
}
export const GET = POST;
