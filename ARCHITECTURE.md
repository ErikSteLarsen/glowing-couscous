# Architecture

This document describes the current implementation. The source code, tests, and
`prisma/schema.prisma` remain authoritative.

## Product Priority

The first MVP centers on independent personal training, as defined in
PRODUCT.md. The existing ATHLETE role and /athlete/* routes are the current
implementation of that personal workspace. Coach services remain secondary compatibility; coach pages currently redirect
to `/athlete` through middleware, and discovery redirects in its page. Their presence in this owner map does not
make coach feature completion a first-MVP gate. Extend the personal or shared
service owner for personal workflows and preserve role/ownership boundaries.
This priority does not change the current schema, roles, or route names.

## Runtime Shape

Next.js 16 App Router renders pages under `app/`. Authenticated pages use the
grouped `(app)` layout, which loads the current user, redirects users without a
role to `/setup`, and mounts `components/AppShell.tsx`. Server pages read
through `lib/` services. Client components own drafts and call API adapters for
mutations.

Most API routes guard the session with `lib/api-auth.ts`, parse transport input
with `lib/route-params.ts`, and delegate business behavior to a domain service.
The signup route is the intentional authentication exception and owns its
one-time account creation flow directly.

## Routes

### Public and authentication

- `/` - entry redirect
- `/login`, `/signup`, `/setup`, `/forgot-password`, `/reset-password` - credentials authentication, compatibility setup for accounts without a role, and one-time credential recovery
- `/share/[token]` - public sanitized workout snapshot

### Coach compatibility

These route implementations remain in the tree, but middleware redirects all
`/coach*` pages to `/athlete`. APIs bypass that redirect and keep their own role
and ownership guards; page visibility is not API authorization.

- `/coach` - roster
- `/coach/athletes/[athleteId]` - athlete detail
- `/coach/workouts` - owner-scoped unscheduled workout library
- `/coach/planner` - month-first Planning Desk for dated source assignment
- `/coach/builder` - compatibility redirect to the active planner
- `/coach/templates` - private template library

### Athlete

- `/athlete` - Home week overview
- `/athlete/calendar` - unified week/month calendar with inline workout/template scheduling
- `/athlete/workouts` - owner-scoped unscheduled workout library
- `/athlete/planner` - compatibility redirect to Calendar scheduling, preserving the date
- `/athlete/templates` - private reusable day, week, and month training templates
- `/athlete/session/[sessionId]` - read-only scheduled-session score and outcome review
- `/athlete/live/[sessionId]` - local countdown-based block execution and explicit completion
- `/athlete/activity` - History for completed sessions and imported activities
- `/athlete/import` - activity-file and Strava review/import; the previous `/athlete/imported-activities` path redirects here
- `/athlete/find-coach` - dormant discovery entry; redirects to `/athlete`
- `/athlete/profile`, `/profile` - profile surfaces and compatibility alias
- `/settings` - Home overview card preferences

Internal visual demos live under `/design/*` and are not part of the primary
navigation.

### API areas

- `/api/auth/*` - Auth.js, signup, role setup, and rate-limited password recovery
- `/api/account/*` - account profile and preferences
- `/api/coaches` and `/api/athlete/coach-requests` - athlete discovery
- `/api/coach/requests/*` - coach request decisions
- `/api/coach/planner/*`, `/api/coach/assignments`, `/api/coach/sessions/*` - coach planning
- `/api/coach/workouts/*`, `/api/athlete/workouts/*` - standalone libraries
- `/api/coach/templates/*`, `/api/athlete/templates/*` - reusable templates
- `/api/athlete/planner/*`, `/api/athlete/sessions/*` - athlete planning and outcomes
- `/api/athlete/workouts/generate` - private guided workout draft generation from bounded choices and recent completed training
- `/api/athlete/workouts/ai-status` - private read of cached, app-wide model availability
- `/api/share-links/*` - authenticated share creation and intake
- `/api/strava/*` - per-user OAuth, activity review/import, webhook receipt, disconnect/deauthorization cleanup, and webhook worker recovery

## Service Ownership

| Area | Owner | Responsibility |
|---|---|---|
| Authentication | `auth.ts`, `middleware.ts`, `lib/auth-session.ts`, `lib/api-auth.ts`, `lib/password-reset-service.ts` | Session shaping, redirects, current-user access, API role guards, and one-time password recovery |
| Account | `lib/account-service.ts` | Profile, performance profile, and overview preference reads/writes |
| Coach reads | `lib/coach-service.ts` | Roster and athlete-detail read models |
| Coach requests | `lib/coach-request-service.ts` | Search, request creation, approval, rejection, and pending uniqueness |
| Athlete reads | `lib/athlete-service.ts`, `lib/home-summary.ts` | Home, Calendar, Activity, profile, discovery, and session reads; Home reads current-week outcomes separately from the latest four activities and uses pure outcome/load summaries |
| Athlete planning | `app/(app)/athlete/calendar/TrainingCalendar.tsx`, `lib/athlete-service.ts`, `lib/athlete-planner-service.ts`, `lib/template-service.ts`, `lib/workout-library-service.ts` | Unified week/month calendar, inline source selection and date review, private dated copies and existing planner API mutations |
| Coach planning | `lib/coach-planner-service.ts`, `components/PlannerDesk.tsx` | Month-grid workspace, dated sessions, source search, and roster-scoped planner writes |
| Library | `lib/workout-library-service.ts`, `lib/coach-session-library-service.ts` | Unscheduled owner-scoped workout definitions |
| Guided workout creation | `lib/guided-workout.ts`, `lib/guided-workout-service.ts`, `lib/workout-llm.ts`, `components/GuidedWorkoutForm.tsx` | Owner-scoped recent-training summary, validated full model-authored workouts, app-wide provider health cache, standard fallback patterns, and unsaved draft handoff to the shared builder |
| Training plans | `lib/coach-training-plan-service.ts` | Reusable weekday-based coach plans |
| Templates | `lib/template-service.ts` | Owner-scoped personal and coach templates and cadence |
| Assignment | `lib/assignment-service.ts` | Snapshot copies, lineage, deduplication, and training-plan assignment |
| Session compatibility | `lib/planner-service.ts` | Older coach session mutation adapter; transitional only |
| Workout content | `lib/session-editor.ts`, `lib/session-editor-adapters.ts`, `lib/workout-editor.ts`, `lib/workout-blocks.ts`, `lib/workout-pattern.ts` | Canonical drafts, editor modes, block normalization, pattern and pause insertion, and persistence shaping |
| Targets and metrics | `lib/workout-targets.ts`, `lib/workout-target-resolution.ts`, `lib/workout-zone-intensity.ts`, `lib/profile-training-zones.ts`, `lib/performance-profile.ts`, `lib/account-service.ts`, `lib/session-math.ts`, `lib/tempo-blocks.ts` | Relative target catalogs, profile-backed zone calculations and persistence, zone presets and classification, derived metrics, and timeline segments |
| Session outcomes | `lib/athlete-completion-service.ts`, `lib/session-snapshot-service.ts`, `lib/athlete-session-adjustment-service.ts`, `lib/session-comparison-service.ts` | Completion, baseline/actual snapshots, planned edits, and comparison reads |
| Activity file imports | `lib/activity-file-parser.ts`, `lib/activity-import-service.ts`, `lib/activity-series.ts` | Local FIT/TCX/GPX parsing, validated user-selected imports, planned-session matching, deduplication, telemetry persistence, and metric-specific bar buckets |
| Strava sync | `lib/strava-service.ts`, `lib/strava-inbox-service.ts`, `app/api/strava/*`, `components/StravaImportPanel.tsx`, `components/StravaActivityNotifications.tsx`, `prisma/schema.prisma` | User-scoped OAuth, durable inbox review state, leased webhook queue and retry recovery, shared-shell notifications from local inbox reads, server-side stream normalization, explicit import via the shared importer, and existing disconnect/revocation cleanup |
| Sharing | `lib/share-link.ts`, `lib/share-link-service.ts` | Sanitized snapshots, opaque tokens, public lookup, and explicit recipient copies |

## Data Ownership

`prisma/schema.prisma` defines `User`, Auth.js `Account`, `CoachRequest`,
`Plan`, `TrainingPlan`, `Session`, `Block`, `Template`, `Activity`,
`Assignment`, `TrainingPlanAssignment`, `ShareLink`, `StravaConnection`,
`StravaInboxActivity`, `StravaWebhookEvent`, `PasswordResetToken`,
`PlacementRequest`, and `AiProviderHealth`.

- `User.role` controls access. Credentials signup sets ATHLETE and selfCoached directly; nullable roles use compatibility setup.
- `User.sessionVersion` invalidates previously issued JWT sessions after a credential password reset; server auth refreshes the version before accepting protected work.
- `User.performanceProfileJson` is read and written through `lib/account-service.ts`. It stores maximum heart rate, sport thresholds, a running race result, and optional per-zone pace overrides; normalization retains existing version 1 values.
- `User.coachId` represents the accepted coach-athlete relationship.
- `Session` can be an athlete assignment, a coach library source, or a training-plan child. A standalone library session has no date, `Plan`, or `TrainingPlan`.
- `Block` is the structured source for workout content and derived metrics.
- `Block.kind = pause` represents a seconds-based rest between efforts. It contributes elapsed duration but no zone distribution or training load; the shared pattern helper inserts it only between blocks or repeated sets.
- The workout editor's zone presets live in `lib/workout-zone-intensity.ts`. `lib/profile-training-zones.ts` mirrors Olympiatoppen's HRmax calculator for I-1â€“I-5 and seeds five editable pace bands from average race speed. `max-hr` and `profile-pace-zone-N` block references remain generic in stored workouts and sanitized shares; resolve them against the current user's profile in the workout/session UI. Fine adjustments can reclassify a block's zone. Existing targets change only when their relative profile reference is resolved or a user edits/reapplies a preset.
- `Assignment` and `TrainingPlanAssignment` record source-copy lineage and prevent duplicates.
- `Activity` stores completion outcomes and the latest actual snapshot. Planned session data stores the latest coach baseline snapshot.
- File imports store normalized recorded samples and import provenance on the owner's `Activity`. The uploaded original file is parsed in the browser and is never persisted. `Activity.importFingerprint` prevents importing the same normalized file twice for one account. Users can delete an import: matched sessions restore their prior status and keep their planned blocks; standalone imported sessions are removed.
- Strava connections belong to one Tempo `User.id` and one Strava athlete ID. OAuth tokens are AES-GCM encrypted with a server-only key. The recent-activity inbox and webhook receipt queue are separate from Tempo sessions; a user must explicitly review and import an activity. Imported Strava sessions carry source identity so activity updates, privacy changes, disconnect, and deauthorization can be reflected in Tempo and matched planned sessions restored.
- `StravaInboxActivity.notifiedAt` acknowledges a notification batch; `dismissedAt` records recoverable discard. Neither deletes data, and provider upserts preserve both. Import excludes already imported IDs from notification reads before batching. All unimported inbox items remain reachable on Import, including older discarded items. `StravaWebhookEvent.processingUntil` leases concurrent work and `nextAttemptAt` controls bounded backoff. The signed-in shell reads `/api/strava/inbox` every 15 seconds while visible; the route schedules only that owner's due recovery work. The authenticated worker handles retries while users are away. No storage-retention deletion was added.
- `ShareLink` stores a token hash and one sanitized snapshot tied to either a `Session` or `Template`; the raw token is never persisted.
- `PasswordResetToken` stores one hashed, 30-minute reset token per credentials account, plus a per-account email cooldown and hourly send limit. Resend delivery requires `RESEND_API_KEY`, a verified `PASSWORD_RESET_FROM_EMAIL`, and an HTTPS `AUTH_URL` in production; raw reset tokens are sent by email and never stored. Password reset increments the account session version so older JWTs are rejected.

## Safe Extension Rules

1. Keep all week calculations Monday-based.
2. Find and extend the existing owning service before adding Prisma logic to a route or page.
3. Keep Workouts unscheduled. Personal date and week assignment belongs to Calendar through `athlete-planner-service`; coach assignment remains in Planner or `assignment-service`.
4. Use the canonical session editor and shared block components for new workout authoring.
5. Read and write personal training metrics through `account-service`; keep profile-derived workout targets as relative profile references so copied content resolves per user.
6. Keep completed sessions immutable through planner paths. Completion/reopen behavior belongs to `athlete-completion-service`.
7. Keep source-copy behavior in `assignment-service`; copied sessions are independent snapshots.
8. Keep baseline and actual payloads behind `session-snapshot-service`; do not derive history from mutable current blocks.
9. Keep public sharing sanitized and explicit. Never include Activity, actual/baseline JSON, private notes, RPE, ownership, or relationship data.
10. Treat `lib/planner-service.ts` and `/api/coach/sessions/[sessionId]` as compatibility code, not a new extension point.
11. The guided creator accepts model-authored blocks only after server validation of duration, structure, zones, and cautious-history limits. Its model call receives aggregate completed-training context, never raw notes or telemetry, and never persists the draft. Provider availability uses a short database-backed lease and cache shared across app instances.

## Persistence and verification

`lib/draft-recovery.ts` owns bounded, versioned browser recovery. The shared hook
uses an account/surface/resource key and independent mount writer identities;
adopting a draft must not erase a newer snapshot written by the original tab.
Workout/Profile drafts expire after seven days; content-bound Live checkpoints
expire after 24 hours and restore paused. Sign-out clears the current browser's
account drafts. Browser recovery never claims server persistence.

`account-service.updateProfile` validates the complete request before one
compare-and-swap write of name, performance profile and supplied preferences.
Home's `HomeTrainingSetup` reads through `account-service.getAccount` and saves
through the same Profile endpoint with `expectedUpdatedAt`. Selected endurance
sports live in `prefsJson.trainingSports`, separately from performance metrics;
the service validates the selection and merges unrelated preferences. The pure
`training-setup` helpers determine completeness using shared running-zone
calculations, HRmax, FTP and CSS. No onboarding-completed flag substitutes for
actual targets, and no schema change is required.
`WorkoutSaveRequest` owns user/owner/request uniqueness and normalized-payload
hashes for transactional workout creation. Keep the identity after workout
deletion to refuse accidental recreation on retry. Edits claim the expected
Session revision before replacing blocks inside the same transaction.

Account controls live separately from the Profile training form. Sign-out
everywhere increments User.sessionVersion; fresh sign-ins read its current
value. Training export is deferred; no download route is exposed.

`account-deletion-service` owns preview, owner-scoped unsharing and account
erasure. Password attempts reserve a durable, row-locked counter before bcrypt
(five per 15 minutes). Provider-only Google accounts require signed initial
OAuth callback metadata within five minutes; JWT refresh/update does not renew
that timestamp. Final deletion rechecks sessionVersion and password hash.
Serializable transactions with bounded serialization/deadlock retries protect
anonymization, recipient detachment and cascade deletion as one unit.

`account-deletion-privacy` regenerates retained ShareLink snapshots through the
existing projection allowlist and clears titles, summaries and block notes.
Invalid snapshots lose their raw blob and stay unavailable. Explicit
ownerDeleted snapshots can outlive source and creator references; ordinary
source deletion still cascades its links. ShareLink.createdBy is nullable, not a
tombstone User. Recipient sessions/outcomes survive coach deletion; deleted
coach references, authored free text and embedded baseline/actual lineage are
removed. Independent saved copies remain recipient-owned.

Account deletion explicitly removes StravaWebhookEvent by connected athlete ID;
these rows have no User foreign key. Enqueue locks the connection and ignores
unconnected owners, preventing post-deletion callbacks from recreating records.
Local credentials/imports are removed in the transaction; remote Strava
revocation runs only after commit, without a durable token retry store. Failure
returns an instruction to revoke Tempo from Strava manually. No backup-erasure
or live-provider verification is implied by active-database deletion.

PostgreSQL is the current datasource. `prisma/migrations/` owns committed schema
changes; pooled `DATABASE_URL` serves runtime, direct `DIRECT_URL` serves Prisma.
`PlacementRequest` records user-scoped request identity, normalized payload and
placement results for atomic retry-safe batches. `AiProviderHealth` owns shared
provider availability and claim leases. Do not replace database uniqueness or
transactions with UI-only guards.

See [operations](docs/OPERATIONS.md) for setup/deployment and
[current status](docs/agent-workspace/CURRENT-STATUS.md) for unresolved gates.
