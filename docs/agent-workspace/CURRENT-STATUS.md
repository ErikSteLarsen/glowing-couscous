# Current Status

Implementation verification last recorded on **2026-09-18**. The functional repair plan is complete and verified locally. Source and tests are the authority; this file is a short operational snapshot, not a changelog.

## Product

Workout Planner is a Tempo-aligned personal training planner with optional coach collaboration. The live app
supports credentials authentication, optional Google OAuth, coach and athlete
roles, Monday-based planning, structured workout blocks, reusable libraries and
templates, independent source-copy assignment, completion history, local live
execution, session outcome comparison, and sanitized workout sharing.

The current ownership split is important:

- Workouts stores reusable owner-scoped definitions without dates or assignments.
- Planner creates independent dated copies from those definitions.
- Calendar and session detail own scheduled-session context.
- Templates and training plans remain separate reusable source types.

## Current MVP Focus

Complete the self-directed workflow in PRODUCT.md: a fresh user with no coach
or seeded content can create reusable workouts/templates, schedule their own
sessions, follow and complete them, and review saved outcomes. The existing
Athlete role is the personal workspace.

The personal Planning Desk, session completion, and Activity path now pass the fresh-account acceptance journey, including repeated-workout placement, rescheduling, live execution, completion, actual correction, comparison, persistence, and mobile layout. Coach-only gaps remain secondary; preserve existing coach functionality while improving shared owners.

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
| Tests | Pass, 196 tests | pnpm test on 2026-09-18 |
| Lint | Pass | pnpm lint on 2026-09-18 |
| Production build | Pass | pnpm build on 2026-09-18; existing middleware deprecation warning remains |
| Database setup | Pass in current development work | `pnpm db:setup` with local SQLite |
| Design context | Pass | `DESIGN.md`, `.impeccable/design.json`, and the signed-in surface brief synchronized with Ink Is Movement tokens and shared components; focused workout builder presets, progressive basics, zone chart, and three workout-flow direction previews verified in source; detector completed with advisory-only findings |
| Button standardization | Pass | Shared standard/compact/ghost tiers now use 40px/32px targets with 13px/12px sentence-case labels; compact controls are shadow-free, navigation uses ghost controls, and segmented controls plus production utility controls use the same sizing and focus rules; detector completed with advisory-only type-ramp findings |
| Browser workflow verification | Pass | Headless Chromium completed the personal plan-to-Activity journey at desktop and 390px mobile widths on 2026-09-18 |
| Input field standardization | Pass with known a11y gaps | Shared inputs/selects now use 40px height, 13px text, 3px radius, shared inset depth, and shared focus treatment; textareas retain extra writing room; browser-checked login and template editor at desktop/mobile widths; axe found no field-specific failure |
| Form action rhythm | Pass with known a11y gaps | Actions that submit, cancel, clear, copy, or delete alongside 40px fields now use the matching standard 40px tone; compact sizing remains for dense toolbars, menus, list rows, and navigation; template filter/editor and athlete/coach planner actions checked at desktop/mobile widths; danger token now clears the standard action contrast threshold |

## Capability State

