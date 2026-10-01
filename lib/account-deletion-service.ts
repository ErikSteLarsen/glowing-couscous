import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.ts';
import { stravaService } from './strava-service.ts';
import {
  accountShareScope,
  anonymizeAssignedSnapshot,
  anonymizeSharedWorkout,
  safeRetainedSport,
} from './account-deletion-privacy.ts';

type DeletionInput = { confirmation?: unknown; password?: unknown };
type Identity = { sessionVersion: number; signInProvider?: string; authenticatedAt?: number };
const denied = (status: number, error: string) => ({ ok: false as const, status, error });
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const MAX_PASSWORD_ATTEMPTS = 5;
const GOOGLE_PROOF_LIFETIME_MS = 5 * 60_000;
const MAX_TRANSACTION_RETRIES = 3;

function authoredSessionScope(userId: number): Prisma.SessionWhereInput {
  return {
    OR: [
      { coachOwnerId: userId },
      { assignedById: userId },
      { trainingPlan: { is: { coachOwnerId: userId } } },
    ],
  };
}

async function retainSharedLinks(tx: Prisma.TransactionClient, userId: number) {
  const links = await tx.shareLink.findMany({
    where: { OR: [accountShareScope(userId), { session: { is: authoredSessionScope(userId) } }] },
  });
  for (const link of links) {
    await tx.shareLink.update({
      where: { id: link.id },
      data: {
        snapshotJson: anonymizeSharedWorkout(link.snapshotJson),
        ownerDeleted: true,
        createdById: link.createdById === userId ? null : link.createdById,
        sessionId: null,
      },
    });
  }
}

async function detachRecipientSessions(tx: Prisma.TransactionClient, userId: number) {
  // Coach-owned assignments belong to their recipients. Prevent cascades from erasing history.
  const recipients = await tx.session.findMany({
    where: { athleteId: { not: userId }, ...authoredSessionScope(userId) },
    include: {
      trainingPlan: { select: { coachOwnerId: true } },
      activity: { select: { id: true, actualSnapshotJson: true } },
    },
  });
  for (const session of recipients) {
    await tx.session.update({
      where: { id: session.id },
      data: {
        coachOwnerId: session.coachOwnerId === userId ? null : session.coachOwnerId,
        assignedById: session.assignedById === userId ? null : session.assignedById,
        trainingPlanId: session.trainingPlan?.coachOwnerId === userId ? null : session.trainingPlanId,
        title: 'Workout',
        summary: null,
        coachNotes: null,
        timeLabel: null,
        sport: safeRetainedSport(session.sport),
        coachBaselineJson: anonymizeAssignedSnapshot(session.coachBaselineJson, false),
      },
    });
    await tx.block.updateMany({ where: { sessionId: session.id }, data: { note: null } });
    if (session.activity) {
      await tx.activity.update({
        where: { id: session.activity.id },
        data: { actualSnapshotJson: anonymizeAssignedSnapshot(session.activity.actualSnapshotJson, true) },
      });
    }
  }
}

