# Current status

Updated 2026-09-30. Current evidence snapshot, not implementation history.
Latest checks cover truthful Home, workout/Profile/Live recovery and Account
controls. Older provider/device results retain their recorded scope.

## Latest recorded checks

| Gate | Latest recorded result | Scope / limits |
|---|---|---|
| `pnpm test` | 304/304 pass, 2026-09-30 | Home, recovery, account, export, save safety and protection of newer drafts in another tab |
| `pnpm lint` | Pass, 2026-09-30 | Full repository |
| Direct TypeScript | Pass, 2026-09-30 | Existing generated client |
| Direct `next build --webpack` | Pass, 2026-09-30 | TypeScript and 76 pages; middleware deprecation remains |
| `pnpm build` | Pass, 2026-09-30 | Prisma generation, seven migrations and 78 pages on disposable local PostgreSQL |
| PostgreSQL acceptance | Pass, 2026-09-30 | Disposable PostgreSQL 17: four concurrent retries create one workout, competing revisions, forced rollback after block deletion, atomic Profile validation/revisions, scoped export and session version increment |
| Migration status | New workout-save migration applied only to disposable PostgreSQL | Earlier configured database read-only check found all six existing migrations applied. New additive migration must deploy before new-workout retry safety is used there |

Latest checks reused installed dependencies with
`pnpm_config_verify_deps_before_run=false`. Prisma generation, migration deploy
and bundle compilation are distinct gates.

## Implemented behavior

- Home separates scheduled block structure from completion-date Activity
  outcomes, including standalone imports. Recent load is proportional and
  numerically labelled, with unknown/partial load distinguished from valid
  zero. Last outcome links include date/source; empty days say Nothing scheduled.
- Workout/Profile drafts use seven-day browser recovery, independent tab
  writers, explicit Restore/Discard, malformed/expiry/size checks and unavailable
  storage navigation guards. Profile updates validate before a single revision
  claim/write. New workout identities commit with their session and replay
  without duplicates; edit conflicts preserve drafts/blocks. Sign-out clears
  this browser's account drafts. Live checkpoints restore paused within 24 hours;
  accounting for elapsed time is explicit and completion remains server-owned.
- Profile has a separate Account section: safe sign-in capability readout,
  credential recovery, Strava access/consequences, versioned training download,
  current-device sign-out and sign-out everywhere. Fresh logins read the current
  sessionVersion. Export uses allowlisted fields, repeatable-read ownership
  filters and collection/block/output bounds. Strava measurements, raw sensor
  recordings, tokens, other people's private content and local drafts are omitted.
- Authenticated browser acceptance used a synthetic account exclusively on
  disposable local PostgreSQL: Profile reload/restore retained unfinished pace
  input, save/reload cleared recovery; workout edit reload/restore/save passed;
  Live reload offered a checkpoint and restored paused. Home was inspected with
  synthetic planned/actual/unknown-load outcomes in desktop dark/light and 390px
  light; Account controls were inspected at 390px dark. Physical devices, quota
  guards and full multi-tab/failure UI acceptance remain open. Initial browser
  timeouts were superseded by this successful isolated run.
  The download button produced no visible error, but the browser download event
  timed out; completed-file inspection remains unverified. Sign-out-everywhere
  confirmation hit a browser focus timeout, so UI revocation remains open even
  though the database service was verified. Temporary app processes and the
  disposable PostgreSQL container were removed; screenshot artifacts use only
  synthetic data. No configured account or provider data was changed.

- Signup creates self-coached ATHLETE accounts. Personal Workouts/Templates,
  Planner copies, Calendar, local Live, completion/correction and History form
  the core loop. Middleware redirects coach pages; the discovery page redirects in the personal
  experience; existing APIs/services retain role and ownership guards.
- Planner uses canonical repeated durations, strict cadence ranges, independent
  snapshots, atomic retry-safe batches and clear source selection. Personal
  edits do not require Assignment lineage; completion preserves the first
  planned baseline. Missing historical baselines are not fabricated.
- Shared authoring supports profile-backed HR/pace zones, target adjustments,
  repetitions/pauses, pointer/explicit ordering, undo/redo and tap-first phone
  lists. Reusable profile targets remain relative.
- Production uses Monolith, content-sized Home/Workouts, shared tokens and
  collapsible desktop/focus-managed mobile navigation. DESIGN.md owns the rules.
