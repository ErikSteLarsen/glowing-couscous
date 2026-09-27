+# Mobile readiness investigation

**Reviewed:** 2026-09-27
**Purpose:** Document the current mobile experience and the gaps to turn into an implementation plan.
**Scope:** Production routes for both roles, shared authenticated shell, public/auth pages, and the core personal training workflow. Internal /design/* explorations are inventoried but are not production acceptance surfaces.

## Executive assessment

Tempo already has a thoughtful responsive foundation. It uses a mobile drawer plus four-item bottom navigation, fluid page frames, horizontal week navigation, container-responsive workout editing, a narrow Planner layout, and a pinned Profile save bar. The app generally reflows the same capabilities instead of removing them.

The current product is **partially mobile-ready, but not yet verified well enough to call every route and task usable on mobile**. The most actionable confirmed concerns are small muted text that misses WCAG AA contrast and the Planner’s narrow day buttons at a 320px viewport. The largest confidence gap is that the September 27 Workouts and Activity layout changes have only been checked in empty states, not in a mobile viewport. Import, share, coach, and several populated session states also lack a fresh all-route mobile pass.

No production UI was changed during this investigation.

## Impeccable audit snapshot

This is a provisional source-and-history score, not a release certification. The run used the Impeccable audit and adapt guidance, current source, the project’s recorded browser evidence, and a targeted detect --json scan of production routes and active shared components. It did not include a new browser session, physical device, route-wide axe run, or mobile performance trace.

| Dimension | Score | Evidence |
|---|---:|---|
| Accessibility | 2/4 | Strong shared labels, focus styles, keyboard alternatives, and a current main landmark owner; small muted calendar and navigation text still misses 4.5:1 contrast. |
| Performance | 3/4 | No major static performance defect found. Large activity files and chart-heavy states have not been profiled on a phone. |
| Responsive design | 2/4 | Many deliberate mobile layouts and useful earlier 390px checks; the newest Workouts/Activity states and the 320px Planner target still need direct validation. |
| Theming | 3/4 | A coherent semantic token system; Impeccable found 11 advisory type-ramp deviations in the focused production scan. |
| Implementation integrity | 3/4 | Shared visual and behavior owners are in place. No blocking detector findings; the review found mobile-specific evidence gaps and a few narrow-screen risks. |
| **Total** | **13/20** | **Acceptable, with significant verification and accessibility work remaining.** |

### Impeccable detector

The focused detector run returned **11 advisory findings**, all design-system-font-size; it returned no blocking findings. They are in Calendar/Home headings and labels, Live timer typography, SessionRow, and shared page-heading classes. The 60px/84px Live timer and 40px/34px page heading values are intentional uses of prominent hierarchy, so these findings are not mobile defects by themselves. Review the small supporting values in context, but do not mechanically resize all metrics to satisfy the detector.

The detector is not a viewport simulator: it did not report the Planner’s cell width, touch ergonomics, mobile keyboard behavior, or horizontal clipping.

## What the current app does on mobile

### Shared shell

- Below 768px, the desktop sidebar becomes a focus-managed drawer. A fixed bottom bar exposes Home, Calendar, Workouts, and Planner; Templates, Activity, Import, Profile, and Settings remain reachable through the drawer/profile menu.
- The drawer supports Escape, restores focus, contains keyboard focus, and isolates the page while open. Bottom-bar items and drawer links use at least 44px height.
- The shared page frame stays fluid with 20px mobile gutters. Page headings stack with their actions at narrow widths. Main content reserves room for bottom navigation, and the fixed Profile save bar accounts for the mobile bar and safe-area inset.
- Home turns the week into a horizontal, scroll-snapping channel. This is an intentional mobile interaction, but its ability to signal additional off-screen days should be checked on touch devices.
- The app shell clips horizontal overflow to contain its decorative backdrop. A future overflow check should measure document and content widths directly; the absence of a scrollbar alone is not enough to prove content is not clipped.

### Route and capability inventory

| Routes | Current mobile treatment | State to validate in the next pass |
|---|---|---|
| /, /login, /signup, /setup | Authentication uses its own centered, fluid reading-width shell; shared fields are full-width and 40px tall. | Narrow keyboard-open forms, password manager/autofill, error and success feedback, and iOS focus behavior. |
| /athlete (Home) | Week changes from a wall to a horizontal day channel; empty-state actions remain available. | Empty and populated weeks, long workout titles, off-screen day discoverability, and the next-action hierarchy at 320–430px. |
| /athlete/calendar | Week/month views remain available. The week uses a horizontal scroller; the month keeps seven columns and reduces visual density. | Month labels, date/session links, status contrast, 320px width, landscape, and whether the week scroller reads as horizontally movable. |
| /athlete/workouts, /coach/workouts | The library is one column on narrow content, two columns from 560px, and three from 900px. The shared editor reflows to one column below a 720px container; its palette becomes a horizontal strip and the inspector moves below the chart. | The September 27 library redesign in empty and populated states; a long workout draft, edit/save/error paths, 320px controls, and touch scrolling versus chart dragging. Coach sharing actions need the same shared-component regression check. |
| /athlete/templates, /coach/templates | Both use the shared template library/editor and canonical workout builder. The editor exposes cadence, block editing, save, and reuse actions. | Day/week/month editing at phone width, validation messages, long template names, keyboard-open forms, and coach-only share actions. |
| /athlete/planner, /coach/planner | The shared Planning Desk stacks source, selected-day details, and calendar at narrow widths. It keeps a seven-column month; below 600px of container width, session names are hidden in cells and counts remain. | Day selection, multi-date placement, exact template ranges, source tabs, removal/recovery, and touch target size at 320px. The shared change must preserve coach assignment behavior. |
| /athlete/session/[sessionId] | Session summary and ordered workout blocks use the shared session language; imported sensor measurements appear after plan context. | Planned, adjusted, completed, and imported states; expandable metric tables; comparison dialog; and all return paths. |
| /athlete/live/[sessionId] | A large current-block timer and local countdown stepper prioritize session execution; controls remain in the session flow. | Real phone wake/sleep/resume, portrait and landscape, reachable controls with the browser chrome present, and completion/error announcements. Live is a guidance stepper, not device telemetry. |
| /athlete/activity | Completed outcomes use an open summary/history layout rather than a dense dashboard. The page was recently restructured. | The latest populated history rows, notes, long labels, session links, and empty state at mobile widths. The recent browser check only covered an empty-data state. |
| /athlete/import | File review and Strava import share one route. File selection uses the native picker; review fields stack; prior imports and metric details progressively disclose. Up to 10 files of 20MB each can be selected, parsed serially in the browser. | Native file picking on iOS/Android, a maximum-size file, a multi-file batch on a lower-memory phone, Strava review/OAuth return, long history, expanded chart tables, and import/delete feedback. |
| /athlete/profile, /profile, /settings | Profile save state stays in a viewport-pinned footer above mobile navigation with space reserved after the form. Settings shares the compact account frame. | Keyboard-open footer/form overlap, safe-area behavior, long validation errors, unsaved/saving/error states, and preference controls. |
| /athlete/find-coach, /coach, /coach/athletes/[athleteId] | Discovery, roster, and athlete detail use the shared page frame and drawer; coach features remain secondary but supported. | Long rosters, search/requests, athlete detail actions, and mobile return-to-Planner context. Do not regress these while editing shared owners. |
| /share/[token] | Public sanitized workout/template snapshots are separate from the authenticated shell. | Shared workout and template previews at 320–390px, long content, and authenticated intake. The project index still records public share browser acceptance as open. |
| /coach/builder, /athlete/imported-activities, /profile | Compatibility aliases or redirects; the first two resolve to current routes. | Check that redirect destinations remain usable and preserve the relevant context. |
| /design/* | Sample-data visual experiments have their own responsive behaviors. | Excluded from production MVP acceptance unless one is explicitly promoted into the product. |

## Prioritized findings

### P1 — Muted calendar and navigation labels miss WCAG AA contrast

The active CSS defines muted text as #7F8588 on paper #F5F4EF, which calculates to **3.40:1**. The inactive mobile navigation text is #65717A on #F1F0EB, which calculates to **4.39:1**. Both are below WCAG 2.2 SC 1.4.3’s 4.5:1 requirement for normal text. The affected labels include small weekday, date, and navigation text; they do not meet the large-text exception. This matches the older axe finding recorded in the work index.

**Next:** darken the applicable semantic text tokens or use a stronger text role on essential labels, then recheck all roles and states against actual backgrounds. Keep color-only status cues out of the fix.

### P1 — Planner date buttons get too narrow on a 320px viewport

The Planner always renders seven columns. At a 320px viewport, 20px page gutters and 16px calendar insets leave about 248px for the grid, or roughly **35px per date button**. At 390px, the same calculation is about 45px. The cells remain identifiable and keyboard-labeled, but the 320px targets are cramped for thumb selection in the core scheduling task.

**Next:** test 320px on device, then choose a mobile date-selection treatment if needed—such as a compact week/day selection mode that keeps the current month context and selected-day details. Keep the full month available as a useful navigation view.

### P1 — Current mobile acceptance evidence does not cover the current product state

The latest status says the new Workouts and Activity layouts were checked in empty states only; their populated and mobile renders remain unverified. Import/Strava review, public share, populated session/live states, 320px, landscape, and physical touch behavior also lack a fresh end-to-end pass. A 390px result from September is useful history, but it cannot certify later changes or every route.

**Next:** use an isolated local or preview dataset and run a route/state matrix before treating mobile readiness as complete. Do not use the configured remote database to create review fixtures.

### P2 — Compact controls are often 32–40px on touch surfaces

The shared design intentionally uses 32px compact controls in dense toolbars. The Planner’s previous/next month buttons are 32×32px; other removal, editor, and menu controls also use compact sizes. These are above WCAG 2.2 SC 2.5.8’s 24px minimum, but fall short of Impeccable’s 44px mobile ergonomics target and are difficult to operate where controls are close together.

**Next:** identify which compact controls appear in frequent mobile tasks and enlarge only those on coarse pointers or narrow containers. Preserve dense desktop layouts and keep destructive actions visually distinct.

### P2 — Mobile runtime and browser-chrome cases are not measured

Activity files are parsed on the client, in sequence, and the UI allows a batch of up to ten 20MB files. Serial parsing limits simultaneous parser work, but retained samples, chart rendering, and browser memory still need a low-end device check. The fixed Profile footer, bottom navigation, form keyboard, safe area, landscape, and browser chrome also need direct device review.

**Next:** profile the largest realistic import and exercise keyboard/safe-area states on one iPhone Safari and one Android Chrome device.

### P3 — Type-ramp advisories need intentional review

The 11 Impeccable warnings are advisories, not responsive failures. Most are semantic display or metric exceptions. Review small 10–14px supporting labels and their contrast as part of accessibility work; do not turn this into indiscriminate typography normalization.

## Evidence already recorded

| Date and evidence | What it establishes | What it does not establish |
|---|---|---|
| 2026-09-18: 56 athlete/coach route-viewport checks at 1280×720, 1366×768, 1920×1080, and 390×844. Planner, Templates, and Calendar screenshots were compared. | The captured routes had no reported horizontal overflow at those widths; mobile page scrolling and core Planner selection were checked. | It did not claim that every page fit in one viewport. Public sharing and populated session/live pages were not reverified in that pass. |
| 2026-09-18: fresh-account personal workflow passed through scheduling, live execution, completion, correction, comparison, and Activity; a 390px Planner viewport had no horizontal overflow. | Strong end-to-end evidence for the personal path at that recorded state. | It does not exercise all current route states or physical touch. |
| 2026-09-24: authenticated workout builder/library checks at 390px and desktop widths covered creation controls and editor layout. | The core builder reflow and the library header had focused mobile review at that point. | It predates the 2026-09-27 library/history restructuring and did not cover every mobile route. |
| 2026-09-27: Workouts and Activity loaded in an authenticated empty-data browser state. | Empty states and basic page load were visible. | Populated data and mobile rendering were explicitly not verified. |

The current PageShell source renders a main landmark, so the older axe report’s missing-main finding should be rechecked on the exact route/state before carrying it forward. The older report also mentioned template ARIA-role findings; this investigation did not rerun axe and does not claim those are fixed. The current contrast calculation above is independently reproducible from the active CSS values.

## Recommended handoff for the implementation-planning step

1. **Lock a safe baseline.** Prepare isolated athlete/coach fixtures with empty and populated states. Capture a route inventory, browser/OS targets, device widths, orientation, and current known gaps. Avoid using production or a remote user database for test content.
2. **Plan the shared accessibility and touch pass.** Prioritize the muted text tokens, the 320px Planner date interaction, and controls that need larger hit areas on coarse pointers. Agree the target-size rule and how exceptions are justified.
3. **Plan the athlete critical path first.** Review Home → Workouts/editor → Planner → Calendar/session → Live → Activity. For each screen, choose what stays visible, what becomes a disclosure, and where the main action sits under one-handed use. Preserve all core create, schedule, complete, and review operations.
4. **Plan the remaining production surfaces.** Cover Templates, Import/Strava, Profile/Settings, Find coach, coach roster/detail/planning, authentication, and public sharing. Keep coach role and authorization behavior intact in shared components.
5. **Set acceptance gates before implementation.** Test 320, 360, 390, and 430px portrait; phone landscape; 768px tablet; and desktop. Include 200% zoom/text scaling, keyboard open, long content, empty/populated/pending/error states, VoiceOver or TalkBack spot checks, keyboard navigation, and physical touch on iOS Safari and Android Chrome. Check horizontal clipping by measuring content width and inspecting edges, not by relying only on a hidden scrollbar.

### Acceptance definition for a later implementation

- Every primary product task can be completed on phone without unreachable actions, accidental drag-only interactions, clipped fields, or state hidden behind the bottom bar/keyboard.
- Small text meets 4.5:1 contrast; status remains understandable without color alone.
- Frequent touch actions meet a 44px target where the layout permits, with intentional, spaced exceptions documented.
- Narrow and landscape layouts keep the current task context and a clear next action.
- Populated as well as empty states pass on real iOS and Android browsers, including the self-directed create → schedule → execute → complete → review flow.

## Method and limits

Reviewed README.md, ARCHITECTURE.md, PRODUCT.md, DESIGN.md, CURRENT-STATUS.md, and WORK-INDEX.md; inspected the production route inventory, shared shell, responsive tokens, Planner, workout editor, import, and metric-chart owners; and used Impeccable’s audit/adapt guidance plus its targeted detector. The active repository’s configured database URL is remote, and no isolated authenticated mobile browser session was available in this turn, so I did not connect to it or claim new route screenshots. No UI code, tests, lint, or build were run or changed for this report.

## Source map

- Product and acceptance: [PRODUCT.md](../../PRODUCT.md)
- Routes and ownership: [ARCHITECTURE.md](../../ARCHITECTURE.md)
- Visual contract: [DESIGN.md](../../DESIGN.md)
- Shared shell and controls: [AppShell.tsx](../../components/AppShell.tsx), [AppSidebar.tsx](../../components/AppSidebar.tsx), [ui.tsx](../../components/ui.tsx), [app-navigation.ts](../../lib/app-navigation.ts)
- Responsive rules: [globals.css](../../app/globals.css)
- Planner: [PlannerDesk.tsx](../../components/PlannerDesk.tsx)
- Workout authoring: [WorkoutBuilder.tsx](../../components/WorkoutBuilder.tsx), [WorkoutCanvasEditor.tsx](../../components/WorkoutCanvasEditor.tsx), [workout-canvas.css](../../components/design/workout-canvas.css)
- Activity imports and charts: [ActivityImportClient.tsx](../../components/ActivityImportClient.tsx), [ActivityMetricBars.tsx](../../components/tempo/ActivityMetricBars.tsx), [ActivityMetricPreview.tsx](../../components/ActivityMetricPreview.tsx)
- Current evidence and ownership index: [CURRENT-STATUS.md](CURRENT-STATUS.md), [WORK-INDEX.md](WORK-INDEX.md)
