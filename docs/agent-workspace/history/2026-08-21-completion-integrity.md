# Completion And Activity Integrity

- **Date:** 2026-08-21
- **Task:** `COMPLETION-002`
- **Status:** Shipped
- **Agent:** `opencode-completion-2026-08-21`

## Changed

- Added `lib/athlete-completion-service.ts` for ownership checks, bounded notes,
  idempotent complete/reopen commands, and transaction boundaries.
- Moved all completion Prisma behavior out of the route.
- Added `Session.athleteNotes`, nullable `Activity.compliancePct`, persisted
  `Activity.segmentsJson`, and `Activity.metricsSource`.
- Manual completion now stores `manual-planned` estimates without fabricated
  100% compliance; seeded recorded outcomes preserve explicit source metadata.
- Updated athlete and coach readers to use stored Activity segments and label
  unavailable compliance/planned estimates.
- Rejected coach planner and compatibility edits/deletes for Activity-backed
  sessions with `409`.
- Updated session notes, activity UI, architecture, and coordination records.

## Verification

- `pnpm exec prisma validate` — pass.
- `pnpm db:push --force-reset` — pass on disposable local SQLite.
- `pnpm db:seed` — pass.
- `pnpm test` — pass, 103 tests.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing Next.js middleware deprecation warning remains.
- `git diff --check` — pass.

## Follow-Up

- Manual outcomes remain planned estimates until performed metrics are imported;
  telemetry and device integrations are outside the current product scope.
- Non-disposable databases need a deliberate backfill/migration for required
  Activity segment snapshots before applying the schema.
