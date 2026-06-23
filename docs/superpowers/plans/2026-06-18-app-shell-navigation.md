# App Shell Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build signed-in app shell with left navigation, bottom profile/settings/sign-out block, wider content layout, shared `/profile` and `/settings` pages, and consistent back-navigation rules across coach and athlete flows.

**Architecture:** Add a shared `(app)` route-group layout that renders one `AppShell` for all signed-in routes while keeping auth pages on the existing narrow centered layout. Use one navigation config module and one small account service so role-aware nav, profile updates, and account pages stay out of page components and route handlers.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Auth.js v5, Prisma + SQLite, node:test

---

## File structure

### Create

- `lib/app-navigation.ts` — role-aware primary navigation plus bottom profile-block actions
- `components/AppShell.tsx` — responsive signed-in frame, mobile drawer toggle, main content wrapper
- `components/AppSidebar.tsx` — primary nav list + bottom profile block container
- `components/AppProfileMenu.tsx` — user summary, `/profile`, `/settings`, `SignOutButton`
- `lib/account-service.ts` — shared user/account reads and display-name update
- `app/(app)/layout.tsx` — signed-in route-group layout
- `app/(app)/profile/page.tsx` — shared profile page server wrapper
- `app/(app)/profile/ProfileClient.tsx` — display-name form client component
- `app/(app)/settings/page.tsx` — shared settings shell page
- `app/api/account/profile/route.ts` — profile update API
- `app/(app)/athlete/find-coach/FindCoachClient.tsx` — extracted client UI for coach discovery
- `tests/app-shell-navigation.test.mjs` — regression coverage for shell/nav/account flows

### Move

- `app/coach/page.tsx` -> `app/(app)/coach/page.tsx`
- `app/coach/templates/page.tsx` -> `app/(app)/coach/templates/page.tsx`
- `app/coach/athletes/[athleteId]/page.tsx` -> `app/(app)/coach/athletes/[athleteId]/page.tsx`
- `app/athlete/page.tsx` -> `app/(app)/athlete/page.tsx`
- `app/athlete/find-coach/page.tsx` -> `app/(app)/athlete/find-coach/page.tsx`
- `app/athlete/profile/page.tsx` -> `app/(app)/athlete/profile/page.tsx`

### Modify

- `app/page.tsx` — root redirect chooses `/login`, `/setup`, `/coach`, or `/athlete`
- `app/layout.tsx` — keep global providers only; signed-in shell moves out
- `auth.ts` — refresh `name`/`email` on `session.update`
- `lib/api-auth.ts` — add generic signed-in guard
- `lib/athlete-service.ts` — support shell/profile/discovery state reads
- `tests/layout-centering.test.mjs` — update for `(app)` layout and auth-only centering checks
- `tests/architecture-boundaries.test.mjs` — keep service-boundary coverage aligned with moved files

## Notes for implementer

- Keep auth pages (`/login`, `/signup`, `/setup`) on existing centered layout. Do **not** wrap them in `AppShell`.
- Keep bottom profile block separate from primary nav. `Profile`, `Settings`, and `Sign out` belong there, not in main nav.
- For athletes with active coach, hide coach discovery from sidebar and redirect direct `/athlete/find-coach` visits back to `/athlete`.
- `/athlete/profile` becomes compatibility alias that redirects to `/profile`.
- `/settings` is shell-only in v1: no new persisted preference fields in this project.
- `/profile` supports editing only fields already backed by current schema: display name. Email stays read-only.

### Task 1: Root routing and navigation contract

