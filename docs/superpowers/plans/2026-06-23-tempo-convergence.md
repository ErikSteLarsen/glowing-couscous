# Tempo Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dark week-planner app with the Tempo athlete/coach experience, including the new schema, token system, shared components, and screen flow.

**Architecture:** Keep Auth.js, route guards, and service-layer boundaries, but replace the planner data model with Tempo entities and derive workout metrics from structured session blocks. Build exact Tempo tokens and shared primitives first, then migrate the shell and screens in the same order as the approved design so the app stays coherent after each landing.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Prisma + SQLite, Auth.js v5, date-fns, lucide-react, Node test runner, ESLint

---

## File structure map

### Existing files to modify

- `prisma/schema.prisma` — replace the week-centric model with Tempo entities
- `prisma/seed.js` — reseed demo users, plans, sessions, blocks, activities, assignments
- `app/globals.css` — install Tempo tokens, type, spacing, tabular numerals, scrollbar/base adjustments
- `app/layout.tsx` — load Schibsted Grotesk and ensure global body classes align with Tempo
- `app/(app)/layout.tsx` — swap in the new shell contract and mobile/desktop navigation behavior
- `components/AppShell.tsx` — rebuild the shell to support sidebar on desktop and bottom tabs on mobile
- `components/AppSidebar.tsx` — replace dark nav with Tempo nav item styling
- `components/ui.tsx` — replace dark primitives with tokenized paper/surface primitives
- `lib/app-navigation.ts` — replace old IA with Tempo athlete/coach navigation
- `lib/auth-session.ts` — extend session user typing for Tempo preferences if needed
- `lib/api-auth.ts` — keep guards, update any type changes caused by the schema reset
- `lib/athlete-service.ts` — replace week-planner loading with Tempo athlete loaders
- `lib/coach-service.ts` — replace current overview loader with roster and athlete-detail loaders
- `lib/planner-service.ts` — replace with Tempo session/plan orchestration
- `lib/template-service.ts` — align template persistence with Tempo blocks
- `lib/workout-spec.ts` — replace text-only blocks with Tempo block parsing/validation
- `lib/workout-editor.ts` — align draft shaping with structured Tempo blocks
- `app/(app)/coach/page.tsx` — rebuild as Tempo roster
- `app/(app)/coach/athletes/[athleteId]/page.tsx` — rebuild as Tempo athlete detail
- `app/(app)/coach/athletes/[athleteId]/CoachPlannerClient.tsx` — either remove or convert into athlete detail/builder support
- `app/(app)/coach/templates/page.tsx` — rebuild as Tempo templates
- `app/(app)/coach/templates/CoachTemplatesClient.tsx` — rebuild around block bars and load-into-builder actions
- `app/(app)/athlete/page.tsx` — rebuild as Tempo Home
- `app/(app)/settings/page.tsx` — rebuild as Tempo Settings → Overview
- `app/(app)/profile/page.tsx` and `app/(app)/profile/ProfileClient.tsx` — preserve account controls while fitting the new Tempo shell
- existing API route handlers under `app/api/coach/**` and `app/api/athlete/**` — rewire to the new service contracts

### New files to create

- `lib/session-math.ts` — derives duration, TSS, zone totals, and block-bar segments from Tempo blocks
- `lib/tempo-blocks.ts` — shared block enums, labels, zone metadata, and block flattening helpers
- `lib/overview-preferences.ts` — normalize and validate `prefs.overviewCards`
- `lib/activity-service.ts` — athlete activity loading and compliance shaping
- `lib/assignment-service.ts` — coach assignment creation and roster delivery helpers
- `components/tempo/SessionBlockBar.tsx` — signature block bar
- `components/tempo/StatusBadge.tsx` — planned/completed/adjusted/missed badges
- `components/tempo/Stepper.tsx` — reusable minus/value/plus control
- `components/tempo/SegmentedControl.tsx` — week/month switch
- `components/tempo/Toggle.tsx` — settings toggle
- `components/tempo/CalendarDayCell.tsx` — calendar day with session chips
- `components/tempo/SessionChip.tsx` — stacked session summary chip
- `components/tempo/MetricText.tsx` — tabular number helper
- `components/tempo/NavItem.tsx` — reusable Tempo nav row
- `components/tempo/LiveSessionView.tsx` — mobile-first live execution surface
- `app/(app)/athlete/calendar/page.tsx` — Tempo Calendar
- `app/(app)/athlete/activity/page.tsx` — Tempo Activity
- `app/(app)/athlete/session/[sessionId]/page.tsx` — Tempo Session detail
- `app/(app)/athlete/live/[sessionId]/page.tsx` — Tempo Live execution
- `app/(app)/coach/builder/page.tsx` — Tempo coach builder
- `tests/session-math.test.ts` — block derivation unit tests
- `tests/overview-preferences.test.ts` — overview preference normalization tests
- `tests/assignment-service.test.ts` — coach assignment logic tests

