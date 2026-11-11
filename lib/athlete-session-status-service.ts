import { prisma } from './prisma.ts';

export const SKIPPED_SESSION_STATUS = 'skipped';

type StatusSession = {
  id: number;
  athleteId: number | null;
  coachOwnerId: number | null;
  trainingPlanId: number | null;
  assignedById: number | null;
  status: string;
  activity: { id: number } | null;
};

export type SessionStatusAction = 'skip' | 'plan-again';

export type SessionStatusResult =
  | { ok: true; sessionId: number; status: 'planned' | 'skipped' }
  | { ok: false; status: 403 | 404 | 409; error: string };

type StatusDatabase = {
  session: {
    findUnique(args: unknown): Promise<StatusSession | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
};

/**
 * A personal session is one the athlete created or copied for themselves in
 * Planner. Coach-owned, training-plan, and coach-assigned sessions are not.
 */
export function isPersonalSession(session: Pick<StatusSession, 'athleteId' | 'coachOwnerId' | 'trainingPlanId' | 'assignedById'>, athleteId: number) {
  return (
    session.athleteId === athleteId
    && session.coachOwnerId === null
    && session.trainingPlanId === null
    && session.assignedById === null
  );
}

export type SessionDisplayStatus = 'planned' | 'completed' | 'adjusted' | 'missed' | 'skipped';

export function getSessionDisplayStatus(session: {
  status: string;
  adjusted: boolean;
  activity?: unknown;
}): SessionDisplayStatus {
  if (session.activity) return 'completed';
  if (session.status === SKIPPED_SESSION_STATUS) return 'skipped';
  if (session.status === 'missed') return 'missed';
  if (session.adjusted) return 'adjusted';
  return 'planned';
}

/** Returns the status action the athlete may take from the session detail page, or null. */
export function getSessionStatusAction(
  session: Pick<StatusSession, 'athleteId' | 'coachOwnerId' | 'trainingPlanId' | 'assignedById' | 'status' | 'activity'>,
  athleteId: number,
): SessionStatusAction | null {
  if (!isPersonalSession(session, athleteId) || session.activity || session.status === 'completed') return null;
  if (session.status === 'planned') return 'skip';
  if (session.status === SKIPPED_SESSION_STATUS) return 'plan-again';
  return null;
}

export function createAthleteSessionStatusService({
  db = prisma as unknown as StatusDatabase,
}: { db?: StatusDatabase } = {}) {
  async function transition(
    athleteId: number,
    sessionId: number,
    from: 'planned' | 'skipped',
    to: 'planned' | 'skipped',
  ): Promise<SessionStatusResult> {
    const session = await db.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        athleteId: true,
        coachOwnerId: true,
        trainingPlanId: true,
        assignedById: true,
        status: true,
        activity: { select: { id: true } },
      },
    });
    if (!session || session.athleteId !== athleteId) {
      return { ok: false, status: 404, error: 'Session not found.' };
    }
    if (!isPersonalSession(session, athleteId)) {
      return { ok: false, status: 403, error: 'Coach-assigned sessions can only be changed by the coach.' };
    }
    if (session.activity || session.status === 'completed') {
      return {
        ok: false,
        status: 409,
        error: to === 'skipped'
          ? 'Completed sessions cannot be skipped.'
          : 'Completed sessions cannot be planned again. Reopen the outcome to change it.',
      };
    }
    if (session.status !== from) {
      return {
        ok: false,
        status: 409,
        error: from === 'planned' ? 'Only planned sessions can be skipped.' : 'Only skipped sessions can be planned again.',
      };
    }

    // Compare-and-set so a concurrent completion or status change cannot be overwritten.
    const result = await db.session.updateMany({
      where: { id: sessionId, athleteId, status: from, activity: { is: null } },
      data: { status: to },
    });
    if (result.count !== 1) {
      return { ok: false, status: 409, error: 'The session changed. Refresh and try again.' };
    }

    return { ok: true, sessionId, status: to };
  }

  return {
    skipSession(athleteId: number, sessionId: number) {
      return transition(athleteId, sessionId, 'planned', SKIPPED_SESSION_STATUS);
    },
    planAgainSession(athleteId: number, sessionId: number) {
      return transition(athleteId, sessionId, SKIPPED_SESSION_STATUS, 'planned');
    },
  };
}

export const athleteSessionStatusService = createAthleteSessionStatusService();