**Files:**
- Create: `lib/app-navigation.ts`
- Create: `tests/app-shell-navigation.test.mjs`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write the failing navigation-contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('root route and app navigation define signed-in entry points and role-aware menus', async () => {
  const homeSource = await read('app/page.tsx');
  const navSource = await read('lib/app-navigation.ts');

  assert.match(homeSource, /getCurrentUser/);
  assert.match(homeSource, /redirect\('\/login'\)/);
  assert.match(homeSource, /redirect\('\/setup'\)/);
  assert.match(homeSource, /redirect\(user\.role === 'COACH' \? '\/coach' : '\/athlete'\)/);

  assert.match(navSource, /export function getPrimaryNavigation/);
  assert.match(navSource, /hasActiveCoach/);
  assert.match(navSource, /Coach discovery/);
  assert.match(navSource, /href: '\/profile'/);
  assert.match(navSource, /href: '\/settings'/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/app-shell-navigation.test.mjs`  
Expected: FAIL with `ENOENT` for `lib/app-navigation.ts` and missing `getCurrentUser` assertions in `app/page.tsx`.

- [ ] **Step 3: Implement the navigation config**

```ts
export type AppRole = 'COACH' | 'ATHLETE';

export type NavItem = {
  label: string;
  href: string;
  matchPrefix: string;
};

export function getPrimaryNavigation(role: AppRole, { hasActiveCoach = false }: { hasActiveCoach?: boolean } = {}): NavItem[] {
  if (role === 'COACH') {
    return [
      { label: 'Dashboard', href: '/coach', matchPrefix: '/coach' },
      { label: 'Templates', href: '/coach/templates', matchPrefix: '/coach/templates' },
    ];
  }

  return [
    { label: 'Week plan', href: '/athlete', matchPrefix: '/athlete' },
    ...(hasActiveCoach ? [] : [{ label: 'Coach discovery', href: '/athlete/find-coach', matchPrefix: '/athlete/find-coach' }]),
  ];
}

export const profileActions = [
  { label: 'Profile', href: '/profile' },
  { label: 'Settings', href: '/settings' },
] as const;
```

- [ ] **Step 4: Make `/` route role-aware**

```tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-session';

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (!user.role) redirect('/setup');

  redirect(user.role === 'COACH' ? '/coach' : '/athlete');
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/app-shell-navigation.test.mjs`  
Expected: PASS for the new navigation-contract test.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx lib/app-navigation.ts tests/app-shell-navigation.test.mjs
git commit -m "feat: add app navigation contract"
```

### Task 2: Signed-in shell layout and responsive frame

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `components/AppShell.tsx`
- Create: `components/AppSidebar.tsx`
- Create: `components/AppProfileMenu.tsx`
- Modify: `app/layout.tsx`
- Modify: `tests/layout-centering.test.mjs`

- [ ] **Step 1: Extend the layout regression test**

```js
test('signed-in routes use grouped app shell while auth pages stay centered', async () => {
  const rootLayoutSource = await read('app/layout.tsx');
  const signedInLayoutSource = await read('app/(app)/layout.tsx');
  const shellSource = await read('components/AppShell.tsx');
  const sidebarSource = await read('components/AppSidebar.tsx');
  const profileMenuSource = await read('components/AppProfileMenu.tsx');

  assert.match(rootLayoutSource, /SessionProviderWrapper/);
  assert.doesNotMatch(rootLayoutSource, /max-w-screen-2xl|max-w-7xl/);

  assert.match(signedInLayoutSource, /redirect\('\/login'\)/);
  assert.match(signedInLayoutSource, /redirect\('\/setup'\)/);
  assert.match(signedInLayoutSource, /AppShell/);
  assert.match(signedInLayoutSource, /athleteService\.findProfileByUserId/);

  assert.match(shellSource, /useState\(false\)/);
  assert.match(shellSource, /AppSidebar/);
  assert.match(shellSource, /lg:grid-cols-\[/);
  assert.match(sidebarSource, /getPrimaryNavigation/);
  assert.match(profileMenuSource, /Profile/);
  assert.match(profileMenuSource, /Settings/);
  assert.match(profileMenuSource, /SignOutButton/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/layout-centering.test.mjs tests/app-shell-navigation.test.mjs`  
Expected: FAIL because `(app)` layout and shell components do not exist yet.

- [ ] **Step 3: Create the signed-in route-group layout**

```tsx
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (!user.role) redirect('/setup');

  const hasActiveCoach = user.role === 'ATHLETE' ? Boolean(await athleteService.findProfileByUserId(user.id)) : false;

  return (
    <AppShell user={user} hasActiveCoach={hasActiveCoach}>
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 4: Build the responsive shell components**

```tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import type { SessionUser } from '@/lib/auth-session';

export function AppShell({
  user,
  hasActiveCoach,
  children,
}: {
  user: SessionUser & { role: 'COACH' | 'ATHLETE' };
  hasActiveCoach: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <AppSidebar
        user={user}
        pathname={pathname}
        hasActiveCoach={hasActiveCoach}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <button type="button" className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 lg:hidden" onClick={() => setMobileOpen(true)}>
          Menu
        </button>
        {children}
      </div>
    </div>
  );
}
```

```tsx
import Link from 'next/link';
import { getPrimaryNavigation } from '@/lib/app-navigation';
import { AppProfileMenu } from '@/components/AppProfileMenu';

export function AppSidebar(props: {
  user: { name: string; email: string; role: 'COACH' | 'ATHLETE' };
  pathname: string;
  hasActiveCoach: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const navItems = getPrimaryNavigation(props.user.role, { hasActiveCoach: props.hasActiveCoach });

  return (
    <aside className="border-r border-white/10 bg-[rgba(15,23,42,0.94)]">
      <div className="flex h-full flex-col gap-6 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Workout Planner</p>
          <p className="mt-2 text-sm text-slate-300">{props.user.role === 'COACH' ? 'Coach workspace' : 'Athlete workspace'}</p>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = props.pathname === item.href || props.pathname.startsWith(item.matchPrefix + '/');
            return (
              <Link key={item.href} href={item.href} className={isActive ? 'block rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white' : 'block rounded-2xl px-4 py-3 text-sm text-slate-300 hover:bg-white/5'}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <AppProfileMenu user={props.user} />
        </div>
      </div>
    </aside>
  );
}
```

```tsx
import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';

export function AppProfileMenu({ user }: { user: { name: string; email: string } }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">{user.name}</p>
      <p className="mt-1 text-xs text-slate-400">{user.email}</p>
      <div className="mt-4 space-y-2">
        <Link href="/profile" className="block rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10">Profile</Link>
        <Link href="/settings" className="block rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10">Settings</Link>
        <SignOutButton />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Keep the root layout provider-only**

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
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Run the shell regression tests**

Run: `node --test tests/layout-centering.test.mjs tests/app-shell-navigation.test.mjs`  
Expected: PASS for the grouped-layout and shell-component checks while auth-page centering assertions still pass.

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx app/\(app\)/layout.tsx components/AppShell.tsx components/AppSidebar.tsx components/AppProfileMenu.tsx tests/layout-centering.test.mjs
git commit -m "feat: add signed-in app shell"
```

### Task 3: Shared account service, `/profile`, and `/settings`

**Files:**
- Create: `lib/account-service.ts`
- Create: `app/api/account/profile/route.ts`
- Create: `app/(app)/profile/page.tsx`
- Create: `app/(app)/profile/ProfileClient.tsx`
- Create: `app/(app)/settings/page.tsx`
- Modify: `auth.ts`
- Modify: `lib/api-auth.ts`
- Modify: `app/(app)/athlete/profile/page.tsx`
- Modify: `tests/app-shell-navigation.test.mjs`
- Modify: `tests/architecture-boundaries.test.mjs`

- [ ] **Step 1: Add failing tests for account plumbing**

```js
test('profile and settings routes use shared account service and profile alias redirect', async () => {
  const accountServiceSource = await read('lib/account-service.ts');
  const apiAuthSource = await read('lib/api-auth.ts');
  const profileRouteSource = await read('app/api/account/profile/route.ts');
  const profilePageSource = await read('app/(app)/profile/page.tsx');
  const profileClientSource = await read('app/(app)/profile/ProfileClient.tsx');
  const settingsPageSource = await read('app/(app)/settings/page.tsx');
  const profileAliasSource = await read('app/(app)/athlete/profile/page.tsx');
  const authSource = await read('auth.ts');

  assert.match(accountServiceSource, /export function createAccountService/);
  assert.match(accountServiceSource, /updateDisplayName/);
  assert.match(apiAuthSource, /export async function requireSignedInUser/);
  assert.match(profileRouteSource, /accountService\.updateDisplayName/);
  assert.match(profilePageSource, /ProfileClient/);
  assert.match(profileClientSource, /useSession\(\)/);
  assert.match(settingsPageSource, /metric|kilometer|notification/i);
  assert.match(profileAliasSource, /redirect\('\/profile'\)/);
  assert.match(authSource, /select: \{ role: true, name: true, email: true \}/);
});
```

```js
test('account route avoids direct prisma access in route handlers', async () => {
  const routeSource = await read('app/api/account/profile/route.ts');
  assert.equal(routeSource.includes('prisma.'), false);
  assert.match(routeSource, /requireSignedInUser/);
  assert.match(routeSource, /accountService/);
});
```

- [ ] **Step 2: Run the account tests to verify they fail**

Run: `node --test tests/app-shell-navigation.test.mjs tests/architecture-boundaries.test.mjs`  
Expected: FAIL with missing account-service files and missing `requireSignedInUser`.

- [ ] **Step 3: Add the shared account service and generic signed-in guard**

```ts
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
```

```ts
export async function requireSignedInUser() {
  const session = await auth();
  if (!session?.user) return { user: null, error: unauthorized };
  return { user: session.user as { id: number; role: string | null; name?: string | null; email?: string | null }, error: null };
}
```

- [ ] **Step 4: Implement profile API and session refresh**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireSignedInUser } from '@/lib/api-auth';
import { accountService } from '@/lib/account-service';

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireSignedInUser();
  if (error || !user) return error;

  const { name } = await req.json();
  const trimmedName = String(name ?? '').trim();

  if (!trimmedName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  await accountService.updateDisplayName(user.id, trimmedName);
  return NextResponse.json({ ok: true });
}
```

```ts
if (trigger === 'update' || (!token.role && token.userId)) {
  const dbUser = await prisma.user.findUnique({
    where: { id: token.userId as number },
    select: { role: true, name: true, email: true },
  });
  if (dbUser) {
    token.role = dbUser.role;
    token.name = dbUser.name;
    token.email = dbUser.email;
  }
}

session.user.name = (token.name as string | undefined) ?? session.user.name;
session.user.email = (token.email as string | undefined) ?? session.user.email;
```

- [ ] **Step 5: Build `/profile`, `/settings`, and the alias redirect**

```tsx
import { redirect } from 'next/navigation';
import { PageShell, Surface, TopBar } from '@/components/ui';
import { ProfileClient } from './ProfileClient';
import { getCurrentUser } from '@/lib/auth-session';
import { accountService } from '@/lib/account-service';
import { athleteService } from '@/lib/athlete-service';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const account = await accountService.getAccount(user.id);
  const athleteState = user.role === 'ATHLETE' ? await athleteService.loadProfileState(user.id) : null;

  if (!account) redirect('/login');

  return (
    <PageShell size="wide">
      <TopBar eyebrow="Profile" title={account.name} description="Personal details and current account identity." />
      <ProfileClient account={account} athleteState={athleteState} />
    </PageShell>
  );
}
```

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Surface } from '@/components/ui';

export function ProfileClient({ account, athleteState }) {
  const [name, setName] = useState(account.name);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { update } = useSession();

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: 'Could not save profile' }));
      setError(payload.error ?? 'Could not save profile');
      setSaving(false);
      return;
    }

    await update();
    router.refresh();
    setMessage('Profile updated.');
    setSaving(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Surface>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-300">Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white" />
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <p>Email: {account.email}</p>
            <p>Role: {account.role}</p>
          </div>
        </form>
      </Surface>
      <Surface>
        {'latestRequest' in (athleteState ?? {}) ? (
          <p className="text-sm text-slate-300">Coach status: {athleteState?.latestRequest?.status ?? 'No coach yet'}</p>
        ) : (
          <p className="text-sm text-slate-300">Coach profile details will expand here later.</p>
        )}
      </Surface>
    </div>
  );
}
```

```tsx
import { redirect } from 'next/navigation';
import { PageShell, Surface, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <PageShell size="wide">
      <TopBar eyebrow="Settings" title="App settings" description="System-level preferences will grow here over time." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Surface>
          <h2 className="text-lg font-semibold text-white">Units</h2>
          <p className="mt-2 text-sm text-slate-300">Metric and imperial preferences will be added here in a later schema-backed pass.</p>
        </Surface>
        <Surface>
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
          <p className="mt-2 text-sm text-slate-300">Notification preferences will be added here in a later schema-backed pass.</p>
        </Surface>
      </div>
    </PageShell>
  );
}
```

```tsx
import { redirect } from 'next/navigation';

