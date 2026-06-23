import { prisma } from '@/lib/prisma';
import { normalizeOverviewCards, parsePrefsJson } from './overview-preferences.ts';

type AccountServiceDeps = {
  db?: typeof prisma;
};

export function createAccountService({ db = prisma }: AccountServiceDeps = {}) {
  return {
    async getAccount(userId: number) {
      return db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, prefsJson: true },
      });
    },

    async updateDisplayName(userId: number, name: string) {
      return db.user.update({
        where: { id: userId },
        data: { name },
        select: { id: true, name: true, email: true, role: true, prefsJson: true },
      });
    },

    async updateOverviewCards(userId: number, overviewCards: unknown) {
      const existing = await db.user.findUnique({
        where: { id: userId },
        select: { prefsJson: true },
      });

      const currentPrefs =
        existing?.prefsJson ? parsePrefsJson(existing.prefsJson) : {};

      return db.user.update({
        where: { id: userId },
        data: {
          prefsJson: JSON.stringify({
            ...currentPrefs,
            overviewCards: normalizeOverviewCards(overviewCards),
          }),
        },
        select: { id: true, name: true, email: true, role: true, prefsJson: true },
      });
    },
  };
}

export const accountService = createAccountService();