- Authentication and role setup are active and covered by source-level tests.
- Coach roster, athlete detail, requests, planner, libraries, templates, and training plans are active implementation paths.
- Athlete Home, Calendar, Workouts, Planner, Templates, Session, Live, Activity, Profile, and Settings are active implementation paths.
- The canonical visual workout builder supports structured blocks, skipped blocks, repetitions, relative targets, and profile-aware previews without persisting profile values into generic prescriptions. Workout authoring now uses a focused library/editor mode, opens new workouts directly in the builder without a duplicate setup step, puts sport and name first, and collapses those basics into a compact editable header once complete. Five draggable presets per intensity zone, click insertion, and duration-by-zone bar charts remain available while preserving the inspector and keyboard reorder controls. Palette drags dropped outside the sequence are ignored, follow-up clicks from completed drags are suppressed, same-position sequence drops do not create a draft change, block removal is visible in the inspector, and saves preflight the canonical draft validator.
- The public `/design/workout-flow/flowline`, `/workbench`, and `/trail` routes share an interactive sample-data preview surface. They demonstrate connected sequencing, a persistent palette/workbench, and four-pass authoring with preset insertion, drag and explicit reorder controls, block inspection, undo/redo, and a Trail intention choice without changing production persistence.
- The public `/design/planner/field`, `/atlas`, and `/dispatch` routes share an interactive synthetic-data preview surface. Field is a week-first drop wall, Atlas is now a comparison index for Select days, Template range, and Planning desk month-planning directions, and Dispatch is a multi-day source queue; the revised Atlas directions support workout multi-selection, template range validation, source search tabs, selected-day session detail, and exact-workout preview navigation without changing planner persistence.
- Production `/coach/planner` and `/athlete/planner` now use the shared `components/PlannerDesk.tsx` month-first assignment surface. Workouts can be assigned to multiple selected dates, templates require exact cadence-length ranges, coach training plans retain Monday anchoring, selected-day sessions link into existing session/athlete context, and the old coach source panel plus week/form composition were removed.
- Three additional public Workbench experiments preserve the block library and Block details inspector while varying only the middle field: Terrain maps intensity to block height, Ribbon expands the duration-weighted color session across the full field and exposes a multi-selection tray, and Staging provides a temporary repeated-block shelf before moving a set into the final sequence.
- The workouts library and editor now distinguish unscheduled library versions from Planner copies and explain empty, search, save, delete, share, and editing states in direct task language; the shared builder uses context-specific labels for workout and template editing. The library is hidden while a workout is being authored so the builder has the full surface.
- Planner is now source-only for both roles: it places saved workouts and templates on selected dates, normalizes week/month templates to their planning anchors, assigns coach training plans, and keeps authoring in Workouts or Templates. Existing planned sessions can be reviewed and removed from Planner without reopening the workout creator.
- Sharing is implemented with sanitized immutable snapshots and explicit recipient saves. Browser acceptance remains a gap.
- `lib/planner-service.ts` and the older coach session mutation route remain transitional compatibility code. Do not extend them for new behavior.
- The signed-in shell, shared UI primitives, session rows, authored ink-flow linework, and athlete Home now use the Ink Is Movement visual world without changing route or data behavior. Workspace navigation is owned by the sidebar and mobile bar; page headers keep only page-local or contextual actions instead of repeating sibling destinations.
- Production buttons now use the shared primary, secondary, danger, compact, and ghost tiers. Standard actions use 40px targets with quieter 13px labels; dense controls use 32px targets with 12px labels, and page-header/navigation actions use the lighter compact or ghost tiers. Content-rich workout preset cards remain an explicit editor exception.
- Production inputs and selects now use the same 40px/13px rhythm as standard actions, while textareas keep a roomier writing height. Route-specific labels and the legacy block editor now reuse the shared field treatment instead of introducing larger radii or typography.
- Form actions now follow the same 40px rhythm when they operate on a field: filtering/creation, editor save/cancel, planner create/delete, session adjustment, recovery, and share-link copy actions are standard-sized. Dense command bars, menus, calendar navigation, and repeated list actions intentionally remain 32px.
- Workspace pages now use one 1800px maximum frame with no per-route width variants. Shared `--page-*` tokens in `app/globals.css` own 20/24/32px gutters, 24px top padding, a 96px header band, and a 16px section gap. `TopBar` top-aligns headings; authentication uses `AuthPageShell`. Planner gives its complete seven-column month priority and adapts source/selection rails to available width.

## Verified Preview Gates

| Gate | Result | Command or evidence |
|---|---|---|
| Planner direction previews | Pass | Playwright Chromium checked the three public preview routes at 1440px desktop and the Field route at 390px; explicit source selection, multi-day placement, and pointer drag/drop passed against the rebuilt bundle with no page or console errors; captures are in `.impeccable/review/planner/` |
| Atlas assignment directions | Pass with browser gap | `pnpm test`, `pnpm lint`, and `pnpm build` pass; HTTP smoke checks returned 200 for the Atlas index, Select days, Template range, Planning desk, and exact-workout preview routes; no browser executable is available in the current environment for interaction capture |
| Production Planning Desk | Pass | 196 tests, lint/build, clean Impeccable detector, authenticated multi-date placement, exact template ranges, mobile width, retry replay, and concurrent same-key requests pass |

