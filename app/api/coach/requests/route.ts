import { NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachRequestService } from '@/lib/coach-request-service';

export async function GET() {
  const { user, error } = await requireCoach();
  if (error) return error;

  const requests = await coachRequestService.listPendingForCoach(user.id);

  return NextResponse.json({ requests });
}
