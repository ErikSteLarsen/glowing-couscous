import type { AppRole } from './app-navigation.ts';

type RoleUserRecord = { role: string | null };

type RoleDatabase = {
  user: {
    updateMany(args: {
      where: { id: number; role: null };
      data: { role: AppRole };
    }): Promise<{ count: number }>;
    findUnique(args: {
      where: { id: number };
      select: { role: true };
    }): Promise<RoleUserRecord | null>;
  };
};

export type RoleSetupResult =
  | { ok: true; role: AppRole }
  | { ok: false; status: 404 | 409; error: string };

export function createAuthRoleService({ db }: { db: RoleDatabase }) {
  return {
    async assignRole(userId: number, role: AppRole): Promise<RoleSetupResult> {
      const updated = await db.user.updateMany({
        where: { id: userId, role: null },
        data: { role },
      });

      if (updated.count === 1) return { ok: true, role };

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) return { ok: false, status: 404, error: 'User not found' };
      return { ok: false, status: 409, error: 'Role is already set' };
    },
  };
}
