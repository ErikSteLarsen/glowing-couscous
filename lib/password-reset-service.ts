import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.ts';
import { isPlausibleEmailAddress, normalizeEmailAddress } from './email-address.ts';

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;

type PasswordResetEnvironment = {
  AUTH_URL?: string;
  NODE_ENV?: string;
  RESEND_API_KEY?: string;
  PASSWORD_RESET_FROM_EMAIL?: string;
};

export function getPasswordResetEmailConfig(environment: PasswordResetEnvironment = process.env) {
  const apiKey = environment.RESEND_API_KEY?.trim();
  const from = environment.PASSWORD_RESET_FROM_EMAIL?.trim();
  const authUrl = environment.AUTH_URL?.trim();
  if (!apiKey || !from || !authUrl) return null;

  try {
    const parsedUrl = new URL(authUrl);
    if (parsedUrl.protocol !== 'https:' && !(environment.NODE_ENV !== 'production' && parsedUrl.hostname === 'localhost' && parsedUrl.protocol === 'http:')) {
      return null;
    }
    return { apiKey, from, appOrigin: parsedUrl.origin };
  } catch {
    return null;
  }
}

export function createPasswordResetService({
  db = prisma,
  environment = process.env,
  now = () => new Date(),
  fetcher = fetch,
}: {
  db?: typeof prisma;
  environment?: PasswordResetEnvironment;
  now?: () => Date;
  fetcher?: typeof fetch;
} = {}) {
  return {
    isConfigured() {
      return getPasswordResetEmailConfig(environment) !== null;
    },

    async requestReset(rawEmail: string) {
      const email = normalizeEmailAddress(rawEmail);
      if (!isPlausibleEmailAddress(email)) return 'ignored' as const;
      const config = getPasswordResetEmailConfig(environment);
      if (!config) return 'not-configured' as const;

      const user = await db.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, email: true, passwordHash: true },
      });
      if (!user?.passwordHash) return 'ignored' as const;

      const issuedAt = now();
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(issuedAt.getTime() + TOKEN_LIFETIME_MS);

      const canSend = await db.$transaction(async (tx) => {
        const current = await tx.passwordResetToken.findUnique({ where: { userId: user.id } });
        if (current) {
          if (issuedAt.getTime() - current.lastSentAt.getTime() < REQUEST_COOLDOWN_MS) return false;
          const insideWindow = issuedAt.getTime() - current.windowStartedAt.getTime() < REQUEST_WINDOW_MS;
          if (insideWindow && current.requestCount >= MAX_REQUESTS_PER_WINDOW) return false;
          await tx.passwordResetToken.update({
            where: { userId: user.id },
            data: {
              tokenHash,
              expiresAt,
              lastSentAt: issuedAt,
              requestCount: insideWindow ? { increment: 1 } : 1,
              windowStartedAt: insideWindow ? undefined : issuedAt,
            },
          });
          return true;
        }

        await tx.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt, lastSentAt: issuedAt, windowStartedAt: issuedAt, requestCount: 1 },
        });
        return true;
      }, { isolationLevel: 'Serializable' });

      if (!canSend) return 'rate-limited' as const;

      const resetUrl = new URL('/reset-password', config.appOrigin);
      resetUrl.searchParams.set('token', rawToken);
      const message = [
        'We received a request to reset the password for your Wattonaut account.',
        `Use this link to choose a new password: ${resetUrl.toString()}`,
        'The link expires in 30 minutes and can only be used once.',
        'If you did not request this, you can ignore this email.',
      ].join('\n\n');

      const response = await fetcher('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: config.from, to: [user.email], subject: 'Reset your Wattonaut password', text: message }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Password reset email delivery failed');
      return 'sent' as const;
    },

    async completeReset(rawToken: string, password: string) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return false;
      if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return false;

      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const issuedAt = now();
      const token = await db.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!token || token.expiresAt.getTime() <= issuedAt.getTime()) return false;

      const passwordHash = await bcrypt.hash(password, 12);
      return db.$transaction(async (tx) => {
        const consumed = await tx.passwordResetToken.deleteMany({
          where: { userId: token.userId, tokenHash, expiresAt: { gt: issuedAt } },
        });
        if (consumed.count !== 1) return false;
        await tx.user.update({
          where: { id: token.userId },
          data: { passwordHash, sessionVersion: { increment: 1 } },
        });
        return true;
      }, { isolationLevel: 'Serializable' });
    },
  };
}

export const passwordResetService = createPasswordResetService();
