# Task: Trustworthy account controls, recoverable work and truthful Home

- **Status:** `in-progress`
- **Owner:** current Codex session
- **Started / updated:** 2026-09-30 / 2026-09-30
- **Capabilities:** AUTH-001, ACCOUNT-001, RECOVERY-001, HOME-001, LIB-001, SESSION-001, STRAVA-001, SHELL-001

## Goal and scope

Deliver the three priority improvements identified in the readiness assessment.
Preserve Monolith, personal-first workflows, coach authorization and independent
scheduled copies. Keep routes thin and database behavior in existing services.
No production data deletion, seeding, publication or invented privacy claims.

## Implementation sequence

### 1. Truthful Home (first implementation slice)

- [x] Add a pure Home summary owner and service tests. Separate scheduled
  structure (date of scheduled Session) from completed outcomes (Activity date).
  Standalone imports count only as outcomes; matched imports count once.
- [x] Read current-week outcomes independently of the latest four activities.
  Scheduled metrics use blocks; completed duration uses Activity.durationSec.
  Render completed session rows with outcome duration without changing other
  route read models. Keep the planned schedule visible after completion.
- [x] Replace Fitness trend with Recent session load; scale against the highest
  available value, expose numeric values/dates, distinguish unknown from zero,
  and explain that load is estimated rather than a fitness measurement.
- [x] Replace Rest day with Nothing scheduled. Show separate Scheduled and
  Completed week summaries and count unavailable load without adding it as zero.
  Last activity should link to its outcome and show date and source.
- [x] Use one service clock for Home dates/queries and rendered labels. Retain
  existing server-local date semantics initially; account timezone is a separate
  substep requiring consistent Calendar/Planner/History rules, not a Home-only
  timezone change. Preserve overview preference IDs while updating descriptions.
- [x] Tests: 60-minute plan/45-minute outcome, standalone and matched imports,
  cross-week completion, missed sessions, unknown/zero load, all-unknown totals,
  corrected outcomes, empty week, stable ordering and proportional chart values.

### 2. Recoverable workout and Profile drafts

- [x] Make combined profile/preference updates one account-service transaction.
  Validate the entire input before any writes; preserve unrelated preferences.
- [x] Introduce a bounded, versioned recovery store and hook. Defaults:
  seven-day draft expiry, 24-hour Live checkpoint expiry, same-browser recovery.
  Keys include user, surface and resource; do not persist credentials or tokens.
  Store content, timestamp, baseline revision/fingerprint and draft identity.
- [x] Save after changes with a short debounce; flush on visibility/page hide.
  Validate read payloads and bound size; handle corrupt/expired data and storage
  denial without breaking the editor. Offer Restore/Discard with meaningful copy.
  Local recovery is never presented as server persistence.
- [x] Integrate workout create/edit and full Profile form (including unfinished
  pace/time strings). Pass authenticated owner identity from server pages.
  Do not persist mock/design-preview drafts. Use recoverable conflict messaging
  when the source has changed or disappeared; never silently overwrite.
- [x] Keep drafts on failed saves. Clear only the saved revision after success,
  explicit discard, explicit sign-out or account deletion. Isolate account changes.
  Define multi-tab writer ownership and conflict behavior rather than last-write
  wins. Add beforeunload only while unrecovered changes exist; shell navigation
  uses the shared draft guard when recovery is unavailable.
- [x] Add database-backed duplicate-safe new-workout request identity and expected
  revision checks on edits. Reuse service/transaction conventions; do not use
  PlacementRequest for a different domain without updating its contract.
  Add a migration only after the concrete persistence design is reviewed.
- [ ] Tests/browser: reload/leave/restore/discard, failed save/lost response/replay,
  changed or deleted source, two tabs, different accounts, quota/blocked storage,
  invalid payload/expiry, mobile keyboard and both themes.

### 3. Account controls and public trust information

- [x] Add a distinct Account section reachable from Profile, outside the training
  save form. Keep Preferences for Home choices. Reuse shared controls and layout.
  Show email, sign-in method, credential recovery action and connection access.
- [x] Add sign out everywhere through account service using sessionVersion;
  invalidate current session too, clear local drafts and navigate to login.
- [x] Defer downloads at the user's request. Remove the download UI, export
  route/service and export-only tests. Do not offer download before deletion.
- [x] Reuse existing Strava disconnect service via Account's connection link. Explain that disconnect removes
  Strava-imported outcomes and restores matched plans; show remote revocation
  failure honestly. Do not silently alter this behavior in the Account UI.
