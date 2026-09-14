# Current Status

Verified on **2026-09-14** against the current source tree. Source and tests are
the authority; this file is a short operational snapshot, not a changelog.

## Product

Workout Planner is a Tempo-aligned coach-athlete training planner. The live app
supports credentials authentication, optional Google OAuth, coach and athlete
roles, Monday-based planning, structured workout blocks, reusable libraries and
templates, independent source-copy assignment, completion history, local live
execution, session outcome comparison, and sanitized workout sharing.

The current ownership split is important:

- Workouts stores reusable owner-scoped definitions without dates or assignments.
- Planner creates independent dated copies from those definitions.
- Calendar and session detail own scheduled-session context.
- Templates and training plans remain separate reusable source types.

## Verified Gates

| Gate | Result | Command or evidence |
|---|---|---|
| Tests | Pass, 181 tests | `pnpm test` on 2026-09-14 |
| Lint | Pass | `pnpm lint` on 2026-09-14 |
| Production build | Pass | `pnpm build` on 2026-09-14; Next.js reports the middleware-to-proxy deprecation warning |
| Database setup | Pass in current development work | `pnpm db:setup` with local SQLite |

## Capability State

- Authentication and role setup are active and covered by source-level tests.
- Coach roster, athlete detail, requests, planner, libraries, templates, and training plans are active implementation paths.
- Athlete Home, Calendar, Workouts, Planner, Templates, Session, Live, Activity, Profile, and Settings are active implementation paths.
- The canonical visual workout builder supports structured blocks, skipped blocks, repetitions, relative targets, and profile-aware previews without persisting profile values into generic prescriptions.
- Sharing is implemented with sanitized immutable snapshots and explicit recipient saves. Browser acceptance remains a gap.
- `lib/planner-service.ts` and the older coach session mutation route remain transitional compatibility code. Do not extend them for new behavior.

## Known Gaps

- Browser verification is still needed for public share previews and some session mutation flows.
- Credentials flows are locally covered; external OAuth integration is not.
- Live execution is a local guidance stepper and does not collect device or sensor telemetry.
- Next.js reports a middleware-to-proxy deprecation warning; this is not currently a build failure.
