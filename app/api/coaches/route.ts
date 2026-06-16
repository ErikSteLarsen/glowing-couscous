import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { coachRequestService } from '@/lib/coach-request-service';

export async function GET(req: NextRequest) {
  const { error } = await requireAthlete();
  if (error) return error;

  const q = req.nextUrl.searchParams.get('q') ?? '';
  const coaches = await coachRequestService.searchCoaches(q);

  return NextResponse.json({ coaches });
}
