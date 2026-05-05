import { prisma } from '@/lib/prisma';

export async function getCurrentCoach() {
  return prisma.user.findFirst({ where: { role: 'COACH' } });
}

export async function getCurrentAthleteUser() {
  return prisma.user.findFirst({
    where: { role: 'ATHLETE' },
    include: {
      athleteProfile: true,
    },
  });
}
