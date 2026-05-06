# Authentication & Role-Based Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the demo session system with Auth.js v5 JWT auth (email+password + Google OAuth), enforce role-based routing, and add a coach-athlete join-request flow.

**Architecture:** Auth.js v5 with Prisma adapter and JWT session strategy. Role and userId are embedded in the JWT. A single `middleware.ts` enforces role-based redirects. `lib/auth-session.ts` replaces `lib/demo-session.ts` as the session access layer. All API route handlers do their own auth checks via `lib/api-auth.ts` helpers.

**Tech Stack:** next-auth@5, @auth/prisma-adapter, bcryptjs, Next.js App Router, Prisma + SQLite.

---

## File Map

| Action | Path |
|---|---|
| Install | `package.json` |
| Modify | `prisma/schema.prisma` |
| Modify | `prisma/seed.js` |
| Create | `auth.ts` |
| Create | `types/next-auth.d.ts` |
| Create | `app/api/auth/[...nextauth]/route.ts` |
| Create | `app/api/auth/signup/route.ts` |
| Create | `app/api/auth/setup/route.ts` |
| Create | `lib/auth-session.ts` |
| Create | `lib/api-auth.ts` |
| Create | `middleware.ts` |
| Modify | `app/layout.tsx` |
| Create | `components/SessionProviderWrapper.tsx` |
| Create | `app/(auth)/login/page.tsx` |
| Create | `app/(auth)/signup/page.tsx` |
| Create | `app/(auth)/setup/page.tsx` |
| Modify | `lib/demo-data.ts` |
| Modify | `app/coach/page.tsx` |
| Modify | `app/coach/templates/page.tsx` |
| Modify | `app/athlete/page.tsx` |
| Create | `app/athlete/profile/page.tsx` |
| Modify | `app/api/athlete/sessions/[sessionId]/completion/route.ts` |
| Modify | `app/api/coach/sessions/[sessionId]/route.ts` |
| Modify | `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/route.ts` |
| Modify | `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/sessions/route.ts` |
| Modify | `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/copy-previous/route.ts` |
| Modify | `app/api/coach/templates/route.ts` |
| Modify | `app/api/coach/templates/[templateId]/route.ts` |
| Create | `app/api/coaches/route.ts` |
| Create | `app/api/athlete/coach-requests/route.ts` |
| Create | `app/api/coach/requests/route.ts` |
| Create | `app/api/coach/requests/[requestId]/route.ts` |
| Create | `components/CoachRequestsPanel.tsx` |
| Modify | `app/page.tsx` |
| Delete | `lib/demo-session.ts` |

---

## Task 1: Install dependencies and configure environment

**Files:** `package.json`, `.env.local` (new, gitignored)

- [ ] **Step 1: Install auth packages**

```bash
pnpm add next-auth@beta @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs
```

Expected: packages added to `node_modules`, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Create `.env.local`**

Create `.env.local` in the project root (already gitignored by Next.js defaults):

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-output-of-openssl-rand-base64-32"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

Generate `AUTH_SECRET`: `openssl rand -base64 32`

