import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { parseApplicationUserId } from '@/lib/auth-principal';
import { authConfig } from '@/auth.config';

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
    session: authConfig.callbacks.session,
  },
});
