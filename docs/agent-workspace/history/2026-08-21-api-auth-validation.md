# API Authorization And Input Validation

- **Date:** 2026-08-21
- **Task:** `API-001`
- **Status:** Shipped
- **Agent:** `opencode-api-2026-08-21`

## Changed

- Added `lib/route-params.ts` with strict positive-integer parsing and malformed
  or non-object JSON body handling.
- Replaced permissive `Number(...)` parsing in all protected dynamic API routes.
- Added `400` handling for malformed JSON and invalid body shape in protected
  mutations and signup/profile transport adapters.
- Preserved explicit role guards on all protected routes and public exceptions for
  Auth.js, signup, and role setup.
- Updated source regression tests to assert the new parser seam and added route
  inventory tests covering guard and dynamic-ID usage.
- Recorded JWT principal authorization and database-backed ownership as decision
  `0004`.

## Verification

- `pnpm test` — pass, 92 tests.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing Next.js middleware deprecation warning remains.
- `git diff --check` — pass.

## Follow-Up

- Add full session-backed route integration tests for 401/403/400 outcomes when
  the coverage task expands beyond source and adapter tests.