Google credentials: create a project in [Google Cloud Console](https://console.cloud.google.com), enable the Google Identity API, create an OAuth 2.0 client, set redirect URI to `http://localhost:3000/api/auth/callback/google`.

- [ ] **Step 3: Verify `.gitignore` includes `.env.local`**

```bash
grep ".env.local" .gitignore
```

Expected: `.env.local` is listed. If not, add it.

---

## Task 2: Update Prisma schema

**Files:** `prisma/schema.prisma`

- [ ] **Step 1: Add `passwordHash` and make `role` nullable on `User`, add back-relations for `CoachRequest`**

Replace the `User` model with:

```prisma
model User {
  id              Int                 @id @default(autoincrement())
  email           String              @unique
  name            String
  role            String?
  passwordHash    String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  coachedAthletes AthleteProfile[]    @relation("CoachAthletes")
  athleteProfile  AthleteProfile?
  templates       SessionTemplate[]
  completions     SessionCompletion[]
  accounts        Account[]
  coachRequests   CoachRequest[]      @relation("CoachRequests")
  athleteRequests CoachRequest[]      @relation("AthleteRequests")
}
```

- [ ] **Step 2: Add `Account` model after the `User` model**

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            Int
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

- [ ] **Step 3: Add `CoachRequest` model**

```prisma
model CoachRequest {
  id        Int      @id @default(autoincrement())
  athleteId Int
  coachId   Int
  status    String   @default("PENDING")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  athlete   User     @relation("AthleteRequests", fields: [athleteId], references: [id], onDelete: Cascade)
  coach     User     @relation("CoachRequests", fields: [coachId], references: [id], onDelete: Cascade)

  @@unique([athleteId, coachId])
}
```

- [ ] **Step 4: Push schema and verify**

```bash
pnpm db:push
```

Expected: schema applied, no errors.

---

## Task 3: Update seed data

**Files:** `prisma/seed.js`

- [ ] **Step 1: Add bcryptjs require and hash password at top of file**

After the existing requires, add:

```js
const bcrypt = require('bcryptjs');
```

At the start of `main()`, before the deleteMany calls, add:

```js
const passwordHash = await bcrypt.hash('demo1234', 12);
```

- [ ] **Step 2: Add cleanup for new models before existing deletes**

Insert these two lines at the very top of the delete block (before `sessionCompletion.deleteMany()`):

```js
await prisma.coachRequest.deleteMany();
await prisma.account.deleteMany();
```

- [ ] **Step 3: Add `passwordHash` to all three user creates**

Update the coach create:
```js
const coach = await prisma.user.create({
  data: {
    email: 'coach@demo.local',
    name: 'Coach Ingrid',
    role: 'COACH',
    passwordHash,
  },
});
```

Update the two athlete creates inside `Promise.all`:
```js
prisma.user.create({
  data: { email: 'maria@demo.local', name: 'Maria Solberg', role: 'ATHLETE', passwordHash },
}),
prisma.user.create({
  data: { email: 'anders@demo.local', name: 'Anders Vik', role: 'ATHLETE', passwordHash },
}),
```

- [ ] **Step 4: Re-seed and verify**

```bash
pnpm db:seed
```

Expected: seed completes without errors.

---

## Task 4: Auth.js configuration

**Files:** `auth.ts` (root), `types/next-auth.d.ts` (new)

- [ ] **Step 1: Create `types/next-auth.d.ts`**

```ts
import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: number
      role: string | null
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
  interface User {
    role?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: number
    role?: string | null
  }
}
```

- [ ] **Step 2: Create `auth.ts` at the project root**

```ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
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
        token.userId = Number(user.id);
        token.role = (user as { role?: string | null }).role ?? null;
      }
      if (trigger === 'update' || (!token.role && token.userId)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as number },
          select: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as number;
      session.user.role = token.role as string | null;
      return session;
    },
  },
});
```

---

## Task 5: Auth route handlers and auth-related API routes

**Files:**
- Create `app/api/auth/[...nextauth]/route.ts`
- Create `app/api/auth/signup/route.ts`
- Create `app/api/auth/setup/route.ts`

- [ ] **Step 1: Create `app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 2: Create `app/api/auth/signup/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, password, role } = body;

  if (!name || !email || !password || !['COACH', 'ATHLETE'].includes(role)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  await prisma.user.create({ data: { name, email, passwordHash, role } });

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 3: Create `app/api/auth/setup/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role } = await req.json();
  if (!['COACH', 'ATHLETE'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { role } });
  return NextResponse.json({ ok: true });
}
```

---

## Task 6: Session access layer and API auth helpers

**Files:**
- Create `lib/auth-session.ts`
- Create `lib/api-auth.ts`

- [ ] **Step 1: Create `lib/auth-session.ts`**

```ts
import { auth } from '@/auth';

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.role) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    role: session.user.role,
  };
}
```

- [ ] **Step 2: Create `lib/api-auth.ts`**

```ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function requireCoach() {
  const session = await auth();
  if (!session?.user) return { user: null, error: unauthorized };
  if (session.user.role !== 'COACH') return { user: null, error: forbidden };
  return { user: session.user as { id: number; role: string; name?: string | null; email?: string | null }, error: null };
}

export async function requireAthlete() {
  const session = await auth();
  if (!session?.user) return { user: null, error: unauthorized };
  if (session.user.role !== 'ATHLETE') return { user: null, error: forbidden };
  return { user: session.user as { id: number; role: string; name?: string | null; email?: string | null }, error: null };
}
```

---

## Task 7: Middleware

**Files:** `middleware.ts` (project root)

- [ ] **Step 1: Create `middleware.ts`**

```ts
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const role = user?.role;

  if (pathname.startsWith('/api/')) return NextResponse.next();

  if (!user) {
    if (pathname.startsWith('/coach') || pathname.startsWith('/athlete')) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }

  if (!role && pathname !== '/setup') {
    return NextResponse.redirect(new URL('/setup', req.url));
  }

  if (role === 'COACH' && pathname.startsWith('/athlete')) {
    return NextResponse.redirect(new URL('/coach', req.url));
  }

  if (role === 'ATHLETE' && pathname.startsWith('/coach')) {
    return NextResponse.redirect(new URL('/athlete', req.url));
  }

  if ((pathname === '/login' || pathname === '/signup') && role) {
    return NextResponse.redirect(new URL(role === 'COACH' ? '/coach' : '/athlete', req.url));
  }

  if (pathname === '/' && role) {
    return NextResponse.redirect(new URL(role === 'COACH' ? '/coach' : '/athlete', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## Task 8: SessionProvider and layout update

**Files:**
- Create `components/SessionProviderWrapper.tsx`
- Modify `app/layout.tsx`

- [ ] **Step 1: Create `components/SessionProviderWrapper.tsx`**

```tsx
'use client';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

export function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper';

export const metadata: Metadata = {
  title: 'Workout Planner',
  description: 'Weekly workout planning for coaches and athletes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>
          <main className="mx-auto min-h-screen max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
```

---

## Task 9: Login page

**Files:** Create `app/(auth)/login/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell, Surface, TopBar } from '@/components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/');
    }
  }

  return (
    <PageShell>
      <TopBar eyebrow="Workout Planner" title="Sign in" />
      <Surface className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-slate-500">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
        >
          Continue with Google
        </button>
        <p className="mt-5 text-center text-sm text-slate-400">
          No account?{' '}
          <a href="/signup" className="text-indigo-400 hover:text-indigo-300">
            Sign up
          </a>
        </p>
      </Surface>
    </PageShell>
  );
}
```

---

## Task 10: Sign-up page

**Files:** Create `app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell, Surface, TopBar } from '@/components/ui';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'COACH' | 'ATHLETE'>('ATHLETE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('Account created — please sign in.');
      router.push('/login');
    } else {
      router.push('/');
    }
  }

  return (
    <PageShell>
      <TopBar eyebrow="Workout Planner" title="Create account" />
      <Surface className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            {(['COACH', 'ATHLETE'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  role === r
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {r === 'COACH' ? 'I am a coach' : 'I am an athlete'}
              </button>
            ))}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-slate-500">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
        >
          Continue with Google
        </button>
        <p className="mt-5 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <a href="/login" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </a>
        </p>
      </Surface>
    </PageShell>
  );
}
```

---

## Task 11: Role setup page (Google OAuth)

**Files:** Create `app/(auth)/setup/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell, Surface, TopBar } from '@/components/ui';

