import { NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { workoutLlm } from '@/lib/workout-llm';

export async function GET() {
  const { error } = await requireAthlete();
  if (error) return error;
  const status = await workoutLlm.getStatus();
  return NextResponse.json({ status }, { headers: { 'Cache-Control': 'private, no-store' } });
}
