# Athlete Flow, Week View, and Template Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve athlete onboarding first, then athlete week browsing, then coach template reuse with focused changes that fit the current service-oriented app structure.

**Architecture:** Keep request and template business logic inside `lib/coach-request-service.ts`, `lib/athlete-service.ts`, and `lib/template-service.ts`. Keep page and client changes thin: use `/app/athlete/*` for athlete UX polish, `components/AthleteWeekView.tsx` for week-view interaction changes, and `app/coach/templates/CoachTemplatesClient.tsx` plus a small API addition for template duplication.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + SQLite, Auth.js v5, node:test, pnpm.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `tests/architecture-boundaries.test.mjs` | Lock in the new onboarding, week-view, and template behavior at the repo’s existing test level. |
| Modify | `lib/athlete-service.ts` | Add athlete-facing request-state reads that both profile and coach-search pages can reuse. |
| Modify | `lib/coach-request-service.ts` | Re-open rejected requests for the same coach and keep pending-request conflicts explicit. |
| Modify | `app/api/athlete/coach-requests/route.ts` | Keep athlete request reads/writes thin while preserving current validation. |
| Modify | `app/athlete/profile/page.tsx` | Keep the profile page as the canonical waiting-state screen and tighten copy/CTA handling. |
| Modify | `app/athlete/find-coach/page.tsx` | Surface request-state feedback directly in the search flow and disable confusing actions. |
| Modify | `app/athlete/page.tsx` | Add a stronger week identity plus a current-week shortcut without changing the server-driven week model. |
| Modify | `components/AthleteWeekView.tsx` | Improve initial selected-day behavior for past/future weeks. |
| Modify | `lib/template-service.ts` | Add template duplication while preserving ownership checks and current validation. |
| Create | `app/api/coach/templates/[templateId]/duplicate/route.ts` | Expose template duplication as a focused mutation in the existing template API area. |
| Modify | `app/coach/templates/CoachTemplatesClient.tsx` | Add filtering and duplicate actions to the template library UI. |

---

### Task 1: Re-open rejected coach requests and expose athlete request-state reads

**Files:**
- Modify: `tests/architecture-boundaries.test.mjs`
- Modify: `lib/coach-request-service.ts`
- Modify: `lib/athlete-service.ts`

- [ ] **Step 1: Write the failing test**

```js
test('athlete request services support re-opened rejected requests and shared request-state reads', async () => {
  const coachRequestServiceSource = await read('lib/coach-request-service.ts');
  const athleteServiceSource = await read('lib/athlete-service.ts');

  assert.match(coachRequestServiceSource, /existingRequest/);
  assert.match(coachRequestServiceSource, /existingRequest\.status === 'REJECTED'/);
  assert.match(coachRequestServiceSource, /db\.coachRequest\.update\(/);
  assert.match(athleteServiceSource, /loadCoachSearchState/);
  assert.match(athleteServiceSource, /listForAthlete/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --test-name-pattern="athlete request services support re-opened rejected requests and shared request-state reads"`
Expected: FAIL with a missing `loadCoachSearchState` match and no rejected-request reopen logic.

- [ ] **Step 3: Write minimal service implementation**

```ts
async createForAthlete(athleteUserId: number, coachId: number): Promise<CoachRequestResult> {
  const coach = await db.user.findUnique({ where: { id: coachId } });
  if (!coach || coach.role !== 'COACH') {
    return { ok: false, status: 404, error: 'Coach not found' };
  }

  const existingRequest = await db.coachRequest.findUnique({
    where: { athleteId_coachId: { athleteId: athleteUserId, coachId } },
  });

  if (existingRequest?.status === 'PENDING') {
    return { ok: false, status: 409, error: 'Request already pending' };
  }

  if (existingRequest?.status === 'REJECTED') {
    await db.coachRequest.update({
      where: { id: existingRequest.id },
      data: { status: 'PENDING' },
    });
    return { ok: true };
  }

  await db.coachRequest.create({
    data: { athleteId: athleteUserId, coachId, status: 'PENDING' },
  });
  return { ok: true };
}
```