export default function SetupPage() {
  const [role, setRole] = useState<'COACH' | 'ATHLETE'>('ATHLETE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { update } = useSession();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
      return;
    }
    await update({ role });
    router.push(role === 'COACH' ? '/coach' : '/athlete');
  }

  return (
    <PageShell>
      <TopBar
        eyebrow="Almost there"
        title="Choose your role"
        description="This sets how you use the app."
      />
      <Surface className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            {(['COACH', 'ATHLETE'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  role === r
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {r === 'COACH' ? 'I am a coach' : 'I am an athlete'}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </Surface>
    </PageShell>
  );
}
```

---

## Task 12: Update data access functions

**Files:** `lib/demo-data.ts`

- [ ] **Step 1: Update `getCoachOverview` to accept `coachId`**

Replace:
```ts
export async function getCoachOverview() {
  const coach = await prisma.user.findFirst({
    where: { role: 'COACH' },
```

With:
```ts
export async function getCoachOverview(coachId: number) {
  const coach = await prisma.user.findUnique({
    where: { id: coachId },
```

- [ ] **Step 2: Update `getCoachTemplates` to accept `coachId`**

Replace:
```ts
export async function getCoachTemplates() {
  const coach = await prisma.user.findFirst({ where: { role: 'COACH' } });
  if (!coach) {
    return [];
  }

  return templateService.listForCoach(coach.id);
}
```

With:
```ts
export async function getCoachTemplates(coachId: number) {
  return templateService.listForCoach(coachId);
}
```

---

## Task 13: Update coach server components

**Files:** `app/coach/page.tsx`, `app/coach/templates/page.tsx`

- [ ] **Step 1: Update `app/coach/page.tsx`**

Replace the entire file:

```tsx
import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, Badge, EmptyState, PageShell, StatTile, Surface, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { getCoachOverview } from '@/lib/demo-data';
import { CoachRequestsPanel } from '@/components/CoachRequestsPanel';

export default async function CoachPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const coach = await getCoachOverview(user.id);

  if (!coach) {
    return (
      <PageShell>
        <EmptyState title="No data found" description="Something went wrong loading your dashboard." />
      </PageShell>
    );
  }

  const athleteRows = coach.coachedAthletes.map((athlete) => {
    const currentWeek = athlete.planWeeks[0];
    const sessionCount = currentWeek?.sessions.length ?? 0;
    const status = sessionCount >= 4 ? 'Well planned' : sessionCount > 0 ? 'Partially planned' : 'Empty week';
    return {
      id: athlete.id,
      athleteName: athlete.user.name,
      email: athlete.user.email,
      sessionCount,
      status,
      weekStart: currentWeek?.weekStart ?? null,
      weeklyNote: currentWeek?.weeklyNote ?? null,
    };
  });

  return (
    <PageShell>
      <TopBar
        eyebrow="Coach dashboard"
        title={coach.name}
        description="Athlete list and upcoming week status."
        actions={<ActionLink href="/coach/templates">Templates</ActionLink>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Athletes" value={String(athleteRows.length)} detail="Coach-owned roster" />
        <StatTile
          label="Planned sessions"
          value={String(athleteRows.reduce((total, row) => total + row.sessionCount, 0))}
          detail="Current week"
        />
        <StatTile
          label="Strong weeks"
          value={String(athleteRows.filter((row) => row.status === 'Well planned').length)}
          detail="4 or more sessions scheduled"
        />
      </div>

      <CoachRequestsPanel />

      <Surface>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Roster</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Athletes and week readiness</h2>
          </div>
          <Badge tone="brand">Week planner only</Badge>
        </div>

        <div className="mt-5 space-y-4">
          {athleteRows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{row.athleteName}</h3>
                    <Badge tone={row.status === 'Well planned' ? 'success' : row.status === 'Empty week' ? 'warning' : 'neutral'}>
                      {row.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-300">{row.email}</p>
                  <p className="text-sm text-slate-300">
                    {row.weekStart ? `Week of ${format(row.weekStart, 'd MMM yyyy')}` : 'No active week plan yet'}
                  </p>
                  {row.weeklyNote ? <p className="max-w-2xl text-sm text-slate-300">{row.weeklyNote}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Sessions</p>
                    <p className="mt-1 text-lg font-semibold text-white">{row.sessionCount}</p>
                  </div>
                  <ActionLink href={`/coach/athletes/${row.id}`}>Open planner</ActionLink>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </PageShell>
  );
}
```

- [ ] **Step 2: Update `app/coach/templates/page.tsx`**

Read the current file, then add these two imports and replace the data-fetching:

```tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-session';
```

At the top of the server component function:
```tsx
const user = await getCurrentUser();
if (!user || user.role !== 'COACH') redirect('/login');
```

Replace the existing `getCoachTemplates()` call with `getCoachTemplates(user.id)`.

---

## Task 14: Update athlete server component

**Files:** `app/athlete/page.tsx`, Create `app/athlete/profile/page.tsx`

- [ ] **Step 1: Update `app/athlete/page.tsx`**

Replace the entire file:

```tsx
import { isSameDay } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { AthleteWeekView } from '@/components/AthleteWeekView';
import { groupSessionsByDay } from '@/lib/demo-data';
import { getCurrentUser } from '@/lib/auth-session';
import { plannerService } from '@/lib/planner-service';
import { prisma } from '@/lib/prisma';

export default async function AthletePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const athleteProfile = await prisma.athleteProfile.findUnique({
    where: { userId: user.id },
  });

  if (!athleteProfile) redirect('/athlete/profile');

  const plannerSnapshot = await plannerService
    .forWeek({ athleteId: athleteProfile.id, weekStart: new Date() })
    .load();

  if (!plannerSnapshot) {
    return (
      <PageShell>
        <EmptyState title="No plan yet" description="Your coach hasn't created a plan for this week." />
      </PageShell>
    );
  }

  const grouped = groupSessionsByDay(
    plannerSnapshot.sessions.map((session) => ({
      ...session,
      scheduledDate: new Date(session.scheduledDate),
      completion: session.completion
        ? {
            ...session.completion,
            completedAt: session.completion.completedAt ? new Date(session.completion.completedAt) : null,
          }
        : null,
    })),
    new Date(plannerSnapshot.week.start),
  );

  const today = new Date();
  const todayIndex = grouped.findIndex((day) => isSameDay(day.date, today));

  return (
    <PageShell>
      <TopBar
        eyebrow="Athlete week"
        title={user.name}
        description={`Weekly plan from ${plannerSnapshot.athlete.coachName}.`}
      />
      <AthleteWeekView
        weeklyNote={plannerSnapshot.week.weeklyNote}
        weekStart={new Date(plannerSnapshot.week.start)}
        days={grouped}
        todayIndex={todayIndex}
      />
    </PageShell>
  );
}
```

- [ ] **Step 2: Create `app/athlete/profile/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { prisma } from '@/lib/prisma';

export default async function AthleteProfilePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const profile = await prisma.athleteProfile.findUnique({ where: { userId: user.id } });
  if (profile) redirect('/athlete');

  return (
    <PageShell>
      <TopBar
        eyebrow="Your profile"
        title={user.name}
        description="You don't have a coach yet. Find a coach to get your weekly training plan."
        actions={<ActionLink href="/athlete/find-coach">Find a coach</ActionLink>}
      />
      <EmptyState
        title="No training plan yet"
        description="Once a coach accepts your request, your weekly plan will appear here."
      />
    </PageShell>
  );
}
```

---

## Task 15: Add auth guards to existing API routes

**Files:** Six existing coach route handlers, one athlete route handler.

- [ ] **Step 1: Update `app/api/athlete/sessions/[sessionId]/completion/route.ts`**

Replace the import of `getCurrentAthleteUser` and its usage. Full updated file:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { plannerService } from '@/lib/planner-service';
import { prisma } from '@/lib/prisma';
import { requireAthlete } from '@/lib/api-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const { sessionId } = await params;
    const body = (await request.json()) as { isDone?: boolean; notes?: string };

    const athleteProfile = await prisma.athleteProfile.findUnique({ where: { userId: user.id } });
    if (!athleteProfile) return NextResponse.json({ error: 'Athlete profile not found' }, { status: 404 });

    const session = await prisma.plannedSession.findUnique({
      where: { id: Number(sessionId) },
      include: { planWeek: true },
    });

    if (!session || session.planWeek.athleteId !== athleteProfile.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const result = await plannerService
      .forWeek({ athleteId: athleteProfile.id, weekStart: session.planWeek.weekStart })
      .execute({
        type: 'set-session-completion',
        sessionId: session.id,
        athleteUserId: user.id,
        isDone: typeof body.isDone === 'boolean' ? body.isDone : false,
        notes: typeof body.notes === 'string' ? body.notes : '',
      });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Failed to update completion' }, { status: result.status ?? 400 });
    }

    if (!result.completion) {
      return NextResponse.json({ error: 'Failed to update completion' }, { status: 500 });
    }

    return NextResponse.json({ sessionId: session.id, completion: result.completion });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update completion' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add auth guard to `app/api/coach/sessions/[sessionId]/route.ts`**

Add at the top of each handler (`PATCH`, `DELETE`), after the try block opens:

```ts
import { requireCoach } from '@/lib/api-auth';
```

At the start of both `PATCH` and `DELETE` try blocks, before the params destructure:

```ts
const { error } = await requireCoach();
if (error) return error;
```

- [ ] **Step 3: Add auth guard to `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/route.ts`**

Add this import at the top of the file:
```ts
import { requireCoach } from '@/lib/api-auth';
```
Add these two lines as the first statements inside the `PATCH` handler's try block:
```ts
const { error } = await requireCoach();
if (error) return error;
```

- [ ] **Step 4: Add auth guard to `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/sessions/route.ts`**

Add this import at the top of the file:
```ts
import { requireCoach } from '@/lib/api-auth';
```
Add these two lines as the first statements inside every handler's try block:
```ts
const { error } = await requireCoach();
if (error) return error;
```

- [ ] **Step 5: Add auth guard to `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/copy-previous/route.ts`**

Add this import at the top of the file:
```ts
import { requireCoach } from '@/lib/api-auth';
```
Add these two lines as the first statements inside the handler's try block:
```ts
const { error } = await requireCoach();
if (error) return error;
```

- [ ] **Step 6: Add auth guard to `app/api/coach/templates/route.ts`**

Add this import at the top of the file:
```ts
import { requireCoach } from '@/lib/api-auth';
```
Add these two lines as the first statements inside every handler's try block:
```ts
const { error } = await requireCoach();
if (error) return error;
```

- [ ] **Step 7: Add auth guard to `app/api/coach/templates/[templateId]/route.ts`**

Add this import at the top of the file:
```ts
import { requireCoach } from '@/lib/api-auth';
```
Add these two lines as the first statements inside every handler's try block:
```ts
const { error } = await requireCoach();
if (error) return error;
```

---

## Task 16: Find-coach flow

**Files:**
- Create `app/athlete/find-coach/page.tsx`
- Create `app/api/coaches/route.ts`

- [ ] **Step 1: Create `app/api/coaches/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { error } = await requireAthlete();
  if (error) return error;

  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ coaches: [] });

  const coaches = await prisma.user.findMany({
    where: {
      role: 'COACH',
      OR: [{ name: { contains: q } }, { email: { contains: q } }],
    },
    select: { id: true, name: true, email: true },
    take: 10,
  });

  return NextResponse.json({ coaches });
}
```

- [ ] **Step 2: Create `app/athlete/find-coach/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { PageShell, Surface, TopBar } from '@/components/ui';

type CoachResult = { id: number; name: string; email: string };

export default function FindCoachPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoachResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [requested, setRequested] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/coaches?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.coaches ?? []);
    setSearched(true);
    setLoading(false);
  }

  async function handleRequest(coachId: number) {
    const res = await fetch('/api/athlete/coach-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId }),
    });
    if (res.ok || res.status === 409) {
      setRequested((prev) => new Set(prev).add(coachId));
    }
  }

  return (
    <PageShell>
      <TopBar
        eyebrow="Find a coach"
        title="Search coaches"
        description="Search by name or email, then send a join request."
      />
      <Surface>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results.length > 0 && (
          <div className="mt-4 space-y-3">
            {results.map((coach) => (
              <div
                key={coach.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{coach.name}</p>
                  <p className="text-xs text-slate-400">{coach.email}</p>
                </div>
                <button
                  onClick={() => handleRequest(coach.id)}
                  disabled={requested.has(coach.id)}
                  className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {requested.has(coach.id) ? 'Request sent' : 'Request to join'}
                </button>
              </div>
            ))}
          </div>
        )}

        {searched && results.length === 0 && !loading && (
          <p className="mt-4 text-sm text-slate-400">No coaches found for &ldquo;{query}&rdquo;.</p>
        )}
      </Surface>
    </PageShell>
  );
}
```

---

## Task 17: Coach request API routes

**Files:**
- Create `app/api/athlete/coach-requests/route.ts`
- Create `app/api/coach/requests/route.ts`
- Create `app/api/coach/requests/[requestId]/route.ts`

- [ ] **Step 1: Create `app/api/athlete/coach-requests/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { user, error } = await requireAthlete();
  if (error) return error;

  const body = await req.json();
  const coachId = Number(body.coachId);
  if (!coachId || Number.isNaN(coachId)) {
    return NextResponse.json({ error: 'Invalid coachId' }, { status: 400 });
  }

  const coach = await prisma.user.findUnique({ where: { id: coachId, role: 'COACH' } });
  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });

  try {
    await prisma.coachRequest.create({
      data: { athleteId: user.id, coachId, status: 'PENDING' },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Request already sent' }, { status: 409 });
    }
    throw e;
  }
}
```

- [ ] **Step 2: Create `app/api/coach/requests/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { user, error } = await requireCoach();
  if (error) return error;

  const requests = await prisma.coachRequest.findMany({
    where: { coachId: user.id, status: 'PENDING' },
    include: { athlete: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ requests });
}
```

- [ ] **Step 3: Create `app/api/coach/requests/[requestId]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { requestId } = await params;
  const { action } = await req.json();

  const request = await prisma.coachRequest.findUnique({ where: { id: Number(requestId) } });
  if (!request || request.coachId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (action === 'accept') {
    const existing = await prisma.athleteProfile.findUnique({ where: { userId: request.athleteId } });
    if (existing) {
      return NextResponse.json({ error: 'Athlete already has a coach' }, { status: 409 });
    }
    await prisma.$transaction([
      prisma.coachRequest.update({ where: { id: request.id }, data: { status: 'ACCEPTED' } }),
      prisma.athleteProfile.create({ data: { userId: request.athleteId, coachId: user.id } }),
    ]);
  } else if (action === 'reject') {
    await prisma.coachRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
```

---

## Task 18: Coach requests panel

**Files:** Create `components/CoachRequestsPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Surface } from '@/components/ui';

type PendingRequest = {
  id: number;
  athlete: { id: number; name: string; email: string };
};

export function CoachRequestsPanel() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/coach/requests')
      .then((r) => r.json())
      .then((data) => {
        setRequests(data.requests ?? []);
        setLoading(false);
      });
  }, []);

  async function handleAction(requestId: number, action: 'accept' | 'reject') {
    await fetch(`/api/coach/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  if (loading || requests.length === 0) return null;

  return (
    <Surface>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Athlete requests</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Pending join requests</h2>
      <div className="mt-4 space-y-3">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-white">{req.athlete.name}</p>
              <p className="text-xs text-slate-400">{req.athlete.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(req.id, 'accept')}
                className="cursor-pointer rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Accept
              </button>
              <button
                onClick={() => handleAction(req.id, 'reject')}
                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-white/10"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}
```

---

## Task 19: Remove demo artifacts and update landing

**Files:** `app/page.tsx`, delete `lib/demo-session.ts`

- [ ] **Step 1: Replace `app/page.tsx` with a redirect**

```tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/login');
}
```

- [ ] **Step 2: Delete `lib/demo-session.ts`**

```bash
rm lib/demo-session.ts
```

- [ ] **Step 3: Verify no remaining imports of demo-session**

```bash
grep -r "demo-session" . --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next
```

Expected: no output.

---

## Task 20: Smoke test

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

Expected: no compile errors.

- [ ] **Step 2: Unauthenticated access**

Open `http://localhost:3000/coach` — should redirect to `/login`.
Open `http://localhost:3000/athlete` — should redirect to `/login`.

- [ ] **Step 3: Sign up as coach**

Go to `/signup`, pick "I am a coach", fill in name/email/password, submit. Should land on `/coach` dashboard.

- [ ] **Step 4: Sign in with demo credentials**

Go to `/login`, sign in as `maria@demo.local` / `demo1234`. Should land on `/athlete` week view.

- [ ] **Step 5: Role enforcement**

While signed in as athlete, navigate to `http://localhost:3000/coach` — should redirect to `/athlete`.

- [ ] **Step 6: Coach request flow**

Sign up as a new athlete account. Should land on `/athlete/profile`. Click "Find a coach", search for the demo coach name, send a request. Sign in as `coach@demo.local` / `demo1234` — coach dashboard should show the pending request. Accept it. Sign back in as the athlete — should now see the planning view.

- [ ] **Step 7: Lint check**

```bash
pnpm lint
```

Expected: no errors.