- File/Strava imports explicitly create standalone outcomes or match unfinished
  sessions. Measurements follow plan context; unmatched imports use recorded
  outcome layout. Removal restores matched plans. Live collects no telemetry.
- Guided drafts validate bounded model output and aggregate completed history,
  use cached provider health and standard-pattern fallback, and remain unsaved
  until reviewed and saved.
- Strava notifications read the local inbox on entry, every 15 visible seconds
  and on focus. Review later acknowledges; dismissal is recoverable. More than
  two arrivals open a selectable list that stays as the batch shrinks. Users can
  bulk add standalone sessions or dismiss, and individually edit/match. Bulk
  imports show progress and stop on failure with remaining selections preserved. All
  unimported rows remain on Import beyond the recent 100-activity provider page;
  provider updates preserve review state. Webhooks use two-minute leases,
  30-second-to-one-hour backoff, owner-only recovery and a secret-authenticated
  background worker. No retention deletion was added.

## Recorded browser and integration evidence

| Date | Evidence | Limits |
|---|---|---|
| 2026-09-30 | Strava components in mock fixture at 1440/390px, both themes: matching/standalone, discard restore, failure draft, periodic arrival, keyboard/Escape and reload passed. `.impeccable/review/strava-notifications/` | Fixture session warnings; no authenticated login/live delivery/real DB concurrency; fixture removed |
| 2026-09-30 | Strava batch mock fixture at 1440/390px, both themes: 30-row list, matching, preserved drafts, bulk standalone import, partial failure/retry, bulk dismiss, list at two remaining, Escape, live threshold transition and keyboard/overflow passed. `.impeccable/review/strava-batch/` | Mocked APIs, no live Strava delivery; fixture removed. Finish reviewer: ship; no material fixes |
| 2026-09-30 | Shell/sidebar fixture at 1440/1024/768/390/320px: width recovery, desktop persistence, drawer focus/dismissal, inert/scroll/resize/history cleanup, blocked storage and themes passed. `.impeccable/review/collapsible-menu/` | Component interactions, not authenticated journey; fixture removed |
| 2026-09-30 | Authenticated Home, Workouts, Planner, Templates, Calendar, History, Import, Profile, Preferences and completed detail at 1440/390px in both themes: 40 checks without horizontal overflow. `.impeccable/review/sizing-depth/` | Sparse data; populated Today/long lists, active editing/Live, import errors, coach/device acceptance unverified; preferences restored |
| 2026-09-29 | Fresh signup, empty routes at 1440/390px, saved 45-minute run, dated copy, three-block Live completion, reopened 45-minute/32-TSS outcome; Athlete `/coach` redirect | Partial themes/states; coach/import errors/assistive technology not verified; ignored local credentials |
| 2026-09-27 | Synthetic phone Planner/History and unsaved tap-edited draft at 320/390px; desktop Planner 1280px; auth screens and HTTP validation | No saved fixture data; native keyboard/devices/import profiling unverified |
| 2026-09-25 | Authenticated desktop target presets, fine adjustments, zone crossing/reset, session HR mode, inheritance and pause | Specific mobile target adjustment flow unverified |
| 2026-09-18 | Fresh create/plan/edit/reschedule/complete/correct/compare/reload journey; exact ranges, empty tabs, pointer/undo/reduced motion; DB replay/concurrency/rollback | Earlier UI and SQLite; does not certify current PostgreSQL |

Earlier task recorded user confirmation of deployed Strava OAuth/manual import.
That is user-reported evidence, not a fresh provider check by this cleanup.

## Strava production publication

On 2026-09-30, implementation commit `251df37` was pushed to `origin/main` after
284/284 tests, full lint, direct webpack bundle/TypeScript (76 pages), and diff
checks passed. The independently published documentation consolidation was
preserved. Standard `pnpm build` still hit the local Windows Prisma DLL lock
before migrations; the running local preview was not stopped.

Production at `https://glowing-couscous-delta.vercel.app` now serves the new
`/api/strava/inbox` endpoint: HTTP 401 with its expected sign-in JSON, replacing
the previous HTTP 404. `/login` returns 200. This verifies publication and the
unauthenticated guard, not an authenticated activity review. The production
webhook challenge returns 200 with the exact challenge. Read-only configured
database metadata confirms `20260930150000_strava_notifications` finished and
was not rolled back. No activity data was created, imported or deleted during
publication checks. Real Strava upload-to-popup, persisted review/matching,
scheduled retry execution and database concurrency remain acceptance gates.

