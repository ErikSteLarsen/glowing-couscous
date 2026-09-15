# Current Status

Verified on **2026-09-15** against the current source tree. Source and tests are
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

## Design Context

The current visual contract is documented in `DESIGN.md` and verified against
`app/globals.css`, `components/ui.tsx`, `components/AppShell.tsx`,
`components/AppSidebar.tsx`, `components/tempo/*`, and `components/WorkoutBuilder.tsx`.
The canonical direction is the light, editorial, Monday-first **Ink Is Movement**
studio, translated from the user's supplied ink-flow reference.
Routes under `/design/*` remain alternate visual previews and are not production
design sources. Indigo owns forward action and active context while blue-gray
linework carries focus and flow. The comparison dialog uses the defined overlay
shadow token. The installed Impeccable launcher has no `document` command, so the
sidecar is kept synchronized manually from the canonical contract and tokens.

## Verified Gates

| Gate | Result | Command or evidence |
|---|---|---|
| Tests | Pass, 186 tests | `pnpm test` on 2026-09-15 |
| Lint | Pass | `pnpm lint` on 2026-09-15 |
| Production build | Pass | `pnpm build` on 2026-09-15; Next.js reports the middleware-to-proxy deprecation warning |
| Database setup | Pass in current development work | `pnpm db:setup` with local SQLite |
| Design context | Pass | `DESIGN.md`, `.impeccable/design.json`, and the signed-in surface brief synchronized with Ink Is Movement tokens and shared components; focused workout builder presets, progressive basics, zone chart, and three workout-flow direction previews verified in source; detector completed with advisory-only findings |

## Capability State

- Authentication and role setup are active and covered by source-level tests.
- Coach roster, athlete detail, requests, planner, libraries, templates, and training plans are active implementation paths.
- Athlete Home, Calendar, Workouts, Planner, Templates, Session, Live, Activity, Profile, and Settings are active implementation paths.
- The canonical visual workout builder supports structured blocks, skipped blocks, repetitions, relative targets, and profile-aware previews without persisting profile values into generic prescriptions. Workout authoring now uses a focused library/editor mode, opens new workouts directly in the builder without a duplicate setup step, puts sport and name first, and collapses those basics into a compact editable header once complete. Five draggable presets per intensity zone, click insertion, and duration-by-zone bar charts remain available while preserving the inspector and keyboard reorder controls. Palette drags dropped outside the sequence are ignored, follow-up clicks from completed drags are suppressed, same-position sequence drops do not create a draft change, block removal is visible in the inspector, and saves preflight the canonical draft validator.
- The public `/design/workout-flow/flowline`, `/workbench`, and `/trail` routes share an interactive sample-data preview surface. They demonstrate connected sequencing, a persistent palette/workbench, and four-pass authoring with preset insertion, drag and explicit reorder controls, block inspection, undo/redo, and a Trail intention choice without changing production persistence.
- Three additional public Workbench experiments preserve the block library and Block details inspector while varying only the middle field: Terrain maps intensity to block height, Ribbon expands the duration-weighted color session across the full field and exposes a multi-selection tray, and Staging provides a temporary repeated-block shelf before moving a set into the final sequence.
- The workouts library and editor now distinguish unscheduled library versions from Planner copies and explain empty, search, save, delete, share, and editing states in direct task language; the shared builder uses context-specific labels for workout and template editing. The library is hidden while a workout is being authored so the builder has the full surface.
- Sharing is implemented with sanitized immutable snapshots and explicit recipient saves. Browser acceptance remains a gap.
- `lib/planner-service.ts` and the older coach session mutation route remain transitional compatibility code. Do not extend them for new behavior.
- The signed-in shell, shared UI primitives, session rows, authored ink-flow linework, and athlete Home now use the Ink Is Movement visual world without changing route or data behavior. Workspace navigation is owned by the sidebar and mobile bar; page headers keep only page-local or contextual actions instead of repeating sibling destinations.
- Authenticated `PageShell` routes now share one centered 1440px frame and a common left content anchor across narrow, default, wide, and wall page widths. `TopBar` reserves a shared 72px header band on all signed-in pages, including athlete Home, and owns one page-heading scale of 40px desktop and 34px mobile; Home's comparable section headings use the same shared 20px class. Planners, calendars, and workout libraries use the documented wall width instead of route-local maximums.

## Known Gaps

- Browser verification is still needed for public share previews, the six workout-flow direction and Workbench experiment previews, some session mutation flows, and physical pointer/touch acceptance of the workout builder and preview presets.
- Credentials flows are locally covered; external OAuth integration is not.
- Live execution is a local guidance stepper and does not collect device or sensor telemetry.
- Next.js reports a middleware-to-proxy deprecation warning; this is not currently a build failure.
- The design detector reports advisory literal colors, radii, and sizes in the
  scoped `/design/*` direction previews, workout/editor and preset/chart label
  sizes, responsive editorial type values, shared compact controls, and Calendar
  labels; no blocking findings were reported.
