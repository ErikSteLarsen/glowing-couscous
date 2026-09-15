import { prisma } from '@/lib/prisma';
import { normalizeOverviewCards, parsePrefsJson } from './overview-preferences.ts';
import { normalizePerformanceProfile, parsePerformanceProfileJson, serializePerformanceProfile } from './performance-profile.ts';

type AccountServiceDeps = {
  db?: typeof prisma;
};

export function createAccountService({ db = prisma }: AccountServiceDeps = {}) {
  return {
    async getAccount(userId: number) {
      const account = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, prefsJson: true, performanceProfileJson: true },
      });
      return account ? { ...account, name: account.name ?? '', performanceProfile: parsePerformanceProfileJson(account.performanceProfileJson) } : null;
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
