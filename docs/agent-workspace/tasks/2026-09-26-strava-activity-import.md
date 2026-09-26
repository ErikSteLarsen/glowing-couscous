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
- [x] Confirm the Vercel build and production migration after correcting Prisma
  CLI resolution; user confirmed the deployed OAuth/manual import flow.
- [x] Show imported heart-rate intensity in week Calendar as duration-aligned
  bars, with profile-based zones where available and explicit gaps otherwise.
- [x] Show recorded measurements for both file and Strava imports beneath the
  planned workout score and block list on session detail.
- [ ] Verify automatic webhook delivery against the live Strava app.
- [ ] Verify the additive migration on a non-production database.
- [ ] Run full repository checks when the local dependency environment allows.

## Verification

Focused parser, import, chart, and pure Node checks passed in prior runs. The
pace chart correction has syntax and diff checks only; full repository
verification is currently limited by an incomplete local dependency tree and
inaccessible package registry. Production OAuth/manual import were confirmed
by the user; live webhook delivery and non-production migration verification
remain open. Current details are in
[`CURRENT-STATUS.md`](../CURRENT-STATUS.md).

The week-calendar intensity timeline has `git diff --check`, Node syntax checks
for the changed service files, and one Impeccable detector pass. ESLint is
unavailable because dependencies are absent and registry access is blocked;
browser rendering and a production build were not verified.
