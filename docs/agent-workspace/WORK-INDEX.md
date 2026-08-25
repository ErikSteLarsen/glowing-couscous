# Work Index

This is the coordination board. Feature IDs are stable; statuses are updated
by agents as work changes. Use the linked feature record before editing.

| ID | Capability | Status | Owner / entry point | Tests / evidence | Record |
|---|---|---|---|---|---|
| `AUTH-001` | Auth, signup, setup, role access | `shipped` | `auth.ts`, `middleware.ts`, `lib/auth-session.ts`, `lib/api-auth.ts` | Shell/source tests; `pnpm build` | [auth](features/auth.md) |
| `SHELL-001` | Tempo shell and navigation | `shipped` | `components/AppShell.tsx`, `AppSidebar.tsx`, `lib/app-navigation.ts` | UI contrast audit, 115 tests, lint, build; [history](history/2026-08-22-interactive-color-contrast.md) | [shell](features/shell.md) |
| `COACH-001` | Coach roster and athlete detail | `shipped` | `lib/coach-service.ts`, `/coach/**` | UI contrast audit, 115 tests, lint, build; [history](history/2026-08-22-interactive-color-contrast.md) | [coach](features/coach.md) |
| `ONBOARD-001` | Coach discovery and request lifecycle | `shipped` | `lib/coach-request-service.ts`, athlete discovery/profile | Request and onboarding tests; UX polish remains | [onboarding](features/onboarding.md) |
| `PLAN-001` | Athlete-week coach planner | `shipped` | `lib/coach-planner-service.ts`, `lib/planner-draft.ts`, `/coach/planner` | Planner/draft/API tests | [planner](features/planner.md) |
| `LIB-001` | Coach-owned session library | `shipped` | `lib/coach-session-library-service.ts`, planner modes | Dedicated library tests | [planner](features/planner.md) |
| `TPLAN-001` | Reusable coach training plans | `shipped` | `lib/coach-training-plan-service.ts`, planner modes | Dedicated training-plan tests | [planner](features/planner.md) |
| `TEMPLATE-001` | Private template library and assignment services | `shipped` | `lib/template-service.ts`, `lib/assignment-service.ts`, templates/planner UI | Template, assignment, and workflow tests; browser E2E remains | [templates](features/templates.md) |
| `ATHLETE-001` | Home, calendar, session, live, activity | `shipped` | `lib/athlete-service.ts`, `/athlete/**` | UI contrast audit, calendar month/week layout polish, 115 tests, lint, build; [history](history/2026-08-22-calendar-week-overview.md) | [athlete](features/athlete.md) |
| `LIVE-001` | Interactive athlete live execution | `shipped` | `lib/athlete-execution.ts`, live client, `Stepper` | [task](tasks/2026-08-21-athlete-live-execution-progress.md); 113 tests, lint, build | [athlete](features/athlete.md) |
| `COMPLETE-001` | Completion, activity, notes | `shipped` | completion API, `Activity`, session detail client | Indirect route coverage; add focused service tests | [athlete](features/athlete.md) |
| `COMPLETION-002` | Completion metric/history integrity | `shipped` | `lib/athlete-completion-service.ts`, `Activity`, session lifecycle | [task](tasks/2026-08-21-completion-integrity-progress.md); 103 tests, schema reset/seed, lint, build | [athlete](features/athlete.md) |
| `DOMAIN-001` | Structured blocks, sports, metrics | `shipped` | `lib/tempo-blocks.ts`, `session-math.ts`, `planner-draft.ts` | Session math/planner tests | [workout-domain](features/workout-domain.md) |
| `COMPAT-001` | Older coach session mutation adapter | `transitional` | `/api/coach/sessions/[sessionId]`, `lib/planner-service.ts` | Architecture boundary tests | [compatibility](features/compatibility.md) |
| `ASSIGN-001` | Copy reusable sources to athlete schedules | `shipped` | `lib/assignment-service.ts`, source lineage schema | [task](tasks/2026-08-21-source-copy-assignment-progress.md); 106 tests, schema reset/seed, lint, build | [planner](features/planner.md) |
| `WORKFLOW-001` | Complete planner/template UI workflows | `shipped` | active planner, templates UI, builder redirect | [task](tasks/2026-08-21-planner-template-workflows-progress.md); 113 tests, lint, build | [planner](features/planner.md) |
| `AUTH-002` | Auth.js adapter contract and one-time setup | `shipped` | Prisma `User`, auth/session, setup route | [task](tasks/2026-08-21-auth-role-setup-progress.md); 88 tests, build, lint, Prisma validation | [auth](features/auth.md) |
| `REQUEST-002` | Coach-request concurrency and eligibility | `shipped` | coach-request module and schema | [task](tasks/2026-08-21-coach-request-invariants-progress.md); 99 tests, schema reset/seed, lint, build | [onboarding](features/onboarding.md) |
| `API-001` | API principal and route input validation | `shipped` | `lib/api-auth.ts`, `lib/route-params.ts`, protected API handlers | [task](tasks/2026-08-21-api-auth-validation-progress.md); 92 tests, lint, build | [coverage](features/coverage.md) |
| `COMPAT-002` | Compatibility hardening and docs alignment | `shipped` | old planner adapter, builder redirect, architecture docs | [task](tasks/2026-08-21-compatibility-docs-progress.md); 113 tests, lint, build | [compatibility](features/compatibility.md) |
| `COVERAGE-001` | Deepen service/API regression coverage | `planned` | Auth, request, completion, compatibility seams | See current gaps in snapshot | [coverage](features/coverage.md) |
| `SESSION-ADJUST-001` | Per-session coach/athlete adjustments and actual outcomes | `in-progress` | canonical editor, snapshot/adjustment/outcome services, comparison dialog | `SESSION-PLAN-ADJUST-001` shipped 2026-08-25; [snapshot task](tasks/2026-08-25-session-snapshots.md), [planned adjustment task](tasks/2026-08-25-planned-session-adjustments.md), [history](history/2026-08-25-planned-session-adjustments.md) | [session adjustments](features/session-adjustments.md) |
| `CLEANUP-001` | Audit stale pre-Tempo helpers/components | `shipped` | `components/AthleteWeekView.tsx` chain removed; remaining helpers stay transitional | Reference analysis, cleanup decision, 114 tests, lint, build; [history](history/2026-08-22-interactive-color-contrast.md) | [compatibility](features/compatibility.md) |
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
| `SESSION-ACTUAL-001` | `in-progress` | OpenCode | `SESSION-ADJUST-001`, `COMPLETE-001`, `ATHLETE-001` | 2026-08-25; [task](tasks/2026-08-25-actual-outcome-editing.md) |

