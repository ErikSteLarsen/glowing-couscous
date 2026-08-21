# Coach Request Lifecycle Invariants

- **Date:** 2026-08-21
- **Task:** `REQUEST-002`
- **Status:** Shipped
- **Agent:** `opencode-request-2026-08-21`

## Changed

- Added nullable unique `CoachRequest.pendingAthleteId` and seeded the active
  pending request with its key.
- Enforced athlete-role and active-coach eligibility in
  `lib/coach-request-service.ts`.
- Added pending-key writes for create/reopen and cleared keys on reject/accept.
- Converted acceptance to an atomic transaction that connects the athlete,
  clears self-coached mode, and rejects competing pending requests.
- Mapped pending-key unique races to `409` domain conflicts.
- Added focused service tests for eligibility, reopen, race conflicts, atomic
  acceptance, and rejection cleanup.
- Added request-list/action error states and in-flight action guards to coach and
  athlete request UIs.

## Verification

- `pnpm exec prisma validate` — pass.
- `pnpm db:push --accept-data-loss` — pass on disposable local SQLite; Prisma
  emitted the expected unique-constraint data-loss warning.
- `pnpm db:seed` — pass; seeded pending key verified directly.
- `pnpm test` — pass, 99 tests.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing Next.js middleware deprecation warning remains.
- `git diff --check` — pass.

## Follow-Up

- Backfill `pendingAthleteId` for pending rows before applying this schema to a
  non-disposable database.
- Continue planned onboarding UX polish separately from lifecycle invariants.