Batch-review commit `eebb695` was pushed to `origin/main` after the recorded
fixture, tests, lint and direct build checks. Production's public login build
identifier changed from `px4Fm3HCkQRwQtCfjLQYa` to `GeGN8hEBlRyv3m38a-240`
after the push; login returned 200 and the inbox retained its expected 401 guard.
This confirms a new production build, not real authenticated batch acceptance.
The design reviewer and documenter approved the scoped extension. The documenter
reported pre-existing `.impeccable/design.json` drift from current Monolith
rules; global design files were preserved.

## Open gates and risks

1. Verify remaining migrations in the intended target, including provider
   health; the Strava notification migration is confirmed in the configured
   database. Regenerate the local Prisma client without the Windows lock.
   Verify PostgreSQL persistence/concurrent placement and
   webhook claims without resetting existing data.
2. Configure HTTPS Strava callbacks/subscription and scheduled authenticated
   worker; verify live delivery, retry, update/privacy/delete/disconnect and
   deauthorization. Fixture inbox checks do not close live provider gates.
   The user reports webhook registration completed. A read-only production
   challenge check on 2026-09-30 against
   `https://glowing-couscous-delta.vercel.app/api/strava/webhook` now returned
   HTTP 200 with the exact challenge using the local `.env` verification token.
   The previous token mismatch is resolved and the notification implementation
   is published; see the production publication evidence above. No subscription
   or activity data was changed by the read-only challenge checks.
3. Verify guided creation with a server key and authenticated desktop/phone
   save/reopen, provider labels and fallback. No live model call recorded.
   Configure/test Resend delivery and optional Google OAuth independently.
4. Refresh public sharing, session mutations, populated saved templates/import
   errors and mobile target adjustments. Atlas, Flowline/Workbench/Trail and
   Terrain/Ribbon/Staging comparisons remain deferred developer verification,
   not personal-MVP blockers.
5. Complete iOS/Android, native keyboard/file picker, Live sleep/resume, touch,
   import performance and assistive-technology acceptance. Older axe findings
   included contrast, landmarks and template container ARIA; later token and
   landmark changes require a fresh audit rather than claiming old failures
   remain reproduced today.
6. Before broad signup, decide/complete privacy/support information, account
   deletion and server-side signup abuse controls. Earlier readiness review
   recorded these missing; no launch certification is claimed.
7. Middleware-to-proxy deprecation persists. Migration-bearing build and Google
   font fetching remain environment-sensitive gates.

## Documentation maintenance

### Remaining account/recovery rollout gates, 2026-09-30

The initial source assessment has been followed by the implementation and
isolated evidence above. The full active plan remains indexed; it is not complete.

- Safe account deletion is not shipped. It needs recent credentials/OAuth proof,
  preservation of other users' coach-derived copies, explicit Strava webhook
  cleanup and deterministic provider-failure/retry behavior. No deletion endpoint
  or placeholder deletion button was added.
- Operator/support identity and actual retention/backup facts remain owner
  inputs for public privacy/support. Durable signup/login abuse controls and
  verified-email lifecycle are still pending before broad signup.
- Deploy the additive WorkoutSaveRequest migration with the code. It has been
  reviewed/applied on the disposable database only; existing accounts/provider
  data and the configured database schema were not modified by these new checks.
- Home retains existing server-local date rules. An account timezone must be
  applied consistently across Calendar/Planner/History, rather than Home alone.
- Complete browser failures, multi-tab/account transitions, storage denial,
  changed/deleted-source restoration, export download and actual session
  invalidation UI; finish physical phone sleep/wake and keyboard acceptance.


The 2026-09-30 consolidation replaced superseded reviews/histories with this
snapshot, owner index and operations/verification runbooks. Deferred gates are
retained above; task files no longer archive completed or idle work. Product,
architecture and design remain distinct contracts. Cleanup verification: relative documentation links and indexed owner paths resolve;
no references to removed reviews remain. `pnpm test` passed 284/284 and `pnpm
lint` passed on 2026-09-30 with installed dependencies reused. `git diff --check`
passed after line-ending cleanup. No build, migration, browser or provider check
was performed for this documentation-only change.
