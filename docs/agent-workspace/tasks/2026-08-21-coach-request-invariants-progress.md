# Task: Enforce Coach-Request Lifecycle Invariants

- **Status:** `completed`
- **Agent:** `opencode-request-2026-08-21`
- **Started:** `2026-08-21`
- **Updated:** `2026-08-21`
- **Feature IDs:** `REQUEST-002`, `ONBOARD-001`, `COVERAGE-001`
- **Related records:** [planned task](2026-08-21-coach-request-invariants.md), [onboarding](../features/onboarding.md), [decision](../decisions/0005-pending-coach-request-uniqueness.md)

## Goal

Make coach-request eligibility, one-pending-request concurrency, acceptance
cleanup, and request UI feedback explicit and database-safe.

## Starting Context

- Current behavior: The service handles sequential requests but does not enforce
  caller eligibility or database-backed one-pending uniqueness; UI failures are quiet.
- Existing owner/service: `lib/coach-request-service.ts`, request API routes,
  and `CoachRequestsPanel`/`FindCoachClient`.
- Related active or transitional work: `API-001` shipped strict request ID parsing;
  no other request task is active.

## Plan

- [x] Decide and record the SQLite pending-request uniqueness policy.
- [x] Add focused service and UI regression tests.
- [x] Implement schema, seed, eligibility, atomic lifecycle, and UI changes.
- [x] Run schema reset/seed and repository verification gates.
- [x] Update workspace records and commit the completed task.

## Progress Log

### 2026-08-21

- What changed: Claimed `REQUEST-002`; added decision `0005`, nullable unique
  `pendingAthleteId`, seed support, service invariants, and UI error/in-flight state.
- Decision or discovery: Self-coached athletes remain eligible to request a coach;
  acceptance clears self-coached mode. Database uniqueness is the concurrency
  authority and acceptance rejects competing pending rows transactionally.
- Files touched: `prisma/schema.prisma`, `prisma/seed.js`,
  `lib/coach-request-service.ts`, request UI components, and focused tests.
- Verification: Focused request, parser, and lint checks pass; Prisma validation passes.
- Blocker or next step: Run disposable SQLite schema reset/seed, full tests, and build.

## Verification

- `pnpm exec prisma validate` — pass on 2026-08-21.
- Focused request tests — pass on 2026-08-21.
- `pnpm lint` — pass on 2026-08-21.
- `pnpm db:push --accept-data-loss` — pass on the disposable local SQLite
  database on 2026-08-21; Prisma warned that adding the unique key may discard
  duplicate values.
- `pnpm db:seed` — pass on 2026-08-21; seeded pending request key verified.
- `pnpm test` — pass, 99 tests, on 2026-08-21.
- `pnpm lint` — pass on 2026-08-21.
- `pnpm build` — pass on 2026-08-21; existing middleware deprecation warning.
- `git diff --check` — pass on 2026-08-21.

### 2026-08-21

- What changed: Completed schema verification and updated onboarding, status,
  architecture, task, and history records.
- Decision or discovery: The nullable unique pending key is the concurrency
  authority; existing databases need pending-key backfill before relying on it.
- Files touched: Workspace records and implementation files listed above.
- Verification: All task verification commands passed; the build warning is the
  existing Next.js middleware deprecation.
- Blocker or next step: None for this task.

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [2026-08-21 coach request invariants](../history/2026-08-21-coach-request-invariants.md)
- **Feature records updated:** [onboarding](../features/onboarding.md), [current status](../CURRENT-STATUS.md), [coverage](../features/coverage.md)
- **Remaining work:** None for `REQUEST-002`; migration backfill is required for pre-existing pending rows in non-disposable databases.
