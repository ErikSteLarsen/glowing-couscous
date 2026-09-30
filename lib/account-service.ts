import { prisma } from './prisma.ts';
import { normalizeOverviewCards, parsePrefsJson } from './overview-preferences.ts';
import { normalizePerformanceProfile, parsePerformanceProfileJson, serializePerformanceProfile, validatePerformanceProfile } from './performance-profile.ts';

type AccountServiceDeps = {
  db?: typeof prisma;
};

export function createAccountService({ db = prisma }: AccountServiceDeps = {}) {
  return {
    async getControls(userId: number) {
      const account = await db.user.findUnique({
        where: { id: userId },
        select: { email: true, passwordHash: true, accounts: { select: { provider: true } }, stravaConnection: { select: { athleteName: true } } },
      });
      if (!account) return null;
      return { email: account.email, hasPassword: Boolean(account.passwordHash), providers: [...new Set(account.accounts.map((entry) => entry.provider))], strava: account.stravaConnection ? { connected: true, athleteName: account.stravaConnection.athleteName } : { connected: false, athleteName: null } };
    },

    async signOutEverywhere(userId: number) {
      await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } }, select: { id: true } });
    },

    async getAccount(userId: number) {
      const account = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, prefsJson: true, performanceProfileJson: true, updatedAt: true },
      });
      return account ? { ...account, name: account.name ?? '', performanceProfile: parsePerformanceProfileJson(account.performanceProfileJson) } : null;
    },

    async updateProfile(userId: number, input: Record<string, unknown>) {
      const { name, overviewCards, performanceProfile, expectedUpdatedAt } = input;
      if (name === undefined && overviewCards === undefined && performanceProfile === undefined) return { ok: false as const, status: 400, error: 'No profile changes supplied.' };
      if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 200)) return { ok: false as const, status: 400, error: 'Enter a name of 1–200 characters.' };
      if (overviewCards !== undefined && !Array.isArray(overviewCards)) return { ok: false as const, status: 400, error: 'Overview cards must be a list.' };
      if (performanceProfile !== undefined) {
        const error = validatePerformanceProfile(performanceProfile);
        if (error) return { ok: false as const, status: 400, error };
      }
      if (expectedUpdatedAt !== undefined && (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt)))) return { ok: false as const, status: 400, error: 'Invalid profile revision.' };
      return db.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { id: userId }, select: { prefsJson: true, updatedAt: true } });
        if (!existing) return { ok: false as const, status: 404, error: 'Account not found.' };
        if (typeof expectedUpdatedAt === 'string' && existing.updatedAt.getTime() !== Date.parse(expectedUpdatedAt)) return { ok: false as const, status: 409, error: 'Your profile changed in another tab. Reload before applying these changes.' };
        const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
        const result = await tx.user.updateMany({
          where: { id: userId, updatedAt: existing.updatedAt },
          data: {
            ...(typeof name === 'string' ? { name: name.trim() } : {}),
            ...(overviewCards !== undefined ? { prefsJson: JSON.stringify({ ...parsePrefsJson(existing.prefsJson), overviewCards: normalizeOverviewCards(overviewCards) }) } : {}),
            ...(performanceProfile !== undefined ? { performanceProfileJson: serializePerformanceProfile(normalizePerformanceProfile(performanceProfile)) } : {}),
            updatedAt,
          },
        });
        if (result.count !== 1) return { ok: false as const, status: 409, error: 'Your profile changed while saving. Reload before applying these changes.' };
        return { ok: true as const, updatedAt: updatedAt.toISOString() };
      });
    },

    async updateDisplayName(userId: number, name: string) {
      const account = await db.user.update({
        where: { id: userId },
        data: { name },
        select: { id: true, name: true, email: true, role: true, prefsJson: true, performanceProfileJson: true },
      });
      return { ...account, name: account.name ?? '', performanceProfile: parsePerformanceProfileJson(account.performanceProfileJson) };
    },

    async updateOverviewCards(userId: number, overviewCards: unknown) {
      const existing = await db.user.findUnique({
        where: { id: userId },
        select: { prefsJson: true },
      });

      const currentPrefs =
        existing?.prefsJson ? parsePrefsJson(existing.prefsJson) : {};

      const account = await db.user.update({
        where: { id: userId },
        data: {
          prefsJson: JSON.stringify({
            ...currentPrefs,
            overviewCards: normalizeOverviewCards(overviewCards),
          }),
        },
        select: { id: true, name: true, email: true, role: true, prefsJson: true, performanceProfileJson: true },
      });
      return { ...account, name: account.name ?? '', performanceProfile: parsePerformanceProfileJson(account.performanceProfileJson) };
    },

    async updatePerformanceProfile(userId: number, input: unknown) {
      const profile = normalizePerformanceProfile(input);
      const account = await db.user.update({
        where: { id: userId },
        data: { performanceProfileJson: serializePerformanceProfile(profile) },
        select: { id: true, name: true, email: true, role: true, prefsJson: true, performanceProfileJson: true },
      });
      return { ...account, name: account.name ?? '', performanceProfile: parsePerformanceProfileJson(account.performanceProfileJson) };
    },
  };
}

export const accountService = createAccountService();
