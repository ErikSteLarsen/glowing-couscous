# Task: Activity file and Strava import

- **Status:** `in-progress`
- **Agent:** `/root`
- **Started:** `2026-09-26`
- **Updated:** `2026-09-26`
- **Capability IDs:** `ACTIVITY-001`, `STRAVA-001`, `SESSION-001`

## Goal

Provide one shared activity review/import flow for user-selected files and
Strava activities. Support optional matching to unfinished planned sessions,
preserve normalized sensor measurements, and present metrics with appropriate
bar granularity.

## Current state

- [x] Shared Imported activities page with browser-side FIT, TCX, and GPX
  parsing, review, optional planned-session matching, import, and telemetry bars.
- [x] Owner-scoped, deduplicated persistence for standalone and matched imports;
  matched planned sessions retain their workout blocks.
- [x] User-linked Strava OAuth with encrypted, refreshed credentials; recent
  activity review, server-side stream normalization, sport selection, and
  explicit import through the shared activity service.
- [x] Idempotent asynchronous webhook processing and authenticated queue
  recovery. Disconnect and deauthorization remove the associated Tempo
  connection and imported records, restoring matched planned sessions.
- [ ] Verify the additive database migration against a non-production database.
- [ ] Complete authenticated browser and live OAuth/webhook verification.
- [ ] Run full repository checks when the local dependency environment allows.

## Verification

Focused parser, import, chart, and pure Node checks have passed in prior runs.
Full repository verification is currently limited by an incomplete local
dependency tree and inaccessible package registry. The migration and live
authenticated browser flow remain unverified. Current details are in
[`CURRENT-STATUS.md`](../CURRENT-STATUS.md).