export default function AthleteProfileAliasPage() {
  redirect('/profile');
}
```

- [ ] **Step 6: Run the account tests to verify they pass**

Run: `node --test tests/app-shell-navigation.test.mjs tests/architecture-boundaries.test.mjs`  
Expected: PASS for account-service, profile/settings, alias redirect, and auth-refresh assertions.

- [ ] **Step 7: Commit**

```bash
git add auth.ts lib/api-auth.ts lib/account-service.ts app/api/account/profile/route.ts app/\(app\)/profile/page.tsx app/\(app\)/profile/ProfileClient.tsx app/\(app\)/settings/page.tsx app/\(app\)/athlete/profile/page.tsx tests/app-shell-navigation.test.mjs tests/architecture-boundaries.test.mjs
git commit -m "feat: add shared profile and settings pages"
```

### Task 4: Coach pages inside shared shell

**Files:**
- Move: `app/coach/page.tsx` -> `app/(app)/coach/page.tsx`
- Move: `app/coach/templates/page.tsx` -> `app/(app)/coach/templates/page.tsx`
- Move: `app/coach/athletes/[athleteId]/page.tsx` -> `app/(app)/coach/athletes/[athleteId]/page.tsx`
- Modify: `tests/layout-centering.test.mjs`
- Modify: `tests/app-shell-navigation.test.mjs`

- [ ] **Step 1: Write failing coach-shell tests**

```js
test('coach pages rely on shared shell and keep only contextual local actions', async () => {
  const coachPageSource = await read('app/(app)/coach/page.tsx');
  const templatesPageSource = await read('app/(app)/coach/templates/page.tsx');
  const plannerPageSource = await read('app/(app)/coach/athletes/[athleteId]/page.tsx');

  assert.doesNotMatch(coachPageSource, /SignOutButton/);
  assert.doesNotMatch(coachPageSource, /href="\/coach\/templates"/);
  assert.doesNotMatch(templatesPageSource, /SignOutButton/);
  assert.match(plannerPageSource, /Back to dashboard/);
  assert.doesNotMatch(plannerPageSource, /SignOutButton/);
});
```

- [ ] **Step 2: Run the coach-shell tests to verify they fail**

Run: `node --test tests/app-shell-navigation.test.mjs tests/layout-centering.test.mjs`  
Expected: FAIL because the grouped coach files do not exist yet and current pages still embed global actions.

- [ ] **Step 3: Move the coach routes under `(app)` and remove global-header nav**

```tsx
return (
  <PageShell size="wide">
    <TopBar
      eyebrow="Coach dashboard"
      title={coach.name}
      description="Athlete list and upcoming week status."
    />
    <div className="grid gap-4 sm:grid-cols-3">
      <StatTile label="Athletes" value={String(athleteRows.length)} detail="Coach-owned roster" />
      <StatTile label="Planned sessions" value={String(athleteRows.reduce((total, row) => total + row.sessionCount, 0))} detail="Current week" />
      <StatTile label="Strong weeks" value={String(athleteRows.filter((row) => row.status === 'Well planned').length)} detail="4 or more sessions scheduled" />
    </div>
    <CoachRequestsPanel />
    <Surface>{athleteRows.map((row) => <AthleteRosterCard key={row.id} row={row} />)}</Surface>
  </PageShell>
);
```

```tsx
return (
  <PageShell size="wide">
    <TopBar
      eyebrow="Coach templates"
      title="Private session templates"
      description="Templates are coach-owned reusable sessions."
    />
    <CoachTemplatesClient templates={templates.map((template) => ({ ...template }))} />
  </PageShell>
);
```

```tsx
actions={
  <>
    <ActionLink href="/coach" tone="secondary">
      Back to dashboard
    </ActionLink>
    <ActionLink href={`/coach/athletes/${plannerSnapshot.athlete.profileId}?weekStart=${plannerSnapshot.week.previousStart}`} tone="secondary">
      Previous week
    </ActionLink>
    <ActionLink href={`/coach/athletes/${plannerSnapshot.athlete.profileId}?weekStart=${plannerSnapshot.week.nextStart}`}>
      Next week
    </ActionLink>
  </>
}
```

- [ ] **Step 4: Run the coach-shell tests to verify they pass**

Run: `node --test tests/app-shell-navigation.test.mjs tests/layout-centering.test.mjs`  
Expected: PASS for coach page movement and contextual-back-link assertions.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/coach/page.tsx app/\(app\)/coach/templates/page.tsx app/\(app\)/coach/athletes/\[athleteId\]/page.tsx tests/app-shell-navigation.test.mjs tests/layout-centering.test.mjs
git commit -m "feat: move coach routes into app shell"
```

