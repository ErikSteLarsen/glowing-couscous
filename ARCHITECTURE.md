# Architecture

This document describes the current implementation. The source code, tests, and
`prisma/schema.prisma` remain authoritative.

## Product Priority

The first MVP centers on independent personal training, as defined in
PRODUCT.md. The existing ATHLETE role and /athlete/* routes are the current
implementation of that personal workspace. Coach services remain secondary compatibility; coach pages currently redirect
to `/athlete` through the proxy, and discovery redirects in its page. Their presence in this owner map does not
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
`readJsonObject` verifies only the transport object shape and returns unknown
properties. `lib/session-write-input.ts` uses Zod to validate legacy planner,
canonical session-edit and training-plan metadata shapes at their service
boundaries before database access. It preserves provided values, optional fields
and nullable fields without coercion or defaults; unknown keys are stripped.
Existing domain validators retain title, target, schedule, duration and outcome
rules, and existing service queries retain ownership and authorization checks.


## Routes

### Public and authentication

- `/` - entry redirect
- `/login`, `/signup`, `/setup`, `/forgot-password`, `/reset-password` - credentials authentication, compatibility setup for accounts without a role, and one-time credential recovery
- `/share/[token]` - public sanitized workout snapshot

### Coach compatibility

These route implementations remain in the tree, but the proxy redirects all
`/coach*` pages to `/athlete`. APIs bypass that redirect and keep their own role
and ownership guards; page visibility is not API authorization.

- `/coach` - roster
- `/coach/athletes/[athleteId]` - athlete detail
- `/coach/workouts` - owner-scoped unscheduled workout library
- `/coach/planner` - month-first Planning Desk for dated source assignment
- `/coach/builder` - compatibility redirect to the active planner

### Athlete

- `/athlete` - Home week overview
- `/athlete/calendar` - unified week/month calendar; `place=workout|template` (with optional `source`) opens placement through the shared planner desk; view settings live in the URL and the `tempo-calendar-totals` cookie
- `/athlete/workouts` - owner-scoped unscheduled workouts and the read-only
  Public library tab with URL-synced catalog filters. `?customize=<slug>` opens
  an unsaved draft. Saving uses the owned-workout API.
- `/athlete/library` - legacy redirect to the Public library tab with catalog filters
- `/athlete/library/[slug]` and `/athlete/library/[slug]/schedule` - catalog
  workout profile, start actions, and Calendar placement
- `/athlete/ride` - Ride home (no app chrome; Tempo Ride's default page): today's and recent open bike sessions, recent rides, and the library with Ride now
- `/athlete/planner` - retired; redirects `date`/`source` to Calendar placement (`getPlannerRedirectHref`)
- `/athlete/templates` - private weekly routines composed from saved workouts
- `/athlete/session/[sessionId]` - read-only workout profile, block inspector and outcome review; `lib/session-structure.ts` groups identical instructions, `lib/workout-profile.ts` unrolls them into the shared `components/WorkoutProfile.tsx`, and the route's `SessionStructure.tsx` owns selection/disclosure
- `/athlete/live/[sessionId]` - local countdown-based block execution and explicit completion
- `/athlete/ride/[sessionId]` - indoor bike ride for BIKING sessions: targets-only timer or Web Bluetooth trainer/HR/cadence with ERG targets, 1 Hz recording checkpointed to localStorage (and `window.tempoDesktop` when present), saved through `POST /api/activity-imports` as a `file-import` attached to the planned session
- `/athlete/activity` - History for completed sessions, manual logs and imported activities, paginated with URL name/sport filters and matching totals
- `/athlete/import` - activity-file and Strava review/import; the previous `/athlete/imported-activities` path redirects here
- `/athlete/find-coach` - dormant discovery entry; redirects to `/athlete`
- `/athlete/events` - athlete-owned event milestones, targets, and results
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
- `/api/athlete/templates/*` - saved-workout routines
- `/api/athlete/library/[slug]/{ride,schedule}` - copy a catalog workout to today or chosen dates
- `/api/athlete/planner/*`, `/api/athlete/sessions/*` - athlete planning and outcomes
- `/api/athlete/workouts/generate` - private guided workout draft generation from bounded choices and recent completed training
- `/api/athlete/workouts/ai-status` - private read of cached, app-wide model availability
- `/api/athlete/activities` - manual activity logging, eligible session candidates, and explicit standalone-or-paired completion
- `/api/athlete/activities/[activityId]` - owner-scoped correction of standalone and paired manual outcomes
- `/api/athlete/activities/import/*` - bounded TCX/FIT/GPX preview and explicit import choice
- `/api/athlete/events/*` - athlete-owned event milestone mutations and explicit completed-activity links
- `/api/share-links/*` - authenticated share creation and intake
- `/api/strava/*` - per-user OAuth, activity review/import, webhook receipt, disconnect/deauthorization cleanup, and webhook worker recovery

## Service Ownership

| Area | Owner | Responsibility |
|---|---|---|
| Authentication | `auth.ts`, `proxy.ts`, `lib/auth-session.ts`, `lib/api-auth.ts`, `lib/password-reset-service.ts` | Session shaping, redirects, current-user access, API role guards, and one-time password recovery |
| Account | `lib/account-service.ts` | Profile, performance profile, and overview preference reads/writes |
| Coach reads | `lib/coach-service.ts` | Roster and athlete-detail read models |
| Coach requests | `lib/coach-request-service.ts` | Search, request creation, approval, rejection, and pending uniqueness |
| Athlete reads | `lib/athlete-service.ts`, `lib/home-summary.ts` | Home, Calendar, Activity, profile, discovery, and session reads; Home reads current-week outcomes separately from the latest four activities and uses pure outcome/load summaries |
| Athlete planning | `app/(app)/athlete/calendar/AthleteCalendar.tsx`, `lib/athlete-service.ts`, `lib/athlete-planner-service.ts`, `lib/template-service.ts`, `lib/workout-library-service.ts` | Week/month calendar review and rescheduling, in-page placement mode (`CalendarPlacement`), private dated copies and existing planner API mutations |
| Coach planning | `lib/coach-planner-service.ts`, `components/PlannerDesk.tsx` | Month-grid workspace, dated sessions, source search, and roster-scoped planner writes |
| Shared planning contracts and metrics | `lib/planner-view.ts`, `lib/planner-source-metrics.ts` | UI-independent source/session/day contracts; personal sources exclude coach training plans; persisted planner block conversion and canonical repeated source durations |
| Library | `lib/workout-library-service.ts`, `lib/coach-session-library-service.ts` | Unscheduled owner-scoped workout definitions |
| Guided workout creation | `lib/guided-workout.ts`, `lib/guided-workout-service.ts`, `lib/workout-llm.ts`, `components/GuidedWorkoutForm.tsx` | Owner-scoped recent-training summary, validated full model-authored workouts, app-wide provider health cache, standard fallback patterns, and unsaved draft handoff to the shared builder |
| Training plans | `lib/coach-training-plan-service.ts` | Reusable weekday-based coach plans |
| Templates | `lib/template-service.ts`, `lib/template-routine.ts`, `components/TrainingTemplatesClient.tsx` | Owner-scoped saved-workout routine composition, snapshot validation and weekday expansion; `lib/template-period.ts` validates week/month application |
| Activity navigation | `lib/activity-navigation.ts` | Validated history filters, page size, and pagination URLs |
| Athlete events | `lib/athlete-event-service.ts`, `lib/athlete-service.ts` | Athlete-owned event validation, results, explicit completed-activity search/link/unlink, and Home and Calendar read models |
| Manual activity | `lib/athlete-manual-activity-service.ts`, `lib/athlete-import-pairing.ts` | Athlete-owned manual summaries, eligible self-planned candidates, explicit pairing or standalone logging, atomic completion, and version-checked manual corrections |
| Activity import | `lib/athlete-tcx-import-service.ts`, `lib/athlete-fit-import-service.ts`, `lib/athlete-gpx-import-service.ts`, `lib/athlete-import-pairing.ts`, `lib/tcx-activity.ts`, `lib/fit-activity.ts`, `lib/gpx-activity.ts`, `lib/tcx-upload.ts` | Shared bounded upload and explicit preview/confirmation routes; summary-only TCX/FIT/GPX parsing, athlete-scoped fingerprints, eligible self-planned candidates, and atomic Activity attachment |
| Assignment | `lib/assignment-service.ts` | Snapshot copies, lineage, deduplication, and training-plan assignment |
| Session compatibility | `lib/planner-service.ts` | Older coach session mutation adapter; transitional only |
| Workout content | `lib/session-editor.ts`, `lib/session-editor-adapters.ts`, `lib/workout-blocks.ts`, `lib/workout-pattern.ts` | Canonical drafts, editor modes, block normalization, pattern and pause insertion, and persistence shaping |
| Targets and metrics | `lib/workout-targets.ts`, `lib/workout-target-resolution.ts`, `lib/workout-zone-intensity.ts`, `lib/profile-training-zones.ts`, `lib/performance-profile.ts`, `lib/account-service.ts`, `lib/session-math.ts`, `lib/planned-power-load.ts`, `lib/tempo-blocks.ts` | Relative target catalogs, profile-backed zone calculations and persistence, zone presets and classification, derived metrics, and timeline segments |
| Session outcomes | `lib/athlete-completion-service.ts`, `lib/session-snapshot-service.ts`, `lib/athlete-session-adjustment-service.ts`, `lib/session-comparison-service.ts` | Completion, baseline/actual snapshots, planned edits, and comparison reads |
| Activity file imports | `lib/activity-file-parser.ts`, `lib/activity-import-service.ts`, `lib/activity-series.ts` | Local FIT/TCX/GPX parsing, validated user-selected imports, planned-session matching, deduplication, telemetry persistence, and metric-specific bar buckets |
| Strava sync | `lib/strava-service.ts`, `lib/strava-inbox-service.ts`, `app/api/strava/*`, `components/StravaImportPanel.tsx`, `prisma/schema.prisma` | User-scoped OAuth, durable inbox review state, leased webhook queue and retry recovery, explicit newest-first Import inbox review, server-side stream normalization, explicit import via the shared importer, and existing disconnect/revocation cleanup |
| Indoor rides | `lib/ride/*`, `app/(app)/athlete/ride/[sessionId]/*` | Pure BLE characteristic parsers and FTMS control encoders, ride plan (ERG midpoint watts, warm-up/cool-down ramps, free ride without power target), recorder/summary/import payload/checkpoint; client-only Web Bluetooth manager with backoff reconnect and crash-safe local storage. No ride-specific server code: persistence reuses `activityImportService.importForUser` |
| Workout catalog | `lib/workout-catalog/*`, `lib/workout-catalog-service.ts`, `lib/ride-hub-service.ts`, `components/library/*` | Read-only catalog data in code (not the database); pure expansion, %FTP metrics (NP estimate, IF, TSS, time in zone), duration buckets, filter/search/sort and URL state, schema validation, and conversion to canonical relative-FTP editor blocks (sets unrolled, cue and cadence in the block note, warm-up/cool-down ranges ridden as ramps). Ride now and Schedule copy through `athletePlannerService.saveSession`. Customize builds an unsaved editor draft. Saving goes through `workoutLibraryService.saveForOwner` without catalog lineage. Slugs are stable URLs |
| Sharing | `lib/share-link.ts`, `lib/share-link-service.ts` | Sanitized snapshots, opaque tokens, public lookup, and explicit recipient copies |

## Data Ownership

`prisma/schema.prisma` defines `User`, Auth.js `Account`, `CoachRequest`,
`Plan`, `TrainingPlan`, `Session`, `Block`, `Template`, `Activity`,
`Assignment`, `TrainingPlanAssignment`, `ShareLink`, `StravaConnection`,
`StravaInboxActivity`, `StravaWebhookEvent`, `PasswordResetToken`,
`PlacementRequest`, `WorkoutSaveRequest`, `AiProviderHealth`, `ActivityAnalysis`, and `AthleteEvent`.

- `User.role` controls access. Credentials signup sets ATHLETE and selfCoached directly; nullable roles use compatibility setup.
- `User.sessionVersion` invalidates previously issued JWT sessions after a credential password reset; server auth refreshes the version before accepting protected work.
- `User.performanceProfileJson` is read and written through `lib/account-service.ts`. It stores maximum heart rate, sport thresholds, a running race result, and optional per-zone pace overrides; normalization retains existing version 1 values.
- `User.coachId` represents the accepted coach-athlete relationship.
- `Session` can be an athlete assignment, a coach library source, or a training-plan child. A standalone library session has no date, `Plan`, or `TrainingPlan`.
- `Block` is the structured source for workout content and derived metrics.
- Planned cycling TSS sums duration-weighted squared FTP fractions across blocks and rounds once. Steady power ranges use their midpoint. Warm-up and cool-down ranges integrate the squared power of a linear ramp. Relative targets provide the FTP fraction directly, and absolute targets use the athlete's current FTP when available. Other active blocks use zone factors. Catalog cards and session reads share the power calculation, and ride setup uses the session estimate.
- `Block.kind = pause` represents a seconds-based rest between efforts. It contributes elapsed duration but no zone distribution or training load; the shared pattern helper inserts it only between blocks or repeated sets.
- The workout editor's zone presets live in `lib/workout-zone-intensity.ts`. `lib/profile-training-zones.ts` mirrors Olympiatoppen's HRmax calculator for I-1â€“I-5 and seeds five editable pace bands from average race speed. `max-hr` and `profile-pace-zone-N` block references remain generic in stored workouts and sanitized shares; resolve them against the current user's profile in the workout/session UI. Fine adjustments can reclassify a block's zone. Existing targets change only when their relative profile reference is resolved or a user edits/reapplies a preset.
- `Assignment` and `TrainingPlanAssignment` record source-copy lineage and prevent duplicates.
- `Activity` stores completion outcomes and the latest actual snapshot. Planned session data stores the latest coach baseline snapshot.
- File imports store normalized recorded samples and import provenance on the owner's `Activity`. The uploaded original file is parsed in the browser and is never persisted. `Activity.importFingerprint` prevents importing the same normalized file twice for one account. Users can delete an import: matched sessions restore their prior status and keep their planned blocks; standalone imported sessions are removed.
- Strava connections belong to one Tempo `User.id` and one Strava athlete ID. OAuth tokens are AES-GCM encrypted with a server-only key. The recent-activity inbox and webhook receipt queue are separate from Tempo sessions; a user must explicitly review and import an activity. Imported Strava sessions carry source identity so activity updates, privacy changes, disconnect, and deauthorization can be reflected in Tempo and matched planned sessions restored.
- `StravaInboxActivity.notifiedAt` retains legacy notification acknowledgement state; `dismissedAt` records recoverable discard. Neither deletes data, and provider upserts preserve both. Needs review ignores legacy acknowledgement state so previously acknowledged but unimported items remain reviewable. All unimported inbox items remain reachable on Import, including older discarded items. `StravaWebhookEvent.processingUntil` leases concurrent work and `nextAttemptAt` controls bounded backoff. The shell does not poll or open automatic arrival dialogs. Import reads the local inbox on visit and explicit Refresh inbox; Needs review excludes imported and dismissed items, while All activities retains access to both. Visiting Import schedules only that owner's due recovery work after the response. Sync now explicitly fetches recent provider activities. The authenticated worker handles retries while users are away. No storage-retention deletion was added.
- `PasswordResetToken` stores one hashed, 30-minute reset token per credentials account, plus a per-account email cooldown and hourly send limit. Resend delivery requires `RESEND_API_KEY`, a verified `PASSWORD_RESET_FROM_EMAIL`, and an HTTPS `AUTH_URL` in production; raw reset tokens are sent by email and never stored. Password reset increments the account session version so older JWTs are rejected.
- `AthleteEvent` stores a personal event date, optional target finish time, and optional post-event result, scoped to its athlete and independent of planned sessions. `Activity.eventId` is an optional athlete-owned association: an event can link multiple activities, but each activity can link to at most one event. Deleting an event clears the link; deleting an activity does not delete the event.
- `ShareLink` stores a token hash and one sanitized snapshot tied to either a `Session` or `Template`; the raw token is never persisted.

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
12. Imported activity pairing belongs to the import services and `lib/athlete-import-pairing.ts`; preserve the scheduled plan and report duration-only comparison unless an actual structured snapshot exists.
13. Personal event/activity associations belong to `lib/athlete-event-service.ts`; require explicit athlete action and keep the event result independent of linked activity metrics.
14. Manual activity/session pairing belongs to `lib/athlete-manual-activity-service.ts`; require explicit athlete choice, preserve planned content and baseline, and report duration only without inventing actual blocks or TSS.
15. Derive the user's "today", week and overdue boundaries from their IANA zone: read it with `getRequestTimeZone()` (`lib/request-time-zone.ts`, the `tempo-tz` cookie kept current by `components/TimeZoneSync.tsx`, UTC until reported) and compute with `lib/user-time.ts`. Never use the server clock's local day; stored session dates keep their UTC-midnight day convention.

## Persistence and verification

`lib/draft-recovery.ts` owns bounded, versioned browser recovery. The shared hook
uses an account/surface/resource key and independent mount writer identities;
adopting a draft must not erase a newer snapshot written by the original tab.
Workout/Profile drafts expire after seven days; content-bound Live checkpoints
expire after 24 hours and restore paused. Sign-out clears the current browser's
account drafts. Browser recovery never claims server persistence.

`account-service.updateProfile` validates the complete request before one
compare-and-swap write of name, performance profile and supplied preferences.
Home's `HomeTrainingSetup` reads through `account-service.getAccount` and
links to the missing target in Profile. The `training-setup` helpers use
shared running-zone calculations, HRmax, FTP and CSS, and honor any saved
endurance-sport selection in `prefsJson.trainingSports`. Profile owns target
editing and revision-aware saves.
`WorkoutSaveRequest` owns user/owner/request uniqueness and normalized-payload
hashes for transactional workout creation. Keep the identity after workout
deletion to refuse accidental recreation on retry. Edits claim the expected
Session revision before replacing blocks inside the same transaction.
`session-editor.createSessionEditorBlockData` shapes canonical serialized blocks
for personal/coach planning, libraries, training plans, planned adjustments and actual corrections: omit source block IDs, round
legacy integer target fields and retain decimal targets, repetition, skip state
and order. Do not create another route or service-specific block serializer.

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
The service separates durable identity preparation from final erasure. Share
retention and recipient detachment helpers receive the existing transaction;
they must complete before User deletion and must not commit independently.

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

## Personal training routines

`Template.routineJson` holds a versioned weekly pattern of weekday entries and
server-captured library workout snapshots. Personal authoring uses this required
field. The current schema also retains legacy sport/cadence columns and Block
and ShareLink relations, restored by the personal-training-loop migration;
they do not add a second personal authoring model. Session.templateId retains
routine lineage with on-delete SET NULL, preserving independent calendar copies.
Personal template POST/PATCH uses `template-service.saveForOwner`, accepting
only library workout IDs, weekdays, name and summary. It checks ownership and
standalone-library scope within the save transaction; submitted blocks, titles,
targets and arbitrary snapshot data are never trusted. Duplication retains the
snapshots. Deleted or edited source workouts do not alter a saved routine;
saving again requires available library workouts and captures current versions.

`template-routine` owns parsing and deterministic date/weekday expansion.
`athlete-planner-service.assignSource` validates a complete Monday-starting week
or calendar month, then creates each dated workout copy and placement identity
in one transaction. Empty weekdays leave existing calendar content unchanged.
Within-day entry order is preserved in creation order, which Calendar reads by
session ID after date. Relative references and decimal targets survive copying.
Workouts never loads a template as one workout; standalone saves refuse template
lineage. Coach assignment supports library sessions and training plans only.
Public links publish session definitions, not routines. An Athlete can explicitly
save a shared workout into their library and a one-entry Monday routine through
`share-link-service.saveTemplateCopy`. These are two service saves, not one
transaction; a routine-save failure can leave its library workout copy. Public
routine projection remains unsupported. No new coach authorization is added.
Historical migrations remain immutable: the routine cleanup removed old fields,
and the later personal-training-loop migration restored compatibility fields.
Current schema and service behavior override that intermediate migration state.

## Imported running workout interpretation

ActivityAnalysis has one current job/result per Activity, with cascading deletion
and separate correctionJson. lib/activity-import-service atomically enqueues an
opted-in eligible file import; lib/activity-analysis-service owns manual requests,
owned reads/corrections and bounded leased processing. lib/activity-analysis-job
owns source allowlisting, version and input hash. Thin analysis routes authenticate
and delegate; the worker route additionally requires its dedicated bearer secret.

lib/activity-analysis is pure: original telemetry and optional lap boundaries
produce measured segments, pooled effort pace, profile-backed zones and candidate
intention. lib/activity-analysis-llm only selects a supplied candidate and explains
bounded evidence through the existing workout-llm transport. Measured metrics and
training emphasis stay code-owned. Invalid/unavailable provider output falls back
to the calculated result. No raw GPS, identity, notes or Strava-derived data enters
this adapter. Guided workout history also excludes Strava sources before model use.

The service serializes short claims using a PostgreSQL advisory transaction lock,
caps concurrent unexpired leases at four, retries at most three times and checks
lease token, source, input hash and Activity existence before publication. Model
calls happen outside transactions. after() is opportunistic delivery; the secret
worker must be scheduled for browser-independent delivery/retry recovery. Profile
is snapshotted, reanalysis replaces the current result, and user confirmation
survives it. Inferred intent never mutates the saved session baseline or telemetry.

Presentation adapts analysis through lib/activity-analysis-view into the existing
SessionBlockBar. Telemetry v1 remains readable; v2 optionally stores validated
TCX/FIT laps. FIT elapsed chronology and timer duration are distinct. Timer events,
advanced segmentation and historical result versions are deferred.
- Public sharing, recipient intake, and session outcome mutations have local Chromium verification. Production deployment remains unverified.
- Auth.js external OAuth integration is optional and not covered by local credentials tests.
- The authentication proxy runs in Node.js so roleless JWT refreshes can query Prisma. Its redirects are secondary to the service/API authorization checks.

## Calendar scheduling

`lib/calendar-navigation.ts` owns validated local calendar-day URL navigation.
`AthleteCalendar` renders week/month views and submits drag or explicit-date
moves to `/api/athlete/planner/sessions/[sessionId]/schedule`.
`athletePlannerService.rescheduleSession` atomically checks athlete ownership,
completion, and coach assignment, preserves local time/content, and updates the
Monday-based plan. Calendar content and summaries refresh from server data.