```ts
async loadCoachSearchState(userId: number) {
  const profile = await db.athleteProfile.findUnique({ where: { userId } });
  const requests = await db.coachRequest.findMany({
    where: { athleteId: userId },
    include: {
      coach: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });

  return {
    profile,
    requests,
    latestRequest: requests[0] ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --test-name-pattern="athlete request services support re-opened rejected requests and shared request-state reads"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/architecture-boundaries.test.mjs lib/coach-request-service.ts lib/athlete-service.ts
git commit -m "feat: reopen rejected coach requests" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Polish athlete onboarding across profile and coach-search pages

**Files:**
- Modify: `tests/architecture-boundaries.test.mjs`
- Modify: `app/api/athlete/coach-requests/route.ts`
- Modify: `app/athlete/profile/page.tsx`
- Modify: `app/athlete/find-coach/page.tsx`

- [ ] **Step 1: Write the failing test**

```js
test('athlete onboarding surfaces request state in profile and coach-search UI', async () => {
  const profileSource = await read('app/athlete/profile/page.tsx');
  const searchSource = await read('app/athlete/find-coach/page.tsx');
  const routeSource = await read('app/api/athlete/coach-requests/route.ts');

  assert.match(profileSource, /Request pending|Waiting for/);
  assert.match(searchSource, /Request pending|Send request again|Back to profile/);
  assert.match(searchSource, /fetch\('\/api\/athlete\/coach-requests'\)/);
  assert.match(routeSource, /Request already pending/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --test-name-pattern="athlete onboarding surfaces request state in profile and coach-search UI"`
Expected: FAIL because the current search page does not read request state and the route still returns the old conflict message.

- [ ] **Step 3: Implement the onboarding UI and route copy changes**

```ts
if (!result.ok) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
```

```tsx
const [requestState, setRequestState] = useState<{
  latestRequest: { status: string; coach: { id: number; name: string; email: string } } | null;
  requestsByCoachId: Record<number, string>;
}>({ latestRequest: null, requestsByCoachId: {} });

useEffect(() => {
  void loadRequestState();
}, []);
```

```tsx
{requestState.latestRequest?.status === 'PENDING' ? (
  <div className="rounded-2xl border border-[rgba(90,124,255,0.28)] bg-[rgba(90,124,255,0.12)] px-4 py-3 text-sm text-slate-100">
    Request pending with {requestState.latestRequest.coach.name}. You can return to your profile while you wait.
  </div>
) : null}
```

```tsx
const coachStatus = requestState.requestsByCoachId[coach.id];
const buttonLabel =
  coachStatus === 'PENDING'
    ? 'Request pending'
    : coachStatus === 'REJECTED'
      ? 'Send request again'
      : 'Request to join';
```

- [ ] **Step 4: Run test and targeted lint**

Run: `pnpm test -- --test-name-pattern="athlete onboarding surfaces request state in profile and coach-search UI" && pnpm lint -- app/athlete/profile/page.tsx app/athlete/find-coach/page.tsx app/api/athlete/coach-requests/route.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/architecture-boundaries.test.mjs app/api/athlete/coach-requests/route.ts app/athlete/profile/page.tsx app/athlete/find-coach/page.tsx
git commit -m "feat: polish athlete onboarding flow" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Improve athlete week-view orientation and default day selection

**Files:**
- Modify: `tests/architecture-boundaries.test.mjs`
- Modify: `app/athlete/page.tsx`
- Modify: `components/AthleteWeekView.tsx`

- [ ] **Step 1: Write the failing test**

```js
test('athlete week view exposes a current-week shortcut and smarter default day selection', async () => {
  const athletePageSource = await read('app/athlete/page.tsx');
  const weekViewSource = await read('components/AthleteWeekView.tsx');

  assert.match(athletePageSource, /This week/);
  assert.match(athletePageSource, /format\(.*MMM/);
  assert.match(weekViewSource, /findIndex\(\(day\) => day\.sessions\.length > 0\)/);
  assert.match(weekViewSource, /useState\(initialSelectedIndex\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --test-name-pattern="athlete week view exposes a current-week shortcut and smarter default day selection"`
Expected: FAIL because the page does not render a `This week` action and the component still initializes directly from `todayIndex`.

- [ ] **Step 3: Implement the page and component changes**

```tsx
const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
const isViewingCurrentWeek = currentWeekStart === format(fallbackWeekStart, 'yyyy-MM-dd');
```

```tsx
{!isViewingCurrentWeek ? (
  <ActionLink href={`/athlete?weekStart=${currentWeekStart}`} tone="secondary">
    This week
  </ActionLink>
) : null}
```

```tsx
const firstDayWithSessions = days.findIndex((day) => day.sessions.length > 0);
const initialSelectedIndex = todayIndex >= 0 ? todayIndex : firstDayWithSessions >= 0 ? firstDayWithSessions : 0;
const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
```

- [ ] **Step 4: Run test, targeted lint, and targeted build**

Run: `pnpm test -- --test-name-pattern="athlete week view exposes a current-week shortcut and smarter default day selection" && pnpm lint -- app/athlete/page.tsx components/AthleteWeekView.tsx && pnpm build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/architecture-boundaries.test.mjs app/athlete/page.tsx components/AthleteWeekView.tsx
git commit -m "feat: improve athlete week browsing" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4: Add template duplication and template-library filtering

**Files:**
- Modify: `tests/architecture-boundaries.test.mjs`
- Modify: `lib/template-service.ts`
- Create: `app/api/coach/templates/[templateId]/duplicate/route.ts`
- Modify: `app/coach/templates/CoachTemplatesClient.tsx`

- [ ] **Step 1: Write the failing test**

```js
test('template workflow supports duplication and library filtering', async () => {
  const templateServiceSource = await read('lib/template-service.ts');
  const duplicateRouteSource = await read('app/api/coach/templates/[templateId]/duplicate/route.ts');
  const templatesClientSource = await read('app/coach/templates/CoachTemplatesClient.tsx');

  assert.match(templateServiceSource, /duplicateForCoach/);
  assert.match(duplicateRouteSource, /templateService\.duplicateForCoach/);
  assert.match(templatesClientSource, /filterText/);
  assert.match(templatesClientSource, /Duplicate template/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --test-name-pattern="template workflow supports duplication and library filtering"`
Expected: FAIL because no duplicate route or duplicate service method exists yet.

- [ ] **Step 3: Implement duplication and filtering**

```ts
async duplicateForCoach(coachId: number, templateId: number) {
  const template = await db.sessionTemplate.findUnique({
    where: { id: templateId },
    include: { blocks: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!template || template.coachId !== coachId) {
    return { error: 'Template not found.' };
  }

  await db.sessionTemplate.create({
    data: {
      coachId,
      sportType: template.sportType,
      name: `${template.name} (Copy)`,
      summary: template.summary,
      blocks: {
        create: template.blocks.map((block) => ({
          blockType: block.blockType,
          title: block.title,
          instructions: block.instructions,
          sortOrder: block.sortOrder,
        })),
      },
    },
  });

  return { error: null };
}
```

```ts
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { templateId } = await params;
  const result = await templateService.duplicateForCoach(user.id, Number(templateId));
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

```tsx
const [filterText, setFilterText] = useState('');
const [sportFilter, setSportFilter] = useState('ALL');

const visibleTemplates = templates.filter((template) => {
  const matchesText =
    !filterText ||
    template.name.toLowerCase().includes(filterText.toLowerCase()) ||
    (template.summary ?? '').toLowerCase().includes(filterText.toLowerCase());
  const matchesSport = sportFilter === 'ALL' || template.sportType === sportFilter;
  return matchesText && matchesSport;
});
```

- [ ] **Step 4: Run test and targeted lint**

Run: `pnpm test -- --test-name-pattern="template workflow supports duplication and library filtering" && pnpm lint -- lib/template-service.ts app/api/coach/templates/[templateId]/duplicate/route.ts app/coach/templates/CoachTemplatesClient.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/architecture-boundaries.test.mjs lib/template-service.ts app/api/coach/templates/[templateId]/duplicate/route.ts app/coach/templates/CoachTemplatesClient.tsx
git commit -m "feat: improve coach template reuse" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5: Final verification

**Files:**
- Modify: none expected

- [ ] **Step 1: Run the full targeted validation set**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: PASS

- [ ] **Step 2: Review the final diff for scope**

Run: `git --no-pager diff --stat HEAD~4..HEAD`
Expected: changes limited to athlete onboarding, athlete week view, template workflow, and the related test/plan files.

- [ ] **Step 3: Commit any final touch-ups if needed**

```bash
git add -A
git commit -m "chore: finalize athlete flow polish" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