## Planned Task Files

These are implementation-ready briefs. They are `planned` until an agent claims
one by creating a task progress entry and changing its status to `in-progress`.

| Task | Status | Blocks / depends on | Brief |
|---|---|---|---|
| `LIVE-001` | `shipped` | None | [athlete live execution](tasks/2026-08-21-athlete-live-execution.md), [completion record](tasks/2026-08-21-athlete-live-execution-progress.md), [history](history/2026-08-21-athlete-live-execution.md) |
| `COMPLETION-002` | `shipped` | Completed-session edit policy | [completion integrity](tasks/2026-08-21-completion-integrity.md), [completion record](tasks/2026-08-21-completion-integrity-progress.md), [history](history/2026-08-21-completion-integrity.md) |
| `ASSIGN-001` | `shipped` | None | [source-copy assignment](tasks/2026-08-21-source-copy-assignment.md), [completion record](tasks/2026-08-21-source-copy-assignment-progress.md), [history](history/2026-08-21-source-copy-assignment.md) |
| `WORKFLOW-001` | `shipped` | `ASSIGN-001` command contract | [planner/template workflows](tasks/2026-08-21-planner-template-workflows.md), [completion record](tasks/2026-08-21-planner-template-workflows-progress.md), [history](history/2026-08-21-planner-template-workflows.md) |
| `AUTH-002` | `shipped` | Role setup and adapter decisions | [auth and role setup](tasks/2026-08-21-auth-role-setup.md), [completion record](tasks/2026-08-21-auth-role-setup-progress.md), [history](history/2026-08-21-auth-role-setup.md) |
| `REQUEST-002` | `shipped` | Pending-request uniqueness decision | [coach-request invariants](tasks/2026-08-21-coach-request-invariants.md), [completion record](tasks/2026-08-21-coach-request-invariants-progress.md), [history](history/2026-08-21-coach-request-invariants.md) |
| `API-001` | `shipped` | Auth principal policy | [API auth and validation](tasks/2026-08-21-api-auth-validation.md), [completion record](tasks/2026-08-21-api-auth-validation-progress.md), [history](history/2026-08-21-api-auth-validation.md) |
| `COMPAT-002` | `shipped` | Completion/API semantics where shared | [compatibility and docs](tasks/2026-08-21-compatibility-docs.md), [completion record](tasks/2026-08-21-compatibility-docs-progress.md), [history](history/2026-08-21-compatibility-docs.md) |
| `SESSION-EDIT-001` | `shipped` | None | [canonical session editor](tasks/2026-08-25-canonical-session-editor.md), [history](history/2026-08-25-canonical-session-editor.md) |
| `SESSION-EDITOR-MIGRATION-001` | `shipped` | `SESSION-EDIT-001` | [planner/template editor migration](tasks/2026-08-25-editor-migration.md), [history](history/2026-08-25-editor-migration.md) |
| `SESSION-SNAPSHOT-001` | `shipped` | `SESSION-EDIT-001` | [coach baseline and actual snapshots](tasks/2026-08-25-session-snapshots.md), [history](history/2026-08-25-session-snapshots.md) |
| `SESSION-PLAN-ADJUST-001` | `shipped` | `SESSION-EDIT-001`, `SESSION-SNAPSHOT-001` | [planned session adjustments](tasks/2026-08-25-planned-session-adjustments.md), [history](history/2026-08-25-planned-session-adjustments.md) |
| `SESSION-ACTUAL-001` | `in-progress` | `SESSION-EDIT-001`, `SESSION-SNAPSHOT-001`, `SESSION-PLAN-ADJUST-001` | [actual outcome editing](tasks/2026-08-25-actual-outcome-editing.md) |
| `SESSION-COMPARE-001` | `planned` | `SESSION-ACTUAL-001` | [baseline and actual comparison](tasks/2026-08-25-baseline-actual-comparison.md) |
