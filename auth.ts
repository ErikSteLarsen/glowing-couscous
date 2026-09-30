import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { parseApplicationUserId } from '@/lib/auth-principal';
import { authConfig } from '@/auth.config';
import { isPlausibleEmailAddress, normalizeEmailAddress } from '@/lib/email-address';

const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
const googleProvider =
  googleClientId && googleClientSecret
    ? Google({ clientId: googleClientId, clientSecret: googleClientSecret })
    : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(googleProvider ? [googleProvider] : []),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = normalizeEmailAddress(String(credentials.email));
        const password = String(credentials.password);
        if (!isPlausibleEmailAddress(email) || Buffer.byteLength(password, 'utf8') > 72) return null;
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
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
          const current = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
          token.sessionVersion = current?.sessionVersion ?? 0;
        }
        const userId = parseApplicationUserId(token.userId);
        if (!user && userId !== null) {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, name: true, email: true, sessionVersion: true },
          });
          if (!dbUser || dbUser.sessionVersion !== (token.sessionVersion ?? 0)) {
            token.userId = undefined;
            token.role = null;
            token.sessionVersion = undefined;
            token.name = undefined;
            token.email = undefined;
            return token;
          }
          if (trigger === 'update' || !token.role) {
            token.role = dbUser.role;
            token.name = dbUser.name;
            token.email = dbUser.email;
        }
      }
      return token;
    },
    session: authConfig.callbacks.session,
  },
});
