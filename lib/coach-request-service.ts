import { prisma } from '@/lib/prisma';

type CoachRequestServiceDeps = {
  db?: typeof prisma;
};

type CoachRequestAction = 'accept' | 'reject';

type CoachRequestResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function createCoachRequestService({ db = prisma }: CoachRequestServiceDeps = {}) {
  return {
    async searchCoaches(query: string) {
      const q = query.trim();
      if (!q) {
        return [];
      }

      return db.user.findMany({
        where: {
          role: 'COACH',
          OR: [{ name: { contains: q } }, { email: { contains: q } }],
        },
        select: { id: true, name: true, email: true },
        take: 10,
      });
    },

    async listForAthlete(athleteUserId: number) {
      return db.coachRequest.findMany({
        where: { athleteId: athleteUserId },
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
    },

    async createForAthlete(athleteUserId: number, coachId: number): Promise<CoachRequestResult> {
      const coach = await db.user.findUnique({ where: { id: coachId } });
      if (!coach || coach.role !== 'COACH') {
        return { ok: false, status: 404, error: 'Coach not found' };
      }

      try {
        await db.coachRequest.create({
          data: { athleteId: athleteUserId, coachId, status: 'PENDING' },
        });
        return { ok: true };
      } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002') {
          return { ok: false, status: 409, error: 'Request already sent' };
        }
        throw error;
      }
    },

    async listPendingForCoach(coachUserId: number) {
      return db.coachRequest.findMany({
        where: { coachId: coachUserId, status: 'PENDING' },
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    },

    async decideForCoach(coachUserId: number, requestId: number, action: CoachRequestAction): Promise<CoachRequestResult> {
      const request = await db.coachRequest.findUnique({ where: { id: requestId } });
      if (!request || request.coachId !== coachUserId) {
        return { ok: false, status: 404, error: 'Not found' };
      }
      if (request.status !== 'PENDING') {
        return { ok: false, status: 409, error: 'Request already resolved' };
      }

      if (action === 'accept') {
        try {
          await db.$transaction([
            db.coachRequest.update({ where: { id: request.id }, data: { status: 'ACCEPTED' } }),
            db.athleteProfile.create({ data: { userId: request.athleteId, coachId: coachUserId } }),
          ]);
          return { ok: true };
        } catch (error: unknown) {
          if ((error as { code?: string }).code === 'P2002') {
            return { ok: false, status: 409, error: 'Athlete already has a coach' };
          }
          throw error;
        }
      }

      await db.coachRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
      return { ok: true };
    },
  };
}

export const coachRequestService = createCoachRequestService();