### Task 5: Athlete pages, discovery state, and route gating

**Files:**
- Move: `app/athlete/page.tsx` -> `app/(app)/athlete/page.tsx`
- Move: `app/athlete/find-coach/page.tsx` -> `app/(app)/athlete/find-coach/page.tsx`
- Create: `app/(app)/athlete/find-coach/FindCoachClient.tsx`
- Modify: `lib/athlete-service.ts`
- Modify: `tests/app-shell-navigation.test.mjs`
- Modify: `tests/architecture-boundaries.test.mjs`

- [ ] **Step 1: Add failing athlete-shell tests**

```js
test('athlete routes gate discovery correctly and keep onboarding state in discovery page', async () => {
  const athletePageSource = await read('app/(app)/athlete/page.tsx');
  const discoveryPageSource = await read('app/(app)/athlete/find-coach/page.tsx');
  const discoveryClientSource = await read('app/(app)/athlete/find-coach/FindCoachClient.tsx');
  const athleteServiceSource = await read('lib/athlete-service.ts');

  assert.match(athletePageSource, /redirect\('\/athlete\/find-coach'\)/);
  assert.match(discoveryPageSource, /getCurrentUser/);
  assert.match(discoveryPageSource, /redirect\('\/athlete'\)/);
  assert.match(discoveryClientSource, /Messaging coming soon/);
  assert.match(athleteServiceSource, /loadCoachSearchState/);
  assert.match(athleteServiceSource, /findProfileByUserId/);
});
```

