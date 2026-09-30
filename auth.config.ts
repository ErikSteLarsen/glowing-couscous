import type { NextAuthConfig } from 'next-auth';
import { isAppRole, parseApplicationUserId } from '@/lib/auth-principal';

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      const userId = parseApplicationUserId(token.userId);
      const validRole = token.role == null || isAppRole(token.role);
      (session.user as unknown as { id: number }).id = userId ?? 0;
      (session.user as unknown as { role: string | null }).role = validRole ? token.role ?? null : null;
      if (!userId || !validRole) return session;
      session.user.sessionVersion = token.sessionVersion;
      session.user.signInProvider = token.signInProvider;
      session.user.authenticatedAt = token.authenticatedAt;
      session.user.name = (token.name as string | undefined) ?? session.user.name;
      session.user.email = (token.email as string | undefined) ?? session.user.email;
      return session;
    },
  },
} satisfies NextAuthConfig;
