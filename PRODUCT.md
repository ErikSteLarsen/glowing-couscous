# Product

<!-- impeccable:product-schema 1 -->

Tempo is a self-directed endurance training planner. It helps people
create, schedule, follow, complete, and review their own training. The first MVP
must be useful to an individual without a coach, roster, or assigned plan.

The product brand is `Tempo` across runtime metadata, the sidebar mark,
documentation, and the package name.

## Platform

web

## Users

- **Primary: people managing their own training.** They create workouts and reusable templates, plan their calendar, follow sessions, and record and review outcomes. The current implementation calls this role Athlete.
- **Secondary: coaches and coached athletes.** Existing collaboration supports rosters, reusable content, and assignments. Coach discovery and connection are deferred from the current personal navigation.

## Product Purpose

Workout Planner is a self-directed endurance training planner. It helps people create, schedule, follow, complete, and review their own training. Success means a person can complete that full loop from a fresh account without a coach, roster, or assigned plan.

## Positioning

Workout Planner joins reusable structured workout authoring, Monday-first personal planning, guided session execution, and saved outcome review in one continuous self-directed workflow. Coach services remain compatibility paths; current page redirects keep the primary experience personal.

## Operating Context

The first MVP is used as a recurring personal training workspace:

1. Sign up and enter the personal Athlete workspace directly.
2. Create, edit, save, and reuse a structured workout, then group saved workouts into a reusable routine.
3. Schedule personal content on selected dates and review or remove planned sessions.
4. Open and follow a session, then record completion, notes, and actual outcomes.
5. Review persisted results in Activity and session detail after refreshing or signing in again.

Training weeks begin on Monday. Desktop, mobile, and keyboard workflows are all part of acceptance. The application is branded `Tempo` in runtime metadata while the repository and working product description use `Workout Planner`.

## First MVP Priorities and Acceptance

Prioritize correctness, persistence, understandable empty and error states, and usable desktop, mobile, and keyboard interactions across the personal training loop. Verify shared Planner source selection, date ranges, month navigation, and session state handling before expanding scope. These are acceptance targets, not a claim that every browser check has passed.

1. Sign up and reach a useful personal workspace.
2. Create, edit, save, and reuse a structured workout or template.
3. Schedule personal content on selected dates and reliably review or remove planned sessions.
4. Open and follow a session, record completion, notes, and actual outcomes.
5. Review saved results in Activity and session detail after refreshing or signing in again.
6. Log completed training directly in Activity, with sport, duration, and optional distance, effort, and notes, even when no Tempo session was planned; find it on the completion date in history and Calendar.
7. Import a recorded activity file through an explicit preview, preserve its source and completion time, and prevent duplicate imports without requiring a connected account.
8. Create personal race or event milestones, keep upcoming dates visible while planning, and review a result after the event.
9. Explicitly pair an imported activity with an eligible self-planned session on its source-local completion date, or keep it separate, and review actual versus planned duration.
10. Log a simple manual summary against an eligible self-planned session, or keep the activity separate, without building structured actual intervals.
11. Correct a saved manual activity from its outcome review; keep paired workout details fixed and keep imported file outcomes source-preserving.

When a saved template opens in Planner, preselect a cadence-valid range: a
Monday-to-Sunday week or the full calendar month. Show that range before
assignment and let the athlete choose a different start date.

