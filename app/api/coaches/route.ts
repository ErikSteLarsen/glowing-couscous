import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { error } = await requireAthlete();
  if (error) return error;

  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ coaches: [] });

  const coaches = await prisma.user.findMany({
    where: {
      role: 'COACH',
      OR: [{ name: { contains: q } }, { email: { contains: q } }],
    },
    select: { id: true, name: true, email: true },
    take: 10,
  });

  return NextResponse.json({ coaches });
}
