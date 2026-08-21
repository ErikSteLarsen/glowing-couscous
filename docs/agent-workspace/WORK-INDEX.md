# Work Index

This is the coordination board. Feature IDs are stable; statuses are updated
by agents as work changes. Use the linked feature record before editing.

| ID | Capability | Status | Owner / entry point | Tests / evidence | Record |
|---|---|---|---|---|---|
| `AUTH-001` | Auth, signup, setup, role access | `shipped` | `auth.ts`, `middleware.ts`, `lib/auth-session.ts`, `lib/api-auth.ts` | Shell/source tests; `pnpm build` | [auth](features/auth.md) |
| `SHELL-001` | Tempo shell and navigation | `shipped` | `components/AppShell.tsx`, `AppSidebar.tsx`, `lib/app-navigation.ts` | Shell, accessibility, layout tests | [shell](features/shell.md) |
| `COACH-001` | Coach roster and athlete detail | `shipped` | `lib/coach-service.ts`, `/coach/**` | `tests/coach-service.test.ts` | [coach](features/coach.md) |
| `ONBOARD-001` | Coach discovery and request lifecycle | `shipped` | `lib/coach-request-service.ts`, athlete discovery/profile | Request and onboarding tests; UX polish remains | [onboarding](features/onboarding.md) |
| `PLAN-001` | Athlete-week coach planner | `shipped` | `lib/coach-planner-service.ts`, `lib/planner-draft.ts`, `/coach/planner` | Planner/draft/API tests | [planner](features/planner.md) |
| `LIB-001` | Coach-owned session library | `shipped` | `lib/coach-session-library-service.ts`, planner modes | Dedicated library tests | [planner](features/planner.md) |
| `TPLAN-001` | Reusable coach training plans | `shipped` | `lib/coach-training-plan-service.ts`, planner modes | Dedicated training-plan tests | [planner](features/planner.md) |
| `TEMPLATE-001` | Private templates and assignment | `shipped` | `lib/template-service.ts`, `lib/assignment-service.ts` | Template/assignment tests | [templates](features/templates.md) |
| `ATHLETE-001` | Home, calendar, session, live, activity | `shipped` | `lib/athlete-service.ts`, `/athlete/**` | Calendar/source/build tests | [athlete](features/athlete.md) |
| `COMPLETE-001` | Completion, activity, notes | `shipped` | completion API, `Activity`, session detail client | Indirect route coverage; add focused service tests | [athlete](features/athlete.md) |
| `DOMAIN-001` | Structured blocks, sports, metrics | `shipped` | `lib/tempo-blocks.ts`, `session-math.ts`, `planner-draft.ts` | Session math/planner tests | [workout-domain](features/workout-domain.md) |
| `COMPAT-001` | Older coach session mutation adapter | `transitional` | `/api/coach/sessions/[sessionId]`, `lib/planner-service.ts` | Architecture boundary tests | [compatibility](features/compatibility.md) |
| `COVERAGE-001` | Deepen service/API regression coverage | `planned` | Auth, request, completion, compatibility seams | See current gaps in snapshot | [coverage](features/coverage.md) |
| `CLEANUP-001` | Audit stale pre-Tempo helpers/components | `planned` | `lib/planner.ts`, `workout-spec.ts`, old components | Reference analysis required | [compatibility](features/compatibility.md) |
| `OPS-001` | Agent coordination workspace | `shipped` | `docs/agent-workspace/`, root `AGENTS.md` | Documentation review and repo gates | [workspace](features/workspace.md) |

## Status Updates

When changing a row, include the date and task/history link in the same change.
Do not delete a row because it is complete; stable rows preserve the project
story. Move old detail into `history/` only when the row becomes misleading.

## Active Tasks

Task files are listed here while active. An empty section means no agent has
registered a multi-step task in this workspace.

| Task | Status | Agent | Feature IDs | Last update |
|---|---|---|---|---|
| No active task recorded at baseline | — | — | — | 2026-08-21 |
