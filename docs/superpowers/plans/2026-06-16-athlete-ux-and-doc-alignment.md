# Athlete UX and Doc Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing athlete-side week navigation and pending coach-request visibility, then align the stale markdown docs with the current auth-based architecture.

**Architecture:** Keep week loading server-driven through `planner-service` and URL `weekStart` params, mirroring the existing coach planner. Keep athlete request status server-rendered on `/athlete/profile` with Prisma queries on the page and a small read-only GET endpoint for future client reuse, without introducing new client state managers or bypassing the existing auth helpers.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + SQLite, Auth.js v5, pnpm.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `app/athlete/page.tsx` | Accept `weekStart` from `searchParams`, drive athlete week navigation from `planner-service`, add previous/next week actions. |
| Modify | `app/athlete/profile/page.tsx` | Surface pending or accepted coach-request state before the athlete has a plan. |
| Modify | `app/api/athlete/coach-requests/route.ts` | Add authenticated `GET` support for athlete request status while preserving the existing `POST` create flow. |
| Modify | `README.md` | Add auth-aware local setup notes. |
| Modify | `ARCHITECTURE.md` | Replace stale `demo-session` references with `auth-session` / `api-auth` boundaries. |
| Modify | `CLAUDE.md` | Update auth guidance to match the current codebase. |
| Modify | `SPEC.md` | Mark demo-auth statements as outdated and real auth as the current state. |

---

### Task 1: Add athlete request-status reads

**Files:**
- Modify: `app/api/athlete/coach-requests/route.ts`
- Modify: `app/athlete/profile/page.tsx`

- [ ] **Step 1: Write the failing behavior expectation**

```ts
// Expected behavior after this task:
// - GET /api/athlete/coach-requests returns the signed-in athlete's requests.
// - /athlete/profile shows a waiting state when a pending request exists.
// - /athlete/profile keeps the existing "Find a coach" CTA when no request exists.
```

- [ ] **Step 2: Run the current lint baseline**

Run: `pnpm lint`
Expected: the current branch lint baseline is known before changes.

- [ ] **Step 3: Extend the athlete request route with GET**

```ts
export async function GET() {
  const { user, error } = await requireAthlete();
  if (error) return error;

  const requests = await prisma.coachRequest.findMany({
    where: { athleteId: user.id },
    include: {
      coach: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });

  return NextResponse.json({
    requests: requests.map((request) => ({
      id: request.id,
      status: request.status,
      coach: request.coach,
      updatedAt: request.updatedAt.toISOString(),
    })),
  });
}
```

- [ ] **Step 4: Read pending request state on the profile page**

```ts
const pendingRequest = await prisma.coachRequest.findFirst({
  where: { athleteId: user.id, status: 'PENDING' },
  include: {
    coach: {
      select: { name: true, email: true },
    },
  },
  orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
});
```

Render a focused empty-state variant such as:

```tsx
<EmptyState
  title={`Waiting for ${pendingRequest.coach.name}`}
  description={`Your join request is pending. We'll show your weekly plan here once ${pendingRequest.coach.name} accepts it.`}
/>
```

- [ ] **Step 5: Re-run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/athlete/coach-requests/route.ts app/athlete/profile/page.tsx
git commit -m "feat: show athlete coach request status"
```

---

### Task 2: Add athlete week navigation

**Files:**
- Modify: `app/athlete/page.tsx`

- [ ] **Step 1: Write the failing behavior expectation**

```ts
// Expected behavior after this task:
// - /athlete?weekStart=YYYY-MM-DD loads that week instead of always using today.
// - The athlete top bar shows Previous week / Next week actions.
// - Empty-state weeks still allow navigation to neighboring weeks.
```

- [ ] **Step 2: Run a targeted build check after Task 1**

Run: `pnpm build`
Expected: PASS before the week-navigation edit begins.

- [ ] **Step 3: Accept and normalize `searchParams` in the athlete page**

```ts
export default async function AthletePage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string }>;
}) {
  const { weekStart: weekStartParam } = await searchParams;
  // ...
  const plannerSnapshot = await plannerService
    .forWeek({ athleteId: athleteProfile.id, weekStart: weekStartParam ?? new Date() })
    .load();
}
```

- [ ] **Step 4: Add previous/next week links from the planner snapshot**

```tsx
<TopBar
  eyebrow="Athlete week"
  title={user.name}
  description={`Weekly plan from ${plannerSnapshot.athlete.coachName}.`}
  actions={
    <>
      <ActionLink href={`/athlete?weekStart=${plannerSnapshot.week.previousStart}`} tone="secondary">
        Previous week
      </ActionLink>
      <ActionLink href={`/athlete?weekStart=${plannerSnapshot.week.nextStart}`}>
        Next week
      </ActionLink>
    </>
  }
/>
```

For the no-plan branch, keep navigation visible by rendering the same actions around the empty state using the requested `weekStart`.

- [ ] **Step 5: Re-run lint and build**

Run: `pnpm lint && pnpm build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/athlete/page.tsx
git commit -m "feat: add athlete week navigation"
```

---

### Task 3: Align markdown docs with the shipped auth architecture

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `CLAUDE.md`
- Modify: `SPEC.md`

- [ ] **Step 1: Replace stale demo-auth statements**

```md
- `lib/auth-session.ts` owns current-user session lookup for server components.
- `lib/api-auth.ts` owns role checks for route handlers.
- Auth is implemented with Auth.js v5 using credentials and optional Google OAuth.
```

- [ ] **Step 2: Update local setup docs**

Add the real startup notes to `README.md`:

```md
1. Copy `.env.example` to `.env.local`
2. Set `AUTH_SECRET`
3. Optionally add Google OAuth credentials for social sign-in
4. Run `pnpm db:push`
5. Run `pnpm db:seed`
6. Run `pnpm dev`
```

- [ ] **Step 3: Update `SPEC.md` to describe the current auth state**

```md
- Replace "seeded demo role entry" with the current login / signup / setup flow.
- Replace "full production authentication is deferred" with a note that auth is now implemented and coaching workflow improvements remain the active product area.
```

- [ ] **Step 4: Re-read the edited docs for consistency**

Run: `git --no-pager diff -- README.md ARCHITECTURE.md CLAUDE.md SPEC.md`
Expected: only auth/documentation alignment changes appear.

- [ ] **Step 5: Commit**

```bash
git add README.md ARCHITECTURE.md CLAUDE.md SPEC.md
git commit -m "docs: align auth architecture docs"
```

---

### Task 4: Final verification and UX review

**Files:**
- Modify: none expected

- [ ] **Step 1: Run final verification**

Run: `pnpm lint && pnpm build`
Expected: PASS

- [ ] **Step 2: Review the changed UX surfaces**

Check these pages in the running app or by reading the final diff:

```text
/athlete/profile
/athlete?weekStart=<current-week>
/athlete?weekStart=<next-week>
```

Confirm:

```text
- Pending coach requests are visible before acceptance.
- Athletes can move week to week.
- Empty states still explain what to do next.
- Docs no longer describe demo-only auth.
```

- [ ] **Step 3: Commit any last doc or copy adjustments**

```bash
git add -A
git commit -m "chore: polish athlete ux follow-up"
```

---

## Self-review

- **Spec coverage:** This plan covers the documented missing athlete week navigation, the missing athlete-side request visibility in the auth design, and the stale auth/docs drift called out by the markdown audit.
- **Placeholder scan:** No TBD/TODO placeholders remain.
- **Type consistency:** The plan reuses existing `requireAthlete`, `plannerService`, `ActionLink`, `TopBar`, and Prisma `coachRequest` naming.
