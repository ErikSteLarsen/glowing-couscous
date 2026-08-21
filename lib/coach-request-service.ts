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

      const coaches = await db.user.findMany({
        where: {
          role: 'COACH',
          OR: [{ name: { contains: q } }, { email: { contains: q } }],
        },
        select: { id: true, name: true, email: true },
        take: 10,
      });

      return coaches.map((coach) => ({ ...coach, name: coach.name ?? '' }));
    },

    async listForAthlete(athleteUserId: number) {
      const requests = await db.coachRequest.findMany({
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

      return requests.map((request) => ({
        ...request,
        coach: { ...request.coach, name: request.coach.name ?? '' },
      }));
    },

    async createForAthlete(athleteUserId: number, coachId: number): Promise<CoachRequestResult> {
      const coach = await db.user.findUnique({ where: { id: coachId } });
      if (!coach || coach.role !== 'COACH') {
        return { ok: false, status: 404, error: 'Coach not found' };
      }

      const existingPendingRequest = await db.coachRequest.findFirst({
        where: { athleteId: athleteUserId, status: 'PENDING' },
      });
      if (existingPendingRequest) {
        return {
          ok: false,
          status: 409,
          error:
            existingPendingRequest.coachId === coachId
              ? 'Request already pending'
              : 'Wait for current request before sending another one',
        };
      }

      const existingRequest = await db.coachRequest.findUnique({
        where: {
          athleteId_coachId: {
            athleteId: athleteUserId,
            coachId,
          },
        },
      });

      if (existingRequest && existingRequest.status === 'PENDING') {
        return { ok: false, status: 409, error: 'Request already pending' };
      }

      if (existingRequest && existingRequest.status === 'REJECTED') {
        await db.coachRequest.update({
          where: { id: existingRequest.id },
          data: { status: 'PENDING' },
        });
        return { ok: true };
      }

      try {
        await db.coachRequest.create({
          data: { athleteId: athleteUserId, coachId, status: 'PENDING' },
        });
        return { ok: true };
      } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002') {
          return { ok: false, status: 409, error: 'Request already pending' };
        }
        throw error;
      }
    },

    async listPendingForCoach(coachUserId: number) {
      const requests = await db.coachRequest.findMany({
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

      return requests.map((request) => ({
        ...request,
        athlete: { ...request.athlete, name: request.athlete.name ?? '' },
      }));
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
        const athlete = await db.user.findUnique({
          where: { id: request.athleteId },
          select: { id: true, role: true, coachId: true },
        });

        if (!athlete || athlete.role !== 'ATHLETE') {
          return { ok: false, status: 404, error: 'Athlete not found' };
        }
        if (athlete.coachId && athlete.coachId !== coachUserId) {
          return { ok: false, status: 409, error: 'Athlete already has a coach' };
        }

        await db.$transaction([
          db.coachRequest.update({ where: { id: request.id }, data: { status: 'ACCEPTED' } }),
          db.user.update({
            where: { id: request.athleteId },
            data: {
              coachId: coachUserId,
              selfCoached: false,
            },
          }),
        ]);
        return { ok: true };
      }

      await db.coachRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
      return { ok: true };
    },
  };
}

export const coachRequestService = createCoachRequestService();
