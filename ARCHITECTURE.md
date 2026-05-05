# Architecture Notes

## Current Direction

The project has been refactored toward deeper modules so the codebase is easier to navigate and extend.

### Core Boundaries

- `lib/planner-service.ts`
  - Owns week-scoped planner loading and mutations.
  - Pages and planner-related API routes should use this boundary instead of reaching into Prisma directly for planner rules.

- `lib/workout-spec.ts`
  - Owns workout block draft behavior, normalization, validation, and persistence transforms.

- `lib/workout-editor.ts`
  - Owns shared workout content draft shaping used by both session editing and template editing.

- `lib/template-service.ts`
  - Owns coach template list/create/update/delete behavior.
  - Template API routes and template pages should use this boundary.

- `lib/demo-session.ts`
  - Owns the current demo-user lookup boundary for `coach` and `athlete`.
  - This is intentionally small and is the place to replace when real authentication is added.

### Shared UI Boundaries

- `components/WorkoutBlocksEditor.tsx`
  - Shared block editing UI.

- `components/CoachEditorDrawer.tsx`
  - Shared coach-side editor drawer shell.

## What To Build Against

When adding features, prefer these rules:

- Planner behavior goes through `planner-service`.
- Template behavior goes through `template-service`.
- Current-user access goes through `demo-session`.
- Shared workout content or block behavior goes through `workout-editor` and `workout-spec`.
- Avoid reintroducing Prisma calls directly into route handlers when the behavior already belongs to one of the service modules.

## Best Next Steps Later

When work continues, the strongest next improvements are:

1. Replace `demo-session` with real auth/session handling while keeping the same boundary shape.
2. Add boundary tests around `planner-service` and `template-service`.
3. Consider a shared mutation helper for client-side `fetch + error + refresh` patterns if the number of interactive forms keeps growing.