export function createAccountDeletionService({
  db = prisma,
  now = () => Date.now(),
  verifyPassword = bcrypt.compare,
  revokeStrava = stravaService.revokeDeletedConnection,
} = {}) {
  async function serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.$transaction(operation, { isolationLevel: 'Serializable', timeout: 30_000 });
      } catch (error) {
        const failure = error as { code?: string; meta?: { code?: string } } | null;
        const retryable = failure?.code === 'P2034' || (failure?.code === 'P2010' && ['40001', '40P01'].includes(failure.meta?.code ?? ''));
        if (attempt >= MAX_TRANSACTION_RETRIES || !retryable) throw error;
      }
    }
  }

  async function prepareDeletion(userId: number, input: DeletionInput, identity: Identity) {
    const timestamp = now();
    // Reserve a durable attempt before expensive password work. User row lock serializes attempts.
    return serializable(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true, sessionVersion: true, accounts: { select: { provider: true } } },
      });
      if (!user || user.sessionVersion !== identity.sessionVersion) {
        return denied(401, 'Your session expired. Sign in again.');
      }
      if (!user.passwordHash) {
        const age = timestamp - (identity.authenticatedAt ?? 0);
        const hasGoogleAccount = user.accounts.some((account) => account.provider === 'google');
        if (identity.signInProvider !== 'google' || !hasGoogleAccount || age < 0 || age > GOOGLE_PROOF_LIFETIME_MS) {
          return denied(403, 'Confirm your identity with a new Google sign-in, then return to delete your account.');
        }
      } else if (typeof input.password !== 'string' || !input.password || Buffer.byteLength(input.password, 'utf8') > 72) {
        return denied(400, 'Enter your current password.');
      }
      const existing = await tx.accountDeletionAttempt.findUnique({ where: { userId } });
      const freshWindow = !existing || timestamp - existing.windowStartedAt.getTime() >= ATTEMPT_WINDOW_MS;
      if (!freshWindow && existing.attemptCount >= MAX_PASSWORD_ATTEMPTS) {
        return denied(429, 'Too many attempts. Try again in 15 minutes.');
      }
      await tx.accountDeletionAttempt.upsert({
        where: { userId },
        create: { userId, windowStartedAt: new Date(timestamp), attemptCount: 1 },
        update: freshWindow
          ? { windowStartedAt: new Date(timestamp), attemptCount: 1 }
          : { attemptCount: { increment: 1 } },
      });
      return { ok: true as const, passwordHash: user.passwordHash };
    });
  }

  async function eraseAccount(userId: number, passwordHash: string | null, identity: Identity) {
    return serializable(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          sessionVersion: true,
          passwordHash: true,
          stravaConnection: { select: { athleteId: true, refreshTokenEncrypted: true } },
        },
      });
      if (!user || user.sessionVersion !== identity.sessionVersion || user.passwordHash !== passwordHash) {
        return denied(401, 'Your account changed. Sign in again before deleting it.');
      }
      if (!passwordHash && now() - (identity.authenticatedAt ?? 0) > GOOGLE_PROOF_LIFETIME_MS) {
        return denied(403, 'Your identity confirmation expired. Sign in with Google again.');
      }

      await retainSharedLinks(tx, userId);
      await detachRecipientSessions(tx, userId);
      if (user.stravaConnection) {
        await tx.stravaWebhookEvent.deleteMany({ where: { ownerAthleteId: user.stravaConnection.athleteId } });
      }
      await tx.user.delete({ where: { id: userId } });
      return { ok: true as const, encryptedRefreshToken: user.stravaConnection?.refreshTokenEncrypted ?? null };
    });
  }

  return {
    async preview(userId: number) {
      return { sharedLinks: await db.shareLink.count({ where: accountShareScope(userId) }) };
    },
    async unshare(userId: number) {
      return serializable(async (tx) => {
        const users = await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        if (!users.length) return denied(401, 'Sign in again.');
        const result = await tx.shareLink.deleteMany({ where: accountShareScope(userId) });
        return { ok: true as const, removed: result.count };
      });
    },
    async deleteAccount(userId: number, input: DeletionInput, identity: Identity) {
      if (input.confirmation !== 'DELETE') return denied(400, 'Type DELETE to confirm.');
      const prepared = await prepareDeletion(userId, input, identity);
      if (!prepared.ok) return prepared;
      if (prepared.passwordHash && !await verifyPassword(input.password as string, prepared.passwordHash)) {
        return denied(403, 'Your password is incorrect.');
      }

      const deleted = await eraseAccount(userId, prepared.passwordHash, identity);
      if (!deleted.ok) return deleted;
      // No provider credentials are persisted for retries; local erasure takes priority during outage.
      let providerRevoked: boolean | null = null;
      if (deleted.encryptedRefreshToken) {
        try {
          providerRevoked = await revokeStrava(deleted.encryptedRefreshToken);
        } catch {
          providerRevoked = false;
        }
      }
      return { ok: true as const, providerRevoked };
    },
  };
}

export const accountDeletionService = createAccountDeletionService();
