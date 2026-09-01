# Concise UI Copy

- **Date:** `2026-08-28`
- **Agent:** `OpenCode`
- **Feature IDs:** `ATHLETE-001`, `PLAN-001`, `TEMPLATE-001`, `ONBOARD-001`

## Changed Files

- Athlete calendar, home, activity, live, session, profile, settings, and coach
  discovery surfaces under `app/(app)/`
- Coach planner, source assignment, athlete detail, and template surfaces under
  `app/(app)/`
- `tests/coach-planner-service.test.ts`

## Behavior

- Removed explanatory copy that repeated visible calendar behavior, navigation,
  controls, or page titles.
- Shortened remaining action guidance to concise phrases such as “Complete a
  session to see it here” and “Assign a session in Planner.”
- Preserved dynamic context, errors, loading status, provenance, and meaningful
  empty-state guidance.
- Kept request status and messaging availability visible without repeating the
  adjacent profile action.

## Verification

- `pnpm test` — 147 tests passed on 2026-08-28.
- `pnpm lint` — passed on 2026-08-28.
- `pnpm build` — passed on 2026-08-28; existing middleware deprecation warning
  remains.
- `git diff --check` — passed on 2026-08-28.
