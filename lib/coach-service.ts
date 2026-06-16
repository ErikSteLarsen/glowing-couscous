import { startOfWeek } from 'date-fns';
import { prisma } from '@/lib/prisma';

type CoachServiceDeps = {
  db?: typeof prisma;
  now?: () => Date;
};

export function createCoachService({ db = prisma, now = () => new Date() }: CoachServiceDeps = {}) {
  return {
    async getOverview(coachId: number) {
      const coach = await db.user.findUnique({
        where: { id: coachId },
        include: {
          coachedAthletes: {
            include: {
              user: true,
              planWeeks: {
                where: {
                  weekStart: startOfWeek(now(), { weekStartsOn: 1 }),
                },
                include: {
                  sessions: true,
                },
              },
            },
          },
        },
      });

      if (coach) {
        coach.coachedAthletes.sort((left, right) => left.user.name.localeCompare(right.user.name));
      }

      return coach;
    },
  };
}

export const coachService = createCoachService();

export async function getCoachOverview(coachId: number) {
  return coachService.getOverview(coachId);
}
