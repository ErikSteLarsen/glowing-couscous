import { NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { user, error } = await requireCoach();
  if (error) return error;

  const requests = await prisma.coachRequest.findMany({
    where: { coachId: user.id, status: 'PENDING' },
    include: { athlete: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ requests });
}