## Running Layout Verification — 2026-09-18

The local app at `http://localhost:3000` runs from `C:/Users/Erik/koding/glowing-couscous`, not the separate WSL task checkout. Layout-only changes were applied to this Windows checkout; existing PRODUCT.md and .impeccable/design.json edits were preserved, and unrelated WSL functional changes were not imported.

- `pnpm test`: 188 tests pass. `pnpm lint`: pass.
- `pnpm build`: blocked at Prisma generation by the running Windows server holding query_engine-windows.dll.node open (EPERM). `pnpm exec next build`: pass with the existing generated client; no schema changes were made. Existing middleware deprecation warning remains.
- Chromium against the actual `localhost:3000`: 56 athlete/coach route-viewport checks passed at 1280×720, 1366×768, 1920×1080, and 390×844. Desktop titles start at y=24, page content at y=136, with shared left/right frame boundaries. Complete six-week Planner fits desktop height, date selection works, and checked pages have no horizontal overflow.
- Planner, Templates, and Calendar screenshots were compared directly. Mobile retains natural page scrolling; checks do not claim that all content of every page fits one viewport. Public sharing and populated session/live pages were not reverified in this pass.
- UI detector reported 69 advisory findings and no blocking findings, primarily existing typography/radius values.
## Known Gaps

- Browser verification is still needed for public share previews, the six workout-flow direction and Workbench experiment previews, some session mutation flows, and physical pointer/touch acceptance of the workout builder and preview presets.
- Browser verification is still needed for the revised Atlas directions, including multi-date workout selection, template range validation, source search tabs, selected-day drill-down, and responsive layout behavior.
- Credentials flows are locally covered; external OAuth integration is not.
- Live execution is a local guidance stepper and does not collect device or sensor telemetry.
- Next.js reports a middleware-to-proxy deprecation warning; this is not currently a build failure.
- The design detector reports advisory literal colors, radii, and sizes in the
  scoped `/design/*` direction previews, workout/editor and preset/chart label
  sizes, responsive editorial type values, shared compact controls, and Calendar
  labels; no blocking findings were reported.
- `agent-browser` axe checks on authenticated Calendar and Templates found
  existing muted navigation/calendar text below the 4.5:1 contrast threshold
  and missing `main`/region landmarks. These are outside the button density
  change and should be addressed in a separate accessibility pass.
- The template editor axe check also reports two existing ARIA-role issues on
  non-role containers, low contrast on the drag-handle text and share-link
  helper copy, and the same missing landmark coverage. The danger action token
  was darkened during form-action alignment and no longer appears in that
  contrast result. These remaining findings are separate from the field and
  action-rhythm work.

## Functional Repair Verification — 2026-09-18

All prioritized repairs are on main. The final gates pass under WSL with Node 24.8.0: 196 tests, lint, and production build. Next.js still reports the existing middleware-to-proxy deprecation warning.

Fresh-account Chromium acceptance covered a repeated workout showing 20 minutes for a 300-second block repeated four times, multi-date Planner placement, self-planned editing and cross-date rescheduling, live execution, completion, actual correction, Planned/Actual comparison, Activity review, persisted authentication, and a 390px Planner viewport without horizontal overflow. Earlier focused checks covered exact week/month template selection, empty source tabs, placement/removal feedback, reduced motion, pointer insertion, undo/redo, and mobile builder layout. Physical-device touch remains unclaimed.

The additive PlacementRequest migration was applied to the existing development SQLite database without reset. Same-key replay returned the original IDs, two concurrent identical API requests both returned the same two session IDs, different payload reuse is rejected, user scopes are isolated, and a simulated mid-batch failure rolls back sessions, plans, and the request reservation. Impeccable detectors returned no findings for the changed production UI files.