```js
test('moved athlete pages still avoid direct prisma access', async () => {
  for (const relativePath of [
    'app/(app)/athlete/page.tsx',
    'app/(app)/athlete/find-coach/page.tsx',
    'app/(app)/profile/page.tsx',
  ]) {
    const source = await read(relativePath);
    assert.equal(source.includes('prisma.'), false, `${relativePath} still reaches Prisma directly`);
  }
});
```

- [ ] **Step 2: Run the athlete tests to verify they fail**

Run: `node --test tests/app-shell-navigation.test.mjs tests/architecture-boundaries.test.mjs`  
Expected: FAIL because grouped athlete files and discovery client do not exist yet.

- [ ] **Step 3: Move the athlete week page and keep no-coach redirect explicit**

```tsx
import { redirect } from 'next/navigation';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { PageShell, TopBar } from '@/components/ui';
import { AthleteWeekView } from '@/components/AthleteWeekView';
import { groupSessionsByDay } from '@/lib/week';

export default async function AthletePage({ searchParams }: { searchParams: Promise<{ weekStart?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { weekStart: weekStartParam } = await searchParams;
  const athleteContext = await athleteService.loadWeekByUserId(user.id, weekStartParam ?? startOfWeek(new Date(), { weekStartsOn: 1 }));

  if (!athleteContext) redirect('/athlete/find-coach');

  const plannerSnapshot = athleteContext.snapshot;
  const grouped = groupSessionsByDay(
    plannerSnapshot.sessions.map((session) => ({
      ...session,
      scheduledDate: new Date(session.scheduledDate),
      completion: session.completion
        ? { ...session.completion, completedAt: session.completion.completedAt ? new Date(session.completion.completedAt) : null }
        : null,
    })),
    new Date(plannerSnapshot.week.start),
  );
  const today = new Date();
  const todayIndex = grouped.findIndex((day) => isSameDay(day.date, today));

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Athlete week"
        title={user.name}
        description={`Weekly plan from ${plannerSnapshot.athlete.coachName}. Week of ${format(new Date(plannerSnapshot.week.start), 'd MMM yyyy')}.`}
        actions={
          <>
            <ActionLink href={`/athlete?weekStart=${plannerSnapshot.week.previousStart}`} tone="secondary">Previous week</ActionLink>
            <ActionLink href={`/athlete?weekStart=${plannerSnapshot.week.nextStart}`}>Next week</ActionLink>
          </>
        }
      />
      <AthleteWeekView key={plannerSnapshot.week.start} weeklyNote={plannerSnapshot.week.weeklyNote} weekStart={new Date(plannerSnapshot.week.start)} days={grouped} todayIndex={todayIndex} />
    </PageShell>
  );
}
```

