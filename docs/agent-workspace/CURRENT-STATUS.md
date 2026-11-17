# Current status

Last verified locally on **2026-11-17**. Source code and tests are authoritative.
This is the current snapshot; ownership is in [WORK-INDEX.md](WORK-INDEX.md),
contracts in [ARCHITECTURE.md](../../ARCHITECTURE.md), and repeatable checks in
[VERIFICATION.md](../VERIFICATION.md).

## Verification

- `pnpm test:db`: **455 tests passed, zero skips**, using the disposable local
  PostgreSQL database. Tests use isolated schemas and synthetic records.
- `pnpm test:ui`: **2 Chromium component checks passed**, at 390px and 1440px.
  These cover SDK switch keyboard/disabled states, comparison selection, dialog
  focus containment/return, Escape, pending deletion, error retention and retry.
- `pnpm typecheck`, `pnpm check:deadcode` and `pnpm build` passed. The production
  build used local `tempo_dev`, with no pending migrations or schema changes.
- `pnpm lint` passed with seven warnings from the new Next rule about existing
  hard navigations in authentication/signout/share controls. Their behavior was
  preserved during dependency updates. The Node DEP0205 warning also remains.
- Local production HTTP acceptance passed credentials sign-in, roleless setup,
  same-role retry, JWT refresh and role boundaries after the Next/Auth.js update.
  Its temporary account was deleted. No production deployment or push occurred.
- Independent reviewers checked deleted-file callers, canonical persistence,
  datasource isolation and valid JSON client/response contracts. These checks
  do not certify the full authenticated browser journey or physical devices.

## Current implementation

- Tempo prioritizes self-directed personal training in the Athlete workspace.
  Coach pages redirect, while coach APIs retain their own authorization.
- WorkoutBuilder is the canonical authoring interface. Duplicate unmounted
  editors, their exclusive helpers and abandoned discovery UI were removed.
  Routed design previews and the active drag-and-drop dependencies remain.
- Canonical block persistence owns writes across athlete corrections and coach
  planner/library/training plans. Legacy integer targets round consistently;
  exact decimal strings, snapshots, repetitions and skipped state survive.
- Zod schemas validate unknown JSON at seven session/plan service entry points.
  Eleven routes no longer cast arbitrary objects to typed drafts. Malformed
  shapes return 400 before database access; semantic validation and ownership
  remain service-owned. Transport schemas do not coerce or invent defaults.
- UI SDK owns settings switches, session-removal alert dialogs, comparison
  selection and Strava inbox filters, retaining Tempo's tokens and explicit
  mutation controls. See [integration guidance](../UI-SDK.md).
- Personal sessions support completion, correction, rescheduling, removal,
  Skip and Plan again with ownership/status checks. Planner supports optional
  start times and warns about repeated placement of a source on selected dates.
- Personal Templates composes saved workouts into weekly routines. Routine JSON
  owns authoring; the schema still retains legacy columns/relations restored by
  a later migration. Public links publish workout definitions. An Athlete may
  explicitly save one into their library and a one-entry Monday routine.
- The mounted Import workspace accepts recorded FIT/TCX/GPX files up to 20 MB,
  previews before saving and persists normalized measurement series and optional
  laps for review. Raw uploads and GPS coordinates are not persisted. Older
  5 MB summary-only upload endpoints remain separate compatibility paths.
- Imported running workout interpretation is implemented: opt-in file analysis,
  measured segments/pooled pace, leased processing and correction. Model output
  is bounded by calculated evidence. Strava-derived records are excluded.
- Strava OAuth/inbox/webhook recovery is optional and owner-scoped; importing
  requires explicit review. Manual activities, event links, sanitized sharing,
  Profile targets, draft recovery and account deletion retain their owners.

## Maintenance tooling and dependencies

- Next.js/ESLint config 16.4.6, Auth.js 5.0.0-beta.32, Prisma pair 6.19.3,
  React/DOM 19.3.1, Tailwind pair 4.3.5 and compatible dependency updates passed
  the checks above. Removed unused bcryptjs type stubs and autoprefixer.
- Node >=24 and the pinned pnpm version are declared. Build/test/type commands
  generate Prisma explicitly; the unreliable schema-text cache was deleted.
- `test:db` validates the local disposable target and sets all child datasource
  variables to it. Seven runner safety tests include rejected targets, secret
  redaction and explicit/derived child-environment probes.
- Knip has explicit script/acceptance/UI-fixture entrypoints. The dead-code gate
  passes files, dependencies and import resolution. Full Knip also lists unused
  exports for case-by-case review; they were not blindly removed.
- Registry audit fell from 75 advisories to **one high advisory**, with zero
  critical/moderate/low findings. Prisma config pins deepmerge-ts 7.1.5; the
  patched version requires a major change. No speculative override was added.
  The advisory concerns recursive object graphs. No user objects enter this
  app's Prisma CLI config; request-level exploitability was not established.

## Remaining risks and acceptance gates

- Live Strava OAuth/delivery, retry, update/privacy/delete/deauthorization and
  provider-side account deletion need acceptance against the live provider.
- Resend password-reset email and optional Google OAuth need configured live
  acceptance. Auth.js provider-discovery outages previously redirected to its
  error page; that failure mode was not reverified after the update.
- Imported interpretation needs scheduler/live-model and full authenticated
  browser acceptance. The worker secret/schedule remains an operational gate;
  opportunistic after-response work is not guaranteed delivery.
- Before broad signup: public privacy/support information, server-side signup
  abuse controls and live-provider deletion acceptance remain open. Backup
  erasure and cross-device draft deletion are not implied by account deletion.
- Shared workout-to-routine intake uses two service saves. A failed routine save
  can leave its recipient-owned library copy; this flow is not atomic.
- Per-athlete time zones are not implemented. Calendar dates use server-local
  time except source-provenance rules on the separate legacy summary imports.
- Live countdown/progress is browser-local guidance, restores paused, does not
  sync across devices and does not record sensor telemetry or auto-completion.
- Physical iOS/Android, assistive technology, complete authenticated editing
  journeys and session-correction layout at 1440px remain distinct gates.
  Component fixture viewports do not establish route layout acceptance.
- Webpack is the verified production bundler. Previous Turbopack stalls were not
  investigated in this maintenance run. Production was not reverified; prior
  anonymous checks encountered deployment protection.
- The separate [account/recovery task](tasks/2026-09-30-account-recovery-home.md)
  retains its rollout/trust gates. Downloads and email verification are deferred.
