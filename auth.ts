import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isAppRole, parseApplicationUserId } from '@/lib/auth-principal';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Google({
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email) },
        });
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;
        return { id: String(user.id), email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const userId = parseApplicationUserId(user.id);
        if (userId === null) return token;
        token.userId = userId;
        token.role = (user as { role?: string | null }).role ?? null;
      }
      if (trigger === 'update' || (!token.role && token.userId)) {
        const userId = parseApplicationUserId(token.userId);
        if (userId === null) return token;
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, name: true, email: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.email = dbUser.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Cast through unknown to reconcile next-auth's base string id type with our numeric id
      const userId = parseApplicationUserId(token.userId);
      const validRole = token.role == null || isAppRole(token.role);
      (session.user as unknown as { id: number }).id = userId ?? 0;
      (session.user as unknown as { role: string | null }).role = validRole ? token.role ?? null : null;
      if (!userId || !validRole) return session;
      session.user.name = (token.name as string | undefined) ?? session.user.name;
      session.user.email = (token.email as string | undefined) ?? session.user.email;
      return session;
    },
  },
});
