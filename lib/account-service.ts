import { prisma } from '@/lib/prisma';

type AccountServiceDeps = {
  db?: typeof prisma;
};

export function createAccountService({ db = prisma }: AccountServiceDeps = {}) {
  return {
    async getAccount(userId: number) {
      return db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
      });
    },

    async updateDisplayName(userId: number, name: string) {
      return db.user.update({
        where: { id: userId },
        data: { name },
        select: { id: true, name: true, email: true, role: true },
      });
    },
  };
}

export const accountService = createAccountService();
