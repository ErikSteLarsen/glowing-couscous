# Task: Centralize API Authorization And Input Validation

- **Status:** `completed`
- **Agent:** `opencode-api-2026-08-21`
- **Started:** `2026-08-21`
- **Updated:** `2026-08-21`
- **Feature IDs:** `API-001`, `AUTH-001`, `COVERAGE-001`, `COMPAT-001`
- **Related records:** [planned task](2026-08-21-api-auth-validation.md), [coverage](../features/coverage.md), [auth](../features/auth.md), [principal decision](../decisions/0004-api-principal-validation.md)

## Goal

Ensure every protected API route uses an explicit runtime principal guard and
every dynamic identifier/body parser rejects malformed input before Prisma.

## Starting Context

- Current behavior: `lib/api-auth.ts` now validates session principals, but
  route-local numeric parsing and JSON validation remain inconsistent.
- Existing owner/service: `lib/api-auth.ts`, route handlers under `app/api/`,
  and their owning domain services.
- Related active or transitional work: `AUTH-002` shipped the principal policy;
  `COMPAT-001` remains transitional for the old coach-session API.

## Plan

- [x] Inventory API routes and classify public/protected handlers.
- [x] Add a positive-integer route parser and focused guard/parser tests.
- [x] Replace direct dynamic-ID parsing and malformed-body handling in protected routes.
- [x] Verify public auth/signup/setup exceptions and ownership behavior.
- [x] Run repository gates and update workspace records.

## Progress Log

### 2026-08-21

- What changed: Claimed `API-001` after `AUTH-002` shipped.
- Decision or discovery: Existing `auth-principal` is the shared session seam;
  route IDs still require a separate positive-integer parser. JWT principal
  authorization will be evaluated against domain ownership reads rather than
  adding a database read to every guard.
- Files touched: This progress record and `WORK-INDEX.md`.
- Verification: `AUTH-002` gates passed before this task began.
- Blocker or next step: Inventory all active API handlers and their current guards/parsers.

### 2026-08-21

- What changed: Added `lib/route-params.ts` with strict positive-integer and
  JSON-object parsing, then applied it to all dynamic protected API routes and
  mutation bodies. Added route inventory regression tests.
- Decision or discovery: JWT claims remain the guard input; sensitive resource
  ownership is still re-read by the domain service or compatibility adapter under
  [decision 0004](../decisions/0004-api-principal-validation.md).
- Files touched: `lib/route-params.ts`, dynamic coach/athlete routes, public
  signup body validation, and `tests/route-params.test.ts`.
- Verification: Focused route parser and route inventory tests pass; `pnpm build`
  passes with the existing middleware deprecation warning.
- Blocker or next step: None for `API-001`; full session-backed route integration
  remains a future coverage improvement.

## Verification

- `pnpm test` — pass, 92 tests, on 2026-08-21.
- `pnpm lint` — pass on 2026-08-21.
- `pnpm build` — pass on 2026-08-21; existing middleware deprecation warning.
- `git diff --check` — pass on 2026-08-21.

### 2026-08-21

- What changed: Completed full API route validation and updated architecture,
  coverage, status, and handoff records.
- Decision or discovery: JWT guards are sufficient for principal authorization;
  ownership-sensitive mutations retain database reads in their owning modules.
- Files touched: All protected dynamic API adapters, public signup validation,
  `lib/route-params.ts`, tests, and workspace records.
- Verification: All task verification commands passed; the build warning is the
  existing Next.js middleware deprecation.
- Blocker or next step: None for this task.

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [2026-08-21 API auth validation](../history/2026-08-21-api-auth-validation.md)
- **Feature records updated:** [coverage](../features/coverage.md), [current status](../CURRENT-STATUS.md), [architecture](../../../ARCHITECTURE.md), [handoff](../../AI-HANDOFF.md)
- **Remaining work:** Add full session-backed route integration tests when expanding `COVERAGE-001`.
