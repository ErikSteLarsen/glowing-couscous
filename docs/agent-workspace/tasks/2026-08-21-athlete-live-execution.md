# Task: Make Athlete Live Execution Interactive

- **Status:** `completed`
- **Agent:** `opencode-live-2026-08-21`
- **Created:** `2026-08-21`
- **Task ID:** `LIVE-001`
- **Feature IDs:** `ATHLETE-001`, `DOMAIN-001`, `COVERAGE-001`
- **Related records:** [athlete feature](../features/athlete.md), [current status](../CURRENT-STATUS.md), [audit](2026-08-21-incompleteness-audit.md)
- **Dependencies:** None. This task may be implemented before completion persistence hardening.
- **Completed:** 2026-08-21
- **Completion record:** [progress and verification](2026-08-21-athlete-live-execution-progress.md)

## Problem

`/athlete/live/[sessionId]` is described as execution but always renders block
one as active and every block as incomplete. `components/tempo/Stepper.tsx` is
presentational and has no execution owner, controls, or state transitions.

Relevant files:

- `app/(app)/athlete/live/[sessionId]/page.tsx`
- `components/tempo/Stepper.tsx`
- `lib/athlete-service.ts`
- `tests/app-shell-navigation.test.mjs`

## Design

Create the seam in a pure module:

```text
lib/athlete-execution.ts
```

The module owns ephemeral guidance state only. It must not import React,
Prisma, Next.js, or telemetry code. Use a small interface such as:

```ts
type ExecutionState = {
  currentIndex: number;
  completed: boolean[];
};

createExecutionState(blockCount)
advanceExecution(state)
previousExecution(state)
restartExecution(state)
completeCurrentExecution(state)
isExecutionComplete(state)
```

Create `LiveSessionClient.tsx` beside the route. It owns the state with React,
maps the state into the presentational `Stepper`, and renders accessible
Previous, Next, Restart, and final completion actions. Keep execution progress
local to the device for now. Do not add a database execution-progress model or
claim sensor/telemetry support.

The final completion action should call the existing completion endpoint, but
the completion-integrity task owns the long-term semantics of that endpoint.

## Implementation Steps

1. Write failing unit tests for the pure execution module: empty/one/multiple
   blocks, first/next/previous boundaries, completion, restart, and final state.
2. Implement `lib/athlete-execution.ts` with immutable state transitions.
3. Add `LiveSessionClient.tsx` and move the interactive portion out of the
   server page. Keep server-side authentication and session loading in the page.
4. Update `Stepper.tsx` only enough to render real active/done state and
   accessible labels; keep it reusable and presentational.
5. Add source or component-level tests proving the route renders the client
   and the client wires state transitions and completion.
6. Update the athlete feature record and history with the behavior and evidence.

## Acceptance Criteria

- Live starts with block one active and no blocks complete.
- Next advances exactly one block and cannot move past the final block.
- Previous moves back exactly one block and cannot move before the first block.
- Completed blocks remain visibly completed while moving through the workout.
- Restart returns to the initial state.
- The final action can invoke completion without pretending to collect telemetry.
- Controls have accessible names and keyboard operation.
- Refreshing the page intentionally restarts local guidance state; this is
  documented rather than silently implying cross-device resume.
- No Prisma, database schema, or telemetry changes are introduced by this task.

## Verification

```bash
pnpm test -- --test-name-pattern="execution|live|stepper"
pnpm lint
pnpm build
```