- [ ] **Step 4: Split discovery into server gate + client UI**

```tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { FindCoachClient } from './FindCoachClient';

export default async function FindCoachPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const state = await athleteService.loadCoachSearchState(user.id);
  if (state.profile) redirect('/athlete');

  return <FindCoachClient initialState={state} />;
}
```

```tsx
'use client';

import { useMemo, useState } from 'react';
import { PageShell, Surface, TopBar } from '@/components/ui';

export function FindCoachClient({ initialState }) {
  const [requestState, setRequestState] = useState(initialState);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Coach discovery"
        title="Search coaches"
        description="Browse coaches, review lightweight details, and request to join."
      />
      <Surface>
        <form className="flex gap-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white" />
          <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Search</button>
        </form>
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          Messaging coming soon. For now, review coach details and send a join request.
        </div>
        {errorMessage ? <p className="mt-4 text-sm text-amber-300">{errorMessage}</p> : null}
        <div className="mt-4 space-y-3">
          {results.map((coach) => (
            <div key={coach.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm font-semibold text-white">{coach.name}</p>
              <p className="text-xs text-slate-400">{coach.email}</p>
            </div>
          ))}
        </div>
      </Surface>
    </PageShell>
  );
}
```

- [ ] **Step 5: Keep athlete service aligned with shell state**