## Plan decomposition note

The spec spans multiple surfaces, but the work is tightly coupled through a shared shell, token system, and schema reset. This plan keeps the whole convergence in one document while sequencing it as independently shippable screen-sized tasks.

### Task 1: Replace the schema with Tempo entities

**Files:**
- Create: `lib/tempo-blocks.ts`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.js`
- Modify: `lib/auth-session.ts`
- Test: `pnpm db:push`
- Test: `pnpm db:seed`

- [ ] **Step 1: Write the new schema shape into `prisma/schema.prisma`**

```prisma
model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  name         String
  role         String
  selfCoached  Boolean  @default(false)
  coachId      Int?
  prefsJson    String?  // stores overviewCards
  passwordHash String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  coach        User?    @relation("CoachAthletes", fields: [coachId], references: [id], onDelete: SetNull)
  athletes     User[]   @relation("CoachAthletes")
  plans        Plan[]
  sessions     Session[]
  templates    Template[] @relation("TemplateOwner")
  activities   Activity[]
  assignments  Assignment[] @relation("AssignedBy")
  accounts     Account[]
}

model Plan {
  id        Int      @id @default(autoincrement())
  athleteId Int
  name      String
  startDate DateTime
  endDate   DateTime
  goalRace  String?
  athlete   User     @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  sessions  Session[]
}
```

- [ ] **Step 2: Add the remaining Tempo models to the same file**

```prisma
model Session {
  id           Int      @id @default(autoincrement())
  athleteId     Int
  planId        Int?
  templateId    Int?
  assignedById  Int?
  date          DateTime
  timeLabel     String?
  sport         String
  title         String
  status        String   @default("planned")
  source        String
  adjusted      Boolean  @default(false)
  summary       String?
  athlete       User     @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  plan          Plan?    @relation(fields: [planId], references: [id], onDelete: SetNull)
  template      Template? @relation(fields: [templateId], references: [id], onDelete: SetNull)
  assignedBy    User?    @relation("AssignedBy", fields: [assignedById], references: [id], onDelete: SetNull)
  blocks        Block[]
  activity      Activity?
  assignments   Assignment[]
}

