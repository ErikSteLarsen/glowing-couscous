import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { user, error } = await requireAthlete();
  if (error) return error;

  const body = await req.json();
  const coachId = Number(body.coachId);
  if (!coachId || Number.isNaN(coachId)) {
    return NextResponse.json({ error: 'Invalid coachId' }, { status: 400 });
  }

  const coach = await prisma.user.findUnique({ where: { id: coachId, role: 'COACH' } });
  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });

  try {
    await prisma.coachRequest.create({
      data: { athleteId: user.id, coachId, status: 'PENDING' },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Request already sent' }, { status: 409 });
    }
    throw e;
  }
}
