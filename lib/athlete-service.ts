import { plannerService } from '@/lib/planner-service';
import { prisma } from '@/lib/prisma';

type AthleteServiceDeps = {
  db?: typeof prisma;
  planner?: typeof plannerService;
};

export function createAthleteService({ db = prisma, planner = plannerService }: AthleteServiceDeps = {}) {
  async function listRequestsForAthlete(userId: number) {
    return db.coachRequest.findMany({
      where: { athleteId: userId },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

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

    async listForAthlete(userId: number) {
      return listRequestsForAthlete(userId);
    },

    async loadCoachSearchState(userId: number) {
      const [profile, requests] = await Promise.all([
        db.athleteProfile.findUnique({ where: { userId } }),
        listRequestsForAthlete(userId),
      ]);

      return {
        profile,
        requests,
        latestRequest: requests[0] ?? null,
      };
    },

    async loadProfileState(userId: number) {
      const profile = await db.athleteProfile.findUnique({ where: { userId } });
      if (profile) {
        return { profile, latestRequest: null };
      }

      const latestRequest = (await listRequestsForAthlete(userId)).find(
        (request) => request.status === 'PENDING' || request.status === 'REJECTED',
      );

      return { profile: null, latestRequest };
    },
  };
}

export const athleteService = createAthleteService();
