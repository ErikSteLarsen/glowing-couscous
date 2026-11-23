import { prisma } from './prisma.ts';

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
      const athlete = await db.user.findUnique({
        where: { id: athleteUserId },
        select: { role: true, coachId: true, selfCoached: true },
      });
      if (!athlete || athlete.role !== 'ATHLETE') {
        return { ok: false, status: 403, error: 'Only athletes can ask a coach to join.' };
      }
      if (athlete.coachId !== null) {
        return { ok: false, status: 409, error: 'You already have a coach.' };
      }

      const coach = await db.user.findUnique({ where: { id: coachId } });
      if (!coach || coach.role !== 'COACH') {
        return { ok: false, status: 404, error: 'Coach not found.' };
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
              ? 'You already have a request waiting for an answer.'
              : 'Wait for an answer to your current request before you send another.',
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
        return { ok: false, status: 409, error: 'You already have a request waiting for an answer.' };
      }

      if (existingRequest && existingRequest.status === 'REJECTED') {
        await db.coachRequest.update({
          where: { id: existingRequest.id },
          data: { status: 'PENDING', pendingAthleteId: athleteUserId },
        });
        return { ok: true };
      }

      if (existingRequest) {
        return { ok: false, status: 409, error: 'This request has already been answered.' };
      }

      try {
        await db.coachRequest.create({
          data: {
            athleteId: athleteUserId,
            coachId,
            pendingAthleteId: athleteUserId,
            status: 'PENDING',
          },
        });
        return { ok: true };
      } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002') {
          return { ok: false, status: 409, error: 'You already have a request waiting for an answer.' };
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
        return { ok: false, status: 404, error: 'Request not found.' };
      }
      if (request.status !== 'PENDING') {
        return { ok: false, status: 409, error: 'This request has already been answered.' };
      }

      if (action === 'accept') {
        const athlete = await db.user.findUnique({
          where: { id: request.athleteId },
          select: { id: true, role: true, coachId: true },
        });

        if (!athlete || athlete.role !== 'ATHLETE') {
          return { ok: false, status: 404, error: 'Athlete not found.' };
        }
        if (athlete.coachId && athlete.coachId !== coachUserId) {
          return { ok: false, status: 409, error: 'You already have a coach.' };
        }

        await db.$transaction([
          db.coachRequest.update({
            where: { id: request.id },
            data: { status: 'ACCEPTED', pendingAthleteId: null },
          }),
          db.coachRequest.updateMany({
            where: {
              athleteId: request.athleteId,
              status: 'PENDING',
              id: { not: request.id },
            },
            data: { status: 'REJECTED', pendingAthleteId: null },
          }),
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

      await db.coachRequest.update({
        where: { id: request.id },
        data: { status: 'REJECTED', pendingAthleteId: null },
      });
      return { ok: true };
    },
  };
}

export const coachRequestService = createCoachRequestService();
