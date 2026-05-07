import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { requestId } = await params;
  const { action } = await req.json();

  const request = await prisma.coachRequest.findUnique({ where: { id: Number(requestId) } });
  if (!request || request.coachId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (action === 'accept') {
    try {
      await prisma.$transaction([
        prisma.coachRequest.update({ where: { id: request.id }, data: { status: 'ACCEPTED' } }),
        prisma.athleteProfile.create({ data: { userId: request.athleteId, coachId: user.id } }),
      ]);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') {
        return NextResponse.json({ error: 'Athlete already has a coach' }, { status: 409 });
      }
      throw e;
    }
  } else if (action === 'reject') {
    await prisma.coachRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
