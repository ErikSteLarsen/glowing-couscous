# Verification and release acceptance

Methods live here; actual results and open gates belong in
[CURRENT-STATUS.md](agent-workspace/CURRENT-STATUS.md). Owners and boundaries
belong in [ARCHITECTURE.md](../ARCHITECTURE.md). Mock/preview fixtures establish
component behavior, not authenticated persistence or live provider delivery.

## Automated checks

Run smallest relevant checks during iteration. Before finishing behavior changes
run `pnpm test`, `pnpm lint` and `pnpm build` when allowed by the environment.
The build **deploys migrations**: confirm the target database first.
`pnpm exec next build --webpack` is a bundle-only check and must be labeled that
way. See [operations](OPERATIONS.md) for dependency preflight and DLL locks.
Prose-only edits need reference/source checks and `git diff --check`, not a
migration-bearing build or application tests.

Use an isolated disposable **PostgreSQL** database with current migrations for
persistence, missing-record, rollback, uniqueness and concurrency checks.
Historical SQLite evidence does not certify current PostgreSQL behavior;
permissive mocks and source regex checks alone cannot prove transactional behavior.

`tests/postgres-recovery.acceptance.ts` is an explicit integration check, outside
the unit-test glob. It requires the disposable local database named
`tempo_acceptance` on port 55432 and rejects other targets. Apply current
migrations there, set DATABASE_URL/DIRECT_URL for that process, then run
`node --experimental-strip-types --test tests/postgres-recovery.acceptance.ts`.
It creates/cleans its own synthetic accounts and covers concurrent creation,
stale edit claims, rollback after block removal, Profile conflicts
and session-version revocation. Never point it at a real account database.

`tests/postgres-deletion.acceptance.ts` uses the same disposable-only guard.
Run explicitly with `node --experimental-strip-types --test
tests/postgres-deletion.acceptance.ts`. It verifies credential/provider/webhook
erasure, anonymized share preservation, unshare ownership, recipient history,
durable attempt throttling, stale sessions, Google proof expiry, provider outage,
transaction rollback and simultaneous deletion. Live Google/Strava callbacks
require separate acceptance; do not delete a real account to verify this flow.

`tests/http-deletion.acceptance.ts` additionally requires a local production
server at `http://localhost:3100` with the same disposable DATABASE_URL/DIRECT_URL
and AUTH_URL/NEXTAUTH_URL set to that origin. It creates its own account and
checks actual credentials sign-in cookies, cross-site rejection, password
confirmation, public deleted-owner rendering, session revocation and removal
of the export endpoint. Run using Node's experimental strip-types test mode.

## Accounts and evidence

A dedicated local Athlete account was used on the configured Neon branch.
If present, its credentials are in gitignored
`.opencode/visual-test-account.local.md`; never copy them into tracked docs.
On another machine create a disposable personal account through signup.
Confirm the database is appropriate for test data; do not seed/reset an existing
branch to gain access. Record created data and restore review-only preferences.

Record dates, commands, actual outcomes, routes, themes, viewports, data source
and limitations. Distinguish authenticated routes, synthetic fixtures,
user-reported production behavior and live integrations. Screenshots support
interaction/persistence checks; they do not replace them.

## Personal MVP journey

1. Sign up without seed data or a coach. Verify login/logout, refresh, validation,
   network recovery and role setup where applicable.
2. Create/save/reopen a workout. A 300-second block repeated four times shows
   1,200 seconds. Exercise add, reorder, duplicate, remove, targets, pauses,
   undo/redo, failure draft retention and explicit save feedback.
3. Schedule multiple dates in Calendar; check week/month views after reload. Edit and
   cross-week reschedule personal work without requiring Assignment lineage.
4. Reuse templates: day = one date, week = seven consecutive days starting
   Monday, month = a whole calendar month. Reject partial/gapped/invalid ranges
   without writes; clear hidden selection when switching to empty source tabs.
5. Follow Live: start, pause, previous, next, skip, restart, final zero and
   explicit completion. Live does not collect device/sensor telemetry.
6. Complete, correct actuals, compare Planned/Actual and reopen History after
   refresh/sign-in. Preserve the first planned baseline; never fabricate a
   missing legacy baseline from current blocks or mutable library content.
7. Verify batch rollback, same-key replay/concurrency, different-payload key
   rejection and cross-user isolation with the actual database.
8. Exercise failure/retry/removal and shared coach regressions; another user's
   content must remain inaccessible to unauthorized reads and mutations.

## Integration acceptance

| Area | Required checks |
|---|---|
| Guided creator | Keyless fallback, live model validation/source labels, invalid response, authenticated desktop/phone save/reopen, provider-health migration |
| Files | FIT/TCX/GPX parsing/errors, duplicates, matching/standalone import, measurements, removal restoring planned work |
| Strava | HTTPS challenge/OAuth return, live webhook, leased retry/recovery, updates/privacy/delete/deauthorization, duplicate-safe explicit import |
| Notifications | Entry/periodic arrival, Review later, discard/restore beyond provider recent page, matching/standalone, failure draft retention, dialog keyboard/Escape |
| Sharing | Public workout/template previews, sanitization, long content, explicit authenticated intake and unauthorized mutation rejection |
| Auth | Configured recovery email delivery, expiry/single use/session invalidation and optional Google OAuth |

## Responsive and accessibility acceptance

Check actual routes in both themes at desktop, 768px and 320–430px. Include
empty/populated/long content, expanded tables, overflow, 200% zoom/text scaling,
keyboard/focus, names/labels, landmarks, contrast, reduced motion and non-color
feedback. Shell checks include drawer focus return/containment, Escape, inert
content, scroll lock, resize/history cleanup and desktop menu/theme persistence.

Phone navigation groups Home, Plan (Calendar/Planner), Workouts (Templates), and
History (Import). Verify date handoff, week strip/sticky placement, tap-first
editing, History filters and pinned Profile save state. Check coach navigation
against existing role boundaries after shared changes.

Physical iOS Safari and Android Chrome checks include portrait/landscape,
safe areas/browser chrome, keyboard/autofill/file picking, one-handed reach,
Live sleep/lock/resume, VoiceOver/TalkBack, and maximum supported imports on a
representative lower-memory phone. Desktop emulation does not close those gates.
Developer `/design/*` comparisons are outside MVP acceptance unless promoted.
