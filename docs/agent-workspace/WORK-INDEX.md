# Work Index

This is the small current map of product capabilities. It is not a backlog and
does not preserve completed implementation history.

## Status Vocabulary

- `shipped` - implemented and covered by current verification evidence.
- `in-progress` - live work still changing or missing an important acceptance gate.
- `transitional` - still required for compatibility but not the extension point for new work.

## Capabilities

| ID | Area | Status | Primary owners | Main entry points |
|---|---|---|---|---|
| `AUTH-001` | Authentication and role setup | `shipped` | `auth.ts`, `middleware.ts`, `lib/auth-session.ts`, `lib/api-auth.ts` | `/login`, `/signup`, `/setup`, `/api/auth/*` |
| `SHELL-001` | App shell and navigation | `shipped` | `components/AppShell.tsx`, `components/AppSidebar.tsx`, `lib/app-navigation.ts` | Authenticated `(app)` layout |
| `COACH-001` | Coach roster and requests | `shipped` | `lib/coach-service.ts`, `lib/coach-request-service.ts` | `/coach`, `/coach/athletes/*`, request APIs |
| `PLAN-001` | Coach and athlete planning | `in-progress` | `lib/coach-planner-service.ts`, `lib/athlete-planner-service.ts`, `lib/assignment-service.ts` | `/coach/planner`, `/athlete/planner` |
| `LIB-001` | Owner-scoped workout libraries | `shipped` | `lib/workout-library-service.ts`, `lib/coach-session-library-service.ts` | `/coach/workouts`, `/athlete/workouts` |
| `TEMPLATE-001` | Templates and training plans | `in-progress` | `lib/template-service.ts`, `lib/coach-training-plan-service.ts` | `/coach/templates`, `/athlete/templates` |
| `SESSION-001` | Canonical editor and outcomes | `in-progress` | `lib/session-editor.ts`, `lib/session-snapshot-service.ts`, `lib/athlete-completion-service.ts` | Session detail, `WorkoutBuilder`, outcome APIs |
| `SHARE-001` | Sanitized workout sharing | `in-progress` | `lib/share-link.ts`, `lib/share-link-service.ts` | `/share/[token]`, share APIs |
| `COMPAT-001` | Older coach session adapter | `transitional` | `lib/planner-service.ts` | `/api/coach/sessions/[sessionId]` |

Current verification and gaps are in `CURRENT-STATUS.md`. When a capability
changes owner or state, update this row and the current status in the same
change.

## Active Tasks

No long-running task is registered. Create one from `tasks/TEMPLATE.md` only for
work that needs coordination across multiple files or sessions.
