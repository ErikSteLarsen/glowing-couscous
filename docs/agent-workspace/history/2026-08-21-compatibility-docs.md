# Compatibility Boundary Hardening

- **Date:** 2026-08-21
- **Task:** `COMPAT-002`
- **Status:** Shipped
- **Agent:** `opencode-compat-2026-08-21`

## Changed

- Made legacy planner updates select the Plan for the draft scheduled date's
  Monday week, fixing cross-week stale Plan ownership.
- Added compatibility template ownership checks through the athlete's coach.
- Rejected edits/deletes of sessions with Activity outcomes with `409`.
- Removed the unreferenced legacy `BuilderClient.tsx` after repository-wide
  reference analysis; kept and tested the query-preserving builder redirect.
- Replaced comment-based builder assertions with runtime/source behavior tests.
- Recorded the transitional boundary and cleanup policy in decision `0008`.

## Verification

- Focused compatibility tests — pass.
- `pnpm test` — pass, 113 tests.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing Next.js middleware deprecation warning remains.
- `git diff --check` — pass.

## Follow-Up

- Audit and remove remaining stale pre-Tempo helpers only after import and
  persisted-data reference analysis under `CLEANUP-001`.
