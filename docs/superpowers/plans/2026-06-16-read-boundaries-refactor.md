# Read Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining live production reads from `lib/demo-data.ts` so coach reads, week-grouping helpers, and sport metadata live behind clearer boundaries.

**Architecture:** Create small focused modules instead of one mixed `demo-data` file. Put coach dashboard reads in a coach service, week-shaping helpers in a week utility module, and sport labels in a dedicated sport-domain module. Update pages and shared components to import from those new homes, then delete `lib/demo-data.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + SQLite, Auth.js v5, pnpm.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `lib/coach-service.ts` | Load the coach dashboard read model. |
| Create | `lib/week.ts` | Build Monday-based week-day arrays and group sessions by day. |
| Create | `lib/sport.ts` | Shared sport constants and sport labels for UI. |
| Modify | `lib/planner.ts` | Import shared sport constants instead of owning them locally. |
| Modify | `app/coach/page.tsx` | Read dashboard data from `coach-service`. |
| Modify | `app/athlete/page.tsx` | Group sessions with `week.ts` instead of `demo-data`. |
| Modify | `app/coach/templates/page.tsx` | Read templates directly from `templateService`. |
| Modify | `app/coach/templates/CoachTemplatesClient.tsx` | Read sport labels from `sport.ts`. |
| Modify | `components/session-card.tsx` | Read sport labels from `sport.ts`. |
| Delete | `lib/demo-data.ts` | Remove the mixed demo/live helper module after all callers are moved. |

---

### Task 1: Extract sport-domain constants

**Files:**
- Create: `lib/sport.ts`
- Modify: `lib/planner.ts`
- Modify: `app/coach/templates/CoachTemplatesClient.tsx`
- Modify: `components/session-card.tsx`

- [ ] **Step 1: Add the shared sport module**

```ts
export const SPORT_OPTIONS = ['RUNNING', 'BIKING', 'SWIMMING', 'STRENGTH', 'STRETCHING', 'REST'] as const;

export const sportLabels = {
  RUNNING: 'Running',
  BIKING: 'Biking',
  SWIMMING: 'Swimming',
  STRENGTH: 'Strength',
  STRETCHING: 'Stretching',
  REST: 'Rest',
} as const;
```

- [ ] **Step 2: Reuse `SPORT_OPTIONS` from `lib/planner.ts`**

```ts
import { SPORT_OPTIONS } from '@/lib/sport';
```

- [ ] **Step 3: Point UI callers at `lib/sport.ts`**

```ts
import { sportLabels } from '@/lib/sport';
```

### Task 2: Extract week grouping helpers

**Files:**
- Create: `lib/week.ts`
- Modify: `app/athlete/page.tsx`

- [ ] **Step 1: Add the Monday-based week helpers**

```ts
export function getWeekDays(baseDate: Date) {
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      date,
      shortLabel: format(date, 'EEE'),
      dayNumber: format(date, 'd'),
      fullLabel: format(date, 'EEEE d MMM'),
    };
  });
}

export function groupSessionsByDay<T extends { scheduledDate: Date }>(sessions: T[], weekBaseDate: Date) {
  return getWeekDays(weekBaseDate).map((day) => ({
    ...day,
    sessions: sessions.filter((session) => isSameDay(session.scheduledDate, day.date)),
  }));
}
```

- [ ] **Step 2: Move the athlete page import**

```ts
import { groupSessionsByDay } from '@/lib/week';
```

### Task 3: Extract the coach dashboard read model

**Files:**
- Create: `lib/coach-service.ts`
- Modify: `app/coach/page.tsx`
- Modify: `app/coach/templates/page.tsx`

- [ ] **Step 1: Add the coach dashboard service**

```ts
export async function getCoachOverview(coachId: number) {
  const coach = await prisma.user.findUnique({
    where: { id: coachId },
    include: {
      coachedAthletes: {
        include: {
          user: true,
          planWeeks: {
            where: {
              weekStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
            },
            include: {
              sessions: true,
            },
          },
        },
      },
    },
  });

  if (coach) {
    coach.coachedAthletes.sort((left, right) => left.user.name.localeCompare(right.user.name));
  }

  return coach;
}
```

- [ ] **Step 2: Move the coach dashboard import**

```ts
import { getCoachOverview } from '@/lib/coach-service';
```

- [ ] **Step 3: Read templates from the existing template service**

```ts
import { templateService } from '@/lib/template-service';

const templates = await templateService.listForCoach(user.id);
```

### Task 4: Remove the mixed helper module

**Files:**
- Delete: `lib/demo-data.ts`

- [ ] **Step 1: Confirm no callers remain**

Run: `rg "demo-data" -n`
Expected: no matches

- [ ] **Step 2: Delete the file**

```text
Delete `lib/demo-data.ts`
```

### Task 5: Validate the refactor

**Files:**
- Modify: none expected

- [ ] **Step 1: Run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: PASS

## Self-review

- **Spec coverage:** The plan covers each live responsibility still in `lib/demo-data.ts` and assigns it to a clearer module.
- **Placeholder scan:** No TBD/TODO placeholders remain.
- **Type consistency:** All referenced files and imports match the current repository structure.
