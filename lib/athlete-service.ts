import { plannerService } from '@/lib/planner-service';
import { prisma } from '@/lib/prisma';

type AthleteServiceDeps = {
  db?: typeof prisma;
  planner?: typeof plannerService;
};

export function createAthleteService({ db = prisma, planner = plannerService }: AthleteServiceDeps = {}) {
  return {
    async findProfileByUserId(userId: number) {
      return db.athleteProfile.findUnique({ where: { userId } });
    },

    async loadWeekByUserId(userId: number, weekStart: Date | string) {
      const profile = await db.athleteProfile.findUnique({ where: { userId } });
      if (!profile) {
        return null;
      }

      const snapshot = await planner.forWeek({ athleteId: profile.id, weekStart }).load();
      return { profile, snapshot };
    },

    async loadProfileState(userId: number) {
      const profile = await db.athleteProfile.findUnique({ where: { userId } });
      if (profile) {
        return { profile, latestRequest: null };
      }

      const latestRequest = await db.coachRequest.findFirst({
        where: {
          athleteId: userId,
          status: {
            in: ['PENDING', 'REJECTED'],
          },
        },
        include: {
          coach: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });

      return { profile: null, latestRequest };
    },
  };
}

export const athleteService = createAthleteService();