The training log covers all completed work, whether it was planned in Tempo or
recorded manually afterward. Structured planned-versus-actual compliance
requires a real planned baseline and actual structured outcome; unplanned
entries never manufacture either. Imported summary metrics support duration-only
comparison when explicitly paired. Load is unavailable when no defensible TSS
was recorded, and load summaries must identify omissions instead of treating
them as measured zero. This follows
the established athlete training-log pattern ([Strava manual entry](https://support.strava.com/en-us/articles/15402188-how-do-i-upload-a-manual-activity-to-strava), [TrainingPeaks athlete features](https://www.trainingpeaks.com/athlete-features/)).

Manual distance is an optional athlete-entered value stored in meters and shown
in Activity and session review. Tempo never derives it from time, pace, or
another incomplete source. This complements the current duration-first logging
flow with the sport, time, and distance fields Strava provides in manual entry
([Strava manual activity entry](https://support.strava.com/en-us/articles/15402188-how-do-i-upload-a-manual-activity-to-strava)).

Activity file import should preserve a clear review step before saving and keep
source provenance and the recorded completion time. Supported inputs are TCX,
FIT, and GPX activity files. FIT files require Garmin's Activity file type, one
supported sport session, valid absolute start and finish timestamps, consistent
Activity and Session finish times, and a valid Activity local timestamp so the
source timezone and Calendar day are explicit. When FIT local time is absent or
invalid, reject the preview instead of guessing from the server timezone.
GPX files must contain one GPX 1.1 track with at least two valid, timed
trackpoints. The athlete chooses the sport because GPX does not provide a
dependable standard activity type. Require timestamps with an explicit time
zone (`Z` or a signed UTC offset), one consistent offset, and increasing times;
reject route-only files, multiple tracks, untimed points, and mixed offsets.
Derive duration from the first and last trackpoint times and
distance from consecutive points within each track segment. Keep only summary
metrics and provenance; discard raw file bytes, GPS coordinates, sensor time
series, and unknown fields after parsing. Imported summary metrics do not imply
training load or full planned compliance. This scope follows Strava accepting
GPX, TCX, and FIT and TrainingPeaks documenting completed device-file uploads
([Strava file formats](https://support.strava.com/en-us/articles/15402066-how-do-i-get-my-activities-to-strava), [TrainingPeaks upload](https://help.trainingpeaks.com/hc/en-us/articles/204072994-How-do-I-manually-upload-a-workout-file-into-TrainingPeaks), [TrainingPeaks compatible files](https://help.trainingpeaks.com/hc/en-us/articles/204070354-Compatible-Device-Files), [GPX 1.1 schema](https://www.topografix.com/GPX/1/1/), [Garmin FIT Activity decoding](https://developer.garmin.com/fit/articles/cookbook/decoding_activity_files.html)).

Preview may offer open, same-sport, same-source-local-date sessions owned by the
athlete when they are self-planned and have no Activity. The athlete explicitly
chooses one candidate or keeps the import separate; never infer a match. Pairing
completes the scheduled session atomically while preserving its title, date,
planned blocks, and existing baseline snapshot. If no baseline exists, capture
the plan before completion. Imported summary metrics do not create actual
intervals, compliance, or TSS. Paired review compares duration only; structured
actual comparison stays unavailable without an actual snapshot. Weekly ratios
that include imported summaries must be labeled as planned duration recorded,
not full workout compliance.

Manual logging may also attach to an eligible same-sport, same-date open
self-planned session by explicit athlete choice. Keep the separate-activity
option available and do not offer coach-assigned sessions. Save the entered
duration, optional distance, effort, and note atomically with completion while
preserving the planned workout and its baseline. A manual summary does not
create actual intervals or infer TSS; paired review reports duration only.

Athletes may correct a saved standalone manual activity's sport, title, date,
duration, distance, effort, and note. For a paired manual summary, corrections
apply only to the performed summary; the planned workout and its date remain
unchanged. Activity, session review, Calendar, and load history must reflect the
same saved values. Keep imported TCX/FIT/GPX outcomes tied to their source
records.

Personal event milestones are athlete-owned calendar records, separate from
planned workouts. Athletes may set an optional goal finish time and record
their actual finish time and note after the event. Show the next event on Home
and mark its date in Calendar. An athlete may explicitly link one or more of
their completed activities to an event; never infer a link. Keep event result
time and note independent of the linked Activity metrics, and allow either
record to remain or be removed on its own. Do not generate a training plan.
This scope follows TrainingPeaks event goals/results and explicit workout/event
association ([TrainingPeaks events](https://help.trainingpeaks.com/hc/en-us/articles/205076770-Events), [TrainingPeaks activity pairing](https://help.trainingpeaks.com/hc/en-us/articles/115002250311-How-can-I-pair-and-unpair-my-planned-and-completed-workouts), [Strava goals](https://support.strava.com/en-us/articles/15401694-goals-on-the-strava-app)).

Prioritize correctness, persistence, understandable empty/error states, and
usable desktop, mobile, and keyboard interactions across this loop. Verify
shared Planner source selection, date ranges, month navigation, and session
state handling before expanding scope. These are acceptance targets, not a
claim that all browser checks have passed.

Coach-only authoring, roster management, requests, and multi-athlete planning
are secondary work and do not define first-MVP completeness. Preserve existing
coach behavior and access boundaries when changing shared code. Fix shared
regressions and data/security issues regardless of role, but defer coach feature
expansion until personal use is complete or explicitly requested.

## Product Model

- A `Session` is structured content made from ordered workout blocks.
- Blocks provide sport, targets, duration, repetitions, notes, skipped state, and zone information.
- New effort blocks use the selected zone's target preset. Profile-backed running pace starts at the midpoint of the user's editable zone range; Olympiatoppen heart-rate targets use the user's BPM range for that zone. Numeric adjustments can move effort into another zone, and choosing a zone resets its preset. Relative profile targets remain generic in stored workouts so each user resolves them against their own profile.
- The performance profile stores maximum heart rate for Olympiatoppen I-1–I-5 boundaries and a recent running race distance/time to seed five editable pace ranges. Pace defaults use Tempo's race-speed bands, not Olympiatoppen-published pace bands; profile users can set the fastest and slowest min/km for each zone.
- Short pause blocks sit between efforts or repeated sets. They count toward elapsed time but do not contribute training load.
- Duration, training load, zones, and timelines are derived from structured blocks.
- `Workouts` stores private reusable definitions without dates or assignments.
- Personal `Calendar` combines week/month review with inline scheduling of independent copies. Coach `Planner` places content onto athlete dates or training-plan weekdays. Workouts can target multiple dates; routines apply their weekday pattern to a complete week or calendar month.
- Personal `Templates` groups saved workouts into a Monday–Sunday routine, with a name and optional purpose/notes. Multiple workouts may be ordered on a weekday; empty weekdays add nothing. Apply one routine to a Monday-starting week or repeat it through a whole calendar month. Template composition cannot author workout blocks.
- Routine saves capture server-owned library workout snapshots. Later library edits/deletions do not change saved routines; saving the routine again captures the selected library versions. Scheduled sessions are independent copies. Relative targets resolve against the person's Profile; absolute targets remain fixed.
- Templates only contain saved-workout routines. Block-backed templates, cadence settings, workout-editor template loading, coach template assignment and public template intake are removed. Public routine sharing and curated standard routines remain future work; public sharing supports individual workouts only.
- Completion stores performed metrics, notes, and the latest actual snapshot in `Activity`.
- Home separates scheduled structure by Session date from completed outcomes by
  Activity date. Standalone imports contribute only to completed totals; matched
  outcomes are counted once. Completed duration comes from the saved Activity,
  while scheduled duration comes from current workout blocks. These summaries
  do not claim comparison against the original baseline.
- Home's Recent session load shows the latest four activity estimates, not fitness
  change. Unknown imported load is distinct from a valid rounded zero, and partial
  totals identify unavailable load. Empty calendar dates mean nothing scheduled,
  not an explicitly planned rest day.
- Manually logged completed work is an athlete-owned, already-completed Session plus Activity. `Session.source` is `athlete-manual`; `Activity.metricsSource` is `manual-unplanned`. It has no workout blocks or planned baseline, and TSS is unknown unless load can be calculated from recorded facts.
- A device-file import is athlete-owned, previewed before save, and deduplicated per athlete by a stable file fingerprint. Keep only parsed metrics and provenance needed for training history; do not retain route coordinates by default.

## Current Capabilities

- Credentials authentication, direct personal signup, compatibility role setup for accounts without a role, and optional Google OAuth.
- Dormant coach roster, athlete detail, discovery and request services; current coach/discovery pages redirect to the personal workspace.
- Coach and athlete workout libraries with a shared visual editor.
- Coach planner, reusable training plans, source-copy assignment, and unified personal Calendar scheduling.
- Athlete Home, Calendar, Workouts, Session, Live, Activity, Profile, and Settings surfaces.
- Personal maximum-heart-rate and race-based pace zones that resolve in workout creation.
- Planned session adjustments, actual outcome editing, baseline and actual comparison, and completion.
- Explicit FIT, TCX, and GPX activity-file review and import, including optional matching to an unfinished planned session and recorded metric bars in the imported-activity workspace.
- Public sanitized workout snapshots with explicit authenticated intake.
- Athlete guided workout drafts from sport, length, effort, and interval choices, informed by the athlete's recent completed training. A configured model can author a complete validated workout; the standard pattern creator remains available when AI is unavailable or its output fails validation. The source is shown, and drafts are reviewed in the normal workout editor before saving.

## Capabilities and Constraints

- Live execution is a local block stepper; it does not collect device or sensor telemetry.
- Activity recording imports support both user-selected files and a Strava OAuth/webhook review flow. Users choose whether to import a Strava activity and may match it to an unfinished planned session.
- Messaging, multi-coach collaboration, shared business accounts, custom sports, and deep analytics are not implemented.
- Routine application repeats one weekly pattern over a chosen calendar month. Different patterns for successive weeks, open-ended recurrence, automatic progression and public routine distribution remain outside the current model. Application adds sessions alongside existing calendar content; it does not replace a plan.
- Public sharing exposes only a sanitized workout definition; it never exposes ownership, relationship, private notes, or actual data.

## Brand Commitments

The product uses the `Tempo` runtime name and direct task language. The established identity and visual commitments live in `DESIGN.md`; product documentation must not invent a competing brand or imply that coach involvement is required.

## Evidence on Hand

The repository contains implemented authenticated product routes, shared UI components, service-level tests, seeded demo accounts, and public design-direction previews. `README.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `docs/agent-workspace/CURRENT-STATUS.md` describe the current implementation and verification boundaries. No testimonials, customer claims, pricing, external benchmarks, or production-usage evidence are established and future work must not fabricate them.

## Product Principles

- Complete the self-directed training loop before expanding coach-only features.
- Keep reusable definitions separate from independently scheduled copies.
- Make persisted state, ownership, and authorization boundaries explicit and reliable.
- Keep the next training action understandable without requiring a coach or seeded content.
- Preserve truthful outcome data and never imply telemetry the product did not collect.

## Accessibility & Inclusion

Primary workflows must remain usable on desktop and mobile and through keyboard interaction. State must remain understandable without color alone, controls need visible focus, and reduced-motion preferences must preserve feedback without unnecessary movement.

## Account and recovery

Home offers inline training-target setup while maximum heart rate or selected
sport targets are incomplete. People choose running, cycling and/or swimming,
then save each step without leaving Home. Running supports a recent race result
or all five manually entered pace ranges; cycling uses FTP and swimming uses
CSS. Optional sport threshold heart rates remain optional. Unknown values may
be left blank and keep the guide available. Complete selected targets hide it;
subsequent target editing remains in Profile.

Profile separates training settings from Account controls. Users can inspect
sign-in methods, request credential recovery, manage Strava access and sign out
everywhere. Data downloads are deferred by product choice.

Account deletion prioritizes erasing personal data from the active database.
Password confirmation or a Google sign-in within five minutes is required.
Shared workout structure survives under owner `[deleted]`; identifying free
text is removed. Users can unshare all public links before deletion. This
does not retract other users' independent saved copies or erase their outcomes.
Provider outages must not postpone local erasure or retain credentials for retry.
Browser drafts on other devices and existing backups are outside this action;
actual operator retention/backup policy still needs to be established.

Workout and Profile changes have browser-only recovery for seven days. Live
checkpoints last 24 hours and restore paused; elapsed time is counted only by
explicit choice, with completion still explicit. Account-scoped drafts must not
overwrite another tab's work. Failed saves retain changes, new-workout retries
reuse their request identity, and stale edits must not silently replace newer
server content. Public privacy/support remains a release gate until operator
facts and retention policies are established. Email verification is deferred.

## Imported workout interpretation

People can explicitly request background interpretation for independently supplied
running files at import or from recorded session review. Show detected efforts and
recoveries, pooled average interval pace, likely intended structure, estimated
steady target and cautious training emphasis. Reuse colorful scheduled-workout
blocks with actual durations and visible intensity basis. Evidence remains
inspectable, missing measurements remain explicit, and user-confirmed intention
is separate from recorded performance and saved plans. Strava API imports are
excluded pending source permission. Initial segmentation is implemented;
accuracy optimization follows rather than blocking the complete workflow.