```ts
async loadCoachSearchState(userId: number) {
  const [profile, requests] = await Promise.all([
    db.athleteProfile.findUnique({ where: { userId } }),
    listRequestsForAthlete(userId),
  ]);

  return {
    profile,
    requests,
    latestRequest: selectPrimaryRequest(requests),
  };
}
```

Call this same helper from both the server discovery page and the shared profile page summary so coach-request state has one source of truth.

- [ ] **Step 6: Run the athlete tests to verify they pass**

Run: `node --test tests/app-shell-navigation.test.mjs tests/architecture-boundaries.test.mjs`  
Expected: PASS for no-coach redirect, direct discovery gating, and “messaging coming soon” coverage.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/athlete/page.tsx app/\(app\)/athlete/find-coach/page.tsx app/\(app\)/athlete/find-coach/FindCoachClient.tsx lib/athlete-service.ts tests/app-shell-navigation.test.mjs tests/architecture-boundaries.test.mjs
git commit -m "feat: align athlete flow with app shell"
```

### Task 6: Integrated verification

**Files:**
- Validate: `tests/app-shell-navigation.test.mjs`, `tests/layout-centering.test.mjs`, `tests/architecture-boundaries.test.mjs`

- [ ] **Step 1: Run the focused regression suite**

Run: `node --test tests/app-shell-navigation.test.mjs tests/layout-centering.test.mjs tests/architecture-boundaries.test.mjs`  
Expected: PASS for shell, layout, account, and architecture regressions.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`  
Expected: PASS with no ESLint errors.

- [ ] **Step 3: Run build**

Run: `pnpm build`  
Expected: PASS with successful `prisma generate` and `next build`.

- [ ] **Step 4: Do browser smoke pass**

Check these exact flows manually:

```text
1. Sign in as coach -> lands on /coach -> sidebar visible -> bottom profile block links to /profile and /settings -> /coach/athletes/[id] shows Back to dashboard.
2. Sign in as athlete with active coach -> lands on /athlete -> Coach discovery hidden from sidebar -> direct /athlete/find-coach redirects back to /athlete.
3. Sign in as athlete without coach -> lands on /athlete/find-coach -> discovery page shows request-state banner and “Messaging coming soon.”
4. Open /athlete/profile -> redirects to /profile.
5. Update display name on /profile -> sidebar profile block updates after save.
6. Open app on small screen width -> menu button opens drawer with same primary nav and bottom profile actions.
```

- [ ] **Step 5: Stop if any validation command fails**

Do not open a broad cleanup pass. Fix the exact failing task in its own follow-up commit, then rerun Task 6 from Step 1.