model Block {
  id         Int      @id @default(autoincrement())
  sessionId   Int?
  templateId  Int?
  kind        String
  zone        Int
  durationSec Int
  reps        Int?
  targetType  String?
  targetLow   Int?
  targetHigh  Int?
  note        String?
  sortOrder   Int
  session     Session?  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  template    Template? @relation(fields: [templateId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 3: Finish the schema with templates, activities, and assignments**

```prisma
model Template {
  id        Int      @id @default(autoincrement())
  ownerId   Int
  name      String
  sport     String
  summary   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  owner     User     @relation("TemplateOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  sessions  Session[]
  blocks    Block[]
}

model Activity {
  id                   Int      @id @default(autoincrement())
  sessionId            Int      @unique
  athleteId            Int
  completedAt          DateTime
  durationSec          Int
  tss                  Int
  compliancePct        Int
  zoneDistributionJson String
  notes                String?
  session              Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  athlete              User     @relation(fields: [athleteId], references: [id], onDelete: Cascade)
}

model Assignment {
  id         Int      @id @default(autoincrement())
  sessionId   Int
  athleteId   Int
  assignedBy  Int
  assignedAt  DateTime @default(now())
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 4: Rewrite `prisma/seed.js` around the new entities**

```js
const overviewCards = JSON.stringify(['coachNote', 'lastActivity', 'weekLoad']);

const coach = await prisma.user.create({
  data: {
    email: 'coach@tempo.test',
    name: 'Erik Krogh',
    role: 'COACH',
    selfCoached: false,
  },
});

const athlete = await prisma.user.create({
  data: {
    email: 'athlete@tempo.test',
    name: 'Mara Holt',
    role: 'ATHLETE',
    selfCoached: false,
    coachId: coach.id,
    prefsJson: overviewCards,
  },
});
```

- [ ] **Step 5: Push and reseed the local database**

Run: `pnpm db:push`
Expected: Prisma reports the SQLite schema is now in sync.

Run: `pnpm db:seed`
Expected: Demo Tempo users, plans, sessions, blocks, and activities are inserted without errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/seed.js lib/auth-session.ts lib/tempo-blocks.ts
git commit -m "feat: reset schema for tempo model"
```

### Task 2: Add derived session math and preference helpers

**Files:**
- Create: `lib/session-math.ts`
- Create: `lib/overview-preferences.ts`
- Test: `tests/session-math.test.ts`
- Test: `tests/overview-preferences.test.ts`

- [ ] **Step 1: Write the failing session-math test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSessionMetrics } from '../lib/session-math';

test('deriveSessionMetrics totals duration, tss, and segments from blocks', () => {
  const result = deriveSessionMetrics([
    { kind: 'warmup', zone: 1, durationSec: 600 },
    { kind: 'work', zone: 4, durationSec: 480 },
    { kind: 'recovery', zone: 2, durationSec: 120 },
    { kind: 'cooldown', zone: 1, durationSec: 300 },
  ]);

  assert.equal(result.durationSec, 1500);
  assert.equal(result.segments.length, 4);
  assert.equal(result.zoneTotals[3], 480);
  assert.ok(result.tss > 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/session-math.test.ts`
Expected: FAIL with `Cannot find module '../lib/session-math'` or missing export errors.

- [ ] **Step 3: Implement `lib/session-math.ts`**

```ts
const zoneFactors = { 1: 0.55, 2: 0.7, 3: 0.85, 4: 0.98, 5: 1.1 } as const;

export function deriveSessionMetrics(blocks: Array<{ zone: number; durationSec: number }>) {
  const durationSec = blocks.reduce((sum, block) => sum + block.durationSec, 0);
  const zoneTotals = [0, 0, 0, 0, 0];

  let tss = 0;
  const segments = blocks.map((block, index) => {
    zoneTotals[block.zone - 1] += block.durationSec;
    const factor = zoneFactors[block.zone as keyof typeof zoneFactors] ?? zoneFactors[1];
    tss += (block.durationSec / 3600) * factor * factor * 100;
    return { key: `${index}-${block.zone}`, zone: block.zone, durationSec: block.durationSec };
  });

  return { durationSec, tss: Math.round(tss), zoneTotals, segments };
}
```

- [ ] **Step 4: Add the failing overview-preferences test and helper**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOverviewCards } from '../lib/overview-preferences';

test('normalizeOverviewCards drops unknown cards and preserves order', () => {
  assert.deepEqual(
    normalizeOverviewCards(['coachNote', 'noise', 'weekLoad']),
    ['coachNote', 'weekLoad'],
  );
});
```

```ts
const allowedCards = ['coachNote', 'lastActivity', 'weekLoad', 'trend'] as const;

export function normalizeOverviewCards(input: unknown) {
  const raw = Array.isArray(input) ? input : [];
  return raw.filter((value): value is (typeof allowedCards)[number] => allowedCards.includes(value as never));
}
```

- [ ] **Step 5: Run both tests**

Run: `node --experimental-strip-types --test tests/session-math.test.ts tests/overview-preferences.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/session-math.ts lib/overview-preferences.ts tests/session-math.test.ts tests/overview-preferences.test.ts
git commit -m "feat: add tempo derivation helpers"
```

### Task 3: Install Tempo tokens and rebuild the app shell

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `components/AppShell.tsx`
- Modify: `components/AppSidebar.tsx`
- Modify: `components/ui.tsx`
- Modify: `lib/app-navigation.ts`
- Create: `components/tempo/NavItem.tsx`
- Create: `components/tempo/MetricText.tsx`
- Test: `pnpm lint`
- Test: `pnpm build`

- [ ] **Step 1: Replace the global token layer in `app/globals.css`**

```css
@theme {
  --color-paper: #F3F2EE;
  --color-surface: #FFFFFF;
  --color-sunken: #ECEAE4;
  --color-border: #E6E2DB;
  --color-ink-3: #9C968B;
  --color-ink-2: #6A655C;
  --color-ink: #232220;
  --color-sage: #6E7E63;
  --color-sage-tint: #E9ECE3;
}

html { color-scheme: light; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-schibsted), system-ui, sans-serif;
}
```

- [ ] **Step 2: Load Schibsted Grotesk in `app/layout.tsx`**

```ts
import { Schibsted_Grotesk } from 'next/font/google';

const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
});
```

- [ ] **Step 3: Replace the shell and nav contracts**

```ts
export function getPrimaryNavigation(role: AppRole) {
  return role === 'COACH'
    ? [
        { label: 'Athletes', href: '/coach', matchPrefix: '/coach' },
        { label: 'Plan builder', href: '/coach/builder', matchPrefix: '/coach/builder' },
        { label: 'Templates', href: '/coach/templates', matchPrefix: '/coach/templates' },
      ]
    : [
        { label: 'Home', href: '/athlete', matchPrefix: '/athlete' },
        { label: 'Calendar', href: '/athlete/calendar', matchPrefix: '/athlete/calendar' },
        { label: 'Activity', href: '/athlete/activity', matchPrefix: '/athlete/activity' },
        { label: 'Settings', href: '/settings', matchPrefix: '/settings' },
      ];
}
```

- [ ] **Step 4: Rebuild `components/AppShell.tsx` around desktop sidebar + mobile tab bar**

```tsx
return (
  <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] md:grid md:grid-cols-[244px_minmax(0,1fr)]">
    <AppSidebar ... />
    <div className="min-w-0 pb-20 md:pb-0">{children}</div>
    <nav className="fixed inset-x-0 bottom-0 border-t border-[var(--color-border)] bg-[#FBFAF7] md:hidden">
      {/* mobile tabs */}
    </nav>
  </div>
);
```

- [ ] **Step 5: Run lint and build**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm build`
Expected: PASS with the new light shell and navigation.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx app/\(app\)/layout.tsx components/AppShell.tsx components/AppSidebar.tsx components/ui.tsx lib/app-navigation.ts components/tempo/NavItem.tsx components/tempo/MetricText.tsx
git commit -m "feat: add tempo tokens and shell"
```

### Task 4: Build shared Tempo workout components

**Files:**
- Create: `components/tempo/SessionBlockBar.tsx`
- Create: `components/tempo/StatusBadge.tsx`
- Create: `components/tempo/Stepper.tsx`
- Create: `components/tempo/SegmentedControl.tsx`
- Create: `components/tempo/Toggle.tsx`
- Create: `components/tempo/SessionChip.tsx`
- Create: `components/tempo/CalendarDayCell.tsx`
- Modify: `components/session-card.tsx`
- Modify: `components/week-strip.tsx`
- Test: `pnpm lint`
- Test: `pnpm build`

- [ ] **Step 1: Implement the signature block bar**

```tsx
export function SessionBlockBar({ blocks, compact = false }: { blocks: TempoBlockDraft[]; compact?: boolean }) {
  return (
    <div className={cn('flex overflow-hidden rounded-[9px] gap-[2px] bg-[var(--color-sunken)]', compact ? 'h-[22px]' : 'h-[26px]')}>
      {blocks.map((block, index) => (
        <div
          key={`${block.kind}-${index}`}
          className={zoneSolidClass(block.zone)}
          style={{ flexGrow: Math.max(block.durationSec, 1) }}
          aria-label={`Z${block.zone} ${getZoneName(block.zone)} ${block.durationSec} seconds`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement the status badge and stepper**

```tsx
export function StatusBadge({ status }: { status: 'planned' | 'completed' | 'adjusted' | 'missed' }) {
  const palette = {
    planned: 'bg-[var(--color-sage-tint)] text-[#57654E]',
    completed: 'bg-[#E3F7EC] text-[#1B7A3D]',
    adjusted: 'bg-[#FEEDE0] text-[#B45516]',
    missed: 'bg-[#E8F0FE] text-[#2B6CB0]',
  } as const;
  return <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-[12.5px] font-semibold ${palette[status]}`}>{status}</span>;
}
```

```tsx
export function Stepper({ value, onDecrease, onIncrease }: StepperProps) {
  return (
    <div className="flex h-10 items-center overflow-hidden rounded-[10px] border border-[#D6D1C7]">
      <button type="button" className="h-10 w-[38px]" onClick={onDecrease}>−</button>
      <span className="min-w-[52px] text-center tabular-nums">{value}</span>
      <button type="button" className="h-10 w-[38px]" onClick={onIncrease}>+</button>
    </div>
  );
}
```

- [ ] **Step 3: Rebuild calendar/session summary primitives**

```tsx
export function SessionChip({ session }: { session: TempoSessionSummary }) {
  return (
    <div className={`rounded-[7px] border-l-[3px] p-2 ${zoneTintClass(session.primaryZone)}`}>
      <div className="text-[11px] font-semibold">{session.title}</div>
      <div className="text-[9.5px] text-[var(--color-ink-3)]">{session.durationLabel} · {session.sportLabel}</div>
    </div>
  );
}
```

- [ ] **Step 4: Replace old block listings in `components/session-card.tsx` with the shared bar**

```tsx
<SessionBlockBar blocks={session.blocks} />
<div className="mt-3 flex items-center justify-between">
  <MetricText value={session.durationLabel} />
  <MetricText value={`${session.tss} TSS`} />
  <span className="text-sm text-[var(--color-ink-2)]">{session.targetLabel}</span>
</div>
```

- [ ] **Step 5: Run lint and build**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm build`
Expected: PASS with the shared Tempo primitives in place.

- [ ] **Step 6: Commit**

```bash
git add components/tempo components/session-card.tsx components/week-strip.tsx
git commit -m "feat: add tempo shared workout components"
```

### Task 5: Rebuild athlete Home and Settings preferences

**Files:**
- Modify: `app/(app)/athlete/page.tsx`
- Modify: `app/(app)/settings/page.tsx`
- Modify: `lib/athlete-service.ts`
- Modify: `lib/planner-service.ts`
- Modify: `app/api/account/profile/route.ts`
- Test: `pnpm lint`
- Test: `pnpm build`

- [ ] **Step 1: Shape the athlete Home loader**

```ts
return {
  greetingName: athlete.name,
  todaySessions,
  nextDays,
  optionalCards: {
    coachNote,
    lastActivity,
    weekLoad,
    trend,
  },
  overviewCards,
};
```

- [ ] **Step 2: Replace `app/(app)/athlete/page.tsx` with the Tempo Home composition**

```tsx
<PageShell size="wide" className="gap-6">
  <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_312px]">
    <div className="space-y-6">{/* greeting, today cards, next days */}</div>
    <aside className="space-y-4">{/* optional cards based on prefs */}</aside>
  </section>
</PageShell>
```

- [ ] **Step 3: Replace `app/(app)/settings/page.tsx` with Tempo Overview toggles**

```tsx
<Toggle
  checked={overviewCards.includes('coachNote')}
  onCheckedChange={() => updateCard('coachNote')}
  label="Coach note"
  description="Latest message from your coach."
/>;
```

- [ ] **Step 4: Persist `overviewCards` through the existing account/profile API**

```ts
await prisma.user.update({
  where: { id: userId },
  data: { prefsJson: JSON.stringify({ overviewCards: nextCards }) },
});
```

- [ ] **Step 5: Run lint and build**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm build`
Expected: PASS with Tempo Home and Settings in place.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/athlete/page.tsx app/\(app\)/settings/page.tsx lib/athlete-service.ts lib/planner-service.ts app/api/account/profile/route.ts
git commit -m "feat: rebuild athlete home and settings"
```

### Task 6: Rebuild athlete Calendar, Session detail, Activity, and Live execution

**Files:**
- Create: `app/(app)/athlete/calendar/page.tsx`
- Create: `app/(app)/athlete/activity/page.tsx`
- Create: `app/(app)/athlete/session/[sessionId]/page.tsx`
- Create: `app/(app)/athlete/live/[sessionId]/page.tsx`
- Create: `components/tempo/LiveSessionView.tsx`
- Modify: `lib/athlete-service.ts`
- Modify: `lib/activity-service.ts`
- Modify: `app/api/athlete/sessions/[sessionId]/completion/route.ts`
- Test: `pnpm lint`
- Test: `pnpm build`

- [ ] **Step 1: Build the Calendar route with shared segmented and day-cell components**

```tsx
<SegmentedControl
  value={view}
  options={[
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ]}
  onChange={setView}
/>;
```

- [ ] **Step 2: Build Session detail with live-adjustment controls**

```tsx
const metrics = deriveSessionMetrics(draft.blocks);

<SessionBlockBar blocks={draft.blocks} />
<Stepper value={`${draft.reps}`} onDecrease={decReps} onIncrease={incReps} />
<StatusBadge status={draftChanged ? 'adjusted' : 'planned'} />
```

- [ ] **Step 3: Build the Activity route from `Activity` records**

```tsx
{activities.map((activity) => (
  <Surface key={activity.id}>
    <StatusBadge status="completed" />
    <MetricText value={`${activity.tss} TSS`} />
    <MetricText value={`${activity.compliancePct}%`} />
  </Surface>
))}
```

- [ ] **Step 4: Build the mobile-first live execution screen**

```tsx
<LiveSessionView
  steps={flattenedBlocks}
  currentIndex={currentIndex}
  onNext={advanceStep}
  onPrevious={rewindStep}
/>;
```

- [ ] **Step 5: Wire completion updates into the `Activity` model**

```ts
await prisma.activity.upsert({
  where: { sessionId },
  update: { completedAt: new Date(), durationSec, tss, compliancePct, zoneDistributionJson },
  create: { sessionId, athleteId, completedAt: new Date(), durationSec, tss, compliancePct, zoneDistributionJson },
});
```

- [ ] **Step 6: Run lint and build**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm build`
Expected: PASS with the athlete flows complete.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/athlete/calendar/page.tsx app/\(app\)/athlete/activity/page.tsx app/\(app\)/athlete/session/\[sessionId\]/page.tsx app/\(app\)/athlete/live/\[sessionId\]/page.tsx components/tempo/LiveSessionView.tsx lib/athlete-service.ts lib/activity-service.ts app/api/athlete/sessions/\[sessionId\]/completion/route.ts
git commit -m "feat: rebuild athlete calendar session and activity flows"
```

### Task 7: Rebuild coach roster and athlete detail

**Files:**
- Modify: `app/(app)/coach/page.tsx`
- Modify: `app/(app)/coach/athletes/[athleteId]/page.tsx`
- Modify: `lib/coach-service.ts`
- Test: `pnpm lint`
- Test: `pnpm build`

- [ ] **Step 1: Shape the roster loader around Tempo rows**

```ts
return coachedAthletes.map((athlete) => ({
  id: athlete.id,
  name: athlete.name,
  goal: athlete.currentPlan?.goalRace ?? 'No goal race',
  compliancePct: athlete.thisWeek.compliancePct,
  flag: athlete.thisWeek.flag,
  nextSession: athlete.nextSession?.title ?? 'No session scheduled',
}));
```

- [ ] **Step 2: Replace `app/(app)/coach/page.tsx` with the Tempo roster table**

```tsx
<div className="grid grid-cols-[1.7fr_1fr_1.1fr_1fr_24px] gap-4">
  {/* athlete, this week, status, next session, chevron */}
</div>
```

- [ ] **Step 3: Replace athlete detail with Tempo stats + week calendar + planned-vs-done**

```tsx
<Surface>{/* compliance, volume, tss, race countdown */}</Surface>
<Surface>{/* this-week calendar */}</Surface>
<Surface>{/* recent planned vs done list */}</Surface>
```

- [ ] **Step 4: Run lint and build**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm build`
Expected: PASS with coach roster and athlete detail migrated.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/coach/page.tsx app/\(app\)/coach/athletes/\[athleteId\]/page.tsx lib/coach-service.ts
git commit -m "feat: rebuild coach roster and athlete detail"
```

### Task 8: Rebuild coach builder, templates, and assignment flow

**Files:**
- Create: `app/(app)/coach/builder/page.tsx`
- Create: `lib/assignment-service.ts`
- Test: `tests/assignment-service.test.ts`
- Modify: `app/(app)/coach/templates/page.tsx`
- Modify: `app/(app)/coach/templates/CoachTemplatesClient.tsx`
- Modify: `lib/template-service.ts`
- Modify: `app/api/coach/templates/route.ts`
- Modify: `app/api/coach/templates/[templateId]/route.ts`
- Create or Modify: `app/api/coach/assignments/route.ts`
- Test: `pnpm lint`
- Test: `pnpm build`

- [ ] **Step 1: Write the failing assignment-service test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssignmentPayload } from '../lib/assignment-service';

test('buildAssignmentPayload creates one assignment row per athlete', () => {
  const rows = buildAssignmentPayload({ sessionId: 12, athleteIds: [3, 4], assignedBy: 2 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].sessionId, 12);
  assert.equal(rows[1].athleteId, 4);
});
```

- [ ] **Step 2: Run the assignment test to verify it fails**

Run: `node --experimental-strip-types --test tests/assignment-service.test.ts`
Expected: FAIL with missing module/export errors.

- [ ] **Step 3: Implement `lib/assignment-service.ts`**

```ts
export function buildAssignmentPayload(input: { sessionId: number; athleteIds: number[]; assignedBy: number }) {
  return input.athleteIds.map((athleteId) => ({
    sessionId: input.sessionId,
    athleteId,
    assignedBy: input.assignedBy,
  }));
}
```

- [ ] **Step 4: Build the coach builder route with block bar, steppers, and assign panel**

```tsx
<SessionBlockBar blocks={draft.blocks} />
<Stepper value={`${draft.workMinutes}′`} onDecrease={decWork} onIncrease={incWork} />
<button type="button" className="rounded-[10px] bg-[var(--color-ink)] text-white">
  {`Assign to ${selectedAthleteIds.length} athletes`}
</button>
```

- [ ] **Step 5: Rebuild template cards around the shared block bar**

```tsx
<SessionBlockBar blocks={template.blocks} />
<button type="button" onClick={() => loadIntoBuilder(template.id)}>Load into builder</button>
```

- [ ] **Step 6: Run the assignment test, lint, and build**

Run: `node --experimental-strip-types --test tests/assignment-service.test.ts`
Expected: PASS

Run: `pnpm lint`
Expected: PASS

Run: `pnpm build`
Expected: PASS with coach builder, assignment, and templates aligned.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/coach/builder/page.tsx lib/assignment-service.ts tests/assignment-service.test.ts app/\(app\)/coach/templates/page.tsx app/\(app\)/coach/templates/CoachTemplatesClient.tsx lib/template-service.ts app/api/coach/templates/route.ts app/api/coach/templates/\[templateId\]/route.ts app/api/coach/assignments/route.ts
git commit -m "feat: rebuild coach builder and templates"
```

### Task 9: Cleanup, remove dead week-planner code, and run the full validation pass

**Files:**
- Modify or Delete: stale week-planner-only components and helpers no longer referenced
- Modify: docs directly touched by route/behavior changes if needed
- Test: `pnpm db:push`
- Test: `pnpm db:seed`
- Test: `pnpm lint`
- Test: `pnpm build`

- [ ] **Step 1: Remove unreachable week-planner-only code**

```ts
// delete helpers that only shape PlanWeek / PlannedSession records
// keep shared auth/session helpers
```

- [ ] **Step 2: Update any remaining imports to the Tempo components/services**

```ts
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { deriveSessionMetrics } from '@/lib/session-math';
```

- [ ] **Step 3: Run the final validation pass**

Run: `pnpm db:push && pnpm db:seed && pnpm lint && pnpm build`
Expected: all commands pass, the seeded database matches the Tempo schema, and the app compiles cleanly.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/seed.js app components lib docs
git commit -m "feat: finish tempo convergence"
```

## Self-review notes

- Spec coverage: schema reset, tokens, shell, athlete screens, live execution, coach roster/detail/builder/templates, assignment flow, and per-screen states are all represented above.
- Placeholder scan: the only intentionally broad deletion step is limited to removing dead week-planner code after replacement; all implementation tasks point at exact files and concrete commands.
- Type consistency: `overviewCards`, `deriveSessionMetrics`, `Assignment`, `SessionBlockBar`, and the new route paths use the same names throughout the plan.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-tempo-convergence.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