- [ ] Add public privacy/support pages and links from auth and Account only once
  operator name, support contact, actual processors, retention and backup policy
  are known. Explain local drafts, file parsing, Strava and optional AI processing
  truthfully. Do not ship placeholder contacts or unsupported compliance claims.
- [ ] Add durable signup/login abuse controls before broad signup (before expensive
  password hashing), and define email verification/verified email change as an
  auth substep. Reset limits alone do not cover signup or login.
- [ ] Tests/browser: session invalidation,
  network failures, keyboard/focus, mobile reach, provider failure copy.

### 4. Safe account deletion

- [x] Add current password confirmation with durable throttling, or signed Google
  callback metadata within five minutes for provider-only accounts. Metadata is
  bound to the authenticated user; refresh/update does not renew it. Deletion
  requires explicit typed DELETE. Password/session changes invalidate proof.
- [x] Preview consequences and public-link count before final confirmation. Lock account
  deletion against concurrent mutations/imports and make retry deterministic.
- [x] Audit all relations. Preserve other users' independent session copies; detach
  coach relationships/shared lineage as appropriate before cascade deletion.
  Remove owner content, outcomes, preferences, accounts/reset tokens and
  placement identities. Clean Strava webhook rows explicitly (no User foreign key).
- [x] Retain shared workout structure under [deleted], regenerate an allowlisted
  snapshot and remove free text/source/creator references. Offer owner-scoped
  unshare before deletion; explain that others' saved copies remain theirs.
- [x] Coordinate local deletion and provider revocation without holding a database
  transaction across a network request. Prioritize personal erasure: retain no
  token for retry, and show manual Strava revocation instructions on outage.
  Define backup retention separately; never promise immediate backup erasure.
- [x] Verify deletion/rollback/concurrency on disposable PostgreSQL, credentials and
  OAuth cases, coach-owned shared content, invalid/expired proof, stale sessions,
  provider outage and duplicate submission. Never test deletion on real accounts.
- [ ] Finish live Google/Strava callback acceptance and physical-device testing.

### 5. Live recovery

- [x] Persist owner/session/content-bound execution checkpoint: selected block,
  handled/skipped state, remaining time, notes and checkpoint time. Restore paused.
- [x] Offer Resume checkpoint / Account for elapsed time; do not infer completed
  exercise from browser inactivity. Reject changed/completed sessions and expire
  old checkpoints. Completion remains explicit through its owning service.
- [ ] Check refresh, long sleep, lock/resume, wake-lock loss, clock changes, failure
  to complete, duplicate completion, physical iOS/Android and account isolation.

## Verification and rollout

Use docs/VERIFICATION.md for the full acceptance method. Run relevant pure/service
tests first; before finishing a behavior slice run pnpm test, pnpm lint and pnpm
build when environment permits. The build deploys migrations: inspect target and
new migrations first; do not use seed/reset. If Prisma locking blocks the standard
build, report it and run a clearly labelled bundle-only build independently.
Verify actual routes in both themes at desktop and 390px; distinguish component
fixtures from authenticated persistence and physical-device evidence. Release
each coherent slice with actual results and unresolved gates in CURRENT-STATUS.

## Current evidence and blockers

- Source inspection and earlier assessment are in CURRENT-STATUS.md.
- Operator/support and real retention/backup facts remain owner inputs.
- Account timezone and actual backup/retention policy remain separate decisions.
  Downloads and email verification are deferred by the user.
- Physical-device and complete browser failure/multi-tab acceptance remain.
- Dependency tree was restored from the frozen lockfile. Standard build and
  disposable PostgreSQL acceptance succeeded. New migration is applied only
  locally; deploy it with code before exercising the new create path elsewhere.
- Authenticated synthetic-account browser checks passed Profile and workout
  restore/save/reload and paused Live restore. Home was inspected desktop
  dark/light and 390px light; Account controls at 390px dark. No live provider,
  real account deletion or publication was performed. See CURRENT-STATUS.md.
- Confirmation-driven session invalidation hit browser event/focus limitations
  and remains open; downloads were removed. Synthetic screenshot artifacts stay
  outside the repository.
- Next work: live provider deletion acceptance; durable auth abuse controls;
  complete browser failure/account/multi-tab/session acceptance. Public
  privacy/support needs the unresolved owner facts above.
- No subagents requested; work remains in this session.

## Finish

Update current status, capability owners and durable PRODUCT/ARCHITECTURE/DESIGN
contracts as behavior lands. Remove this task only after all slices are complete
or explicitly deferred and every remaining gate is reflected in current status.
