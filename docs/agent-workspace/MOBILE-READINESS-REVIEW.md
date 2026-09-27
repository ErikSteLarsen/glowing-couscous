# Mobile readiness investigation and implementation review

**Reviewed:** 2026-09-27
**Purpose:** Document current mobile behavior, findings, the implemented phone-only adjustments, and the remaining release checks. Verification details are recorded in `CURRENT-STATUS.md`.
**Scope:** Production routes for both roles, shared authenticated shell, public/auth pages, and the core personal training workflow. Internal /design/* explorations are inventoried but are not production acceptance surfaces.

## Executive assessment

Tempo already has a thoughtful responsive foundation. It uses a mobile drawer plus four-item bottom navigation, fluid page frames, horizontal week navigation, container-responsive workout editing, a narrow Planner layout, and a pinned Profile save bar. The app generally reflows the same capabilities instead of removing them.

The app had a responsive foundation but the key phone workflow made users switch between Calendar and Planner, hid History, and depended on a dense workout chart. The reviewed plan has now been implemented within the phone layout: athlete navigation groups related tasks, Home and Calendar lead into planning, the Planner uses a touch-sized week strip, workout editing has a tap-first block list, and History has a compact phone summary. Mobile text contrast and common touch target sizes were also corrected without changing desktop tokens or layouts. Activity already included full history, period and sport filters, totals, and outcome links, so no pagination or service changes were appropriate.

The plan was rechecked against commit `d7b7ffe` and the newest source before implementation. The completed changes keep existing routes, permissions, data services, and desktop presentation. A final authenticated visual pass covered the 320px and 390px Planner layouts with local synthetic data and the 1280px desktop Planner layout. Physical iOS/Android, native keyboard, populated live database routes, and device performance checks remain open; they are listed below rather than inferred from the browser preview.

## Baseline Impeccable audit snapshot

This is the source-and-history score from before the mobile implementation, not a current release certification. The run used Impeccable audit and adapt guidance, recorded browser evidence, and a targeted `detect --json` scan of production routes and active shared components. It did not include physical-device testing, a route-wide axe run, or a mobile performance trace.

| Dimension | Score | Evidence |
|---|---:|---|
| Accessibility | 2/4 | Strong shared labels, focus styles, keyboard alternatives, and a current main landmark owner; baseline small muted calendar and navigation text missed 4.5:1 contrast. |
| Performance | 3/4 | No major static performance defect found. Large activity files and chart-heavy states have not been profiled on a phone. |
| Responsive design | 2/4 | Many deliberate mobile layouts; the baseline 320px Planner and phone editor still needed direct touch-first treatment. |
| Theming | 3/4 | A coherent semantic token system; Impeccable found 11 advisory type-ramp deviations in the focused production scan. |
| Implementation integrity | 3/4 | Shared visual and behavior owners are in place. No blocking detector findings; the review found mobile-specific evidence gaps and a few narrow-screen risks. |
| **Total** | **13/20** | **Acceptable baseline, with implementation and device verification work remaining.** |

### Impeccable detector

The focused detector run returned **11 advisory findings**, all design-system-font-size; it returned no blocking findings. They are in Calendar/Home headings and labels, Live timer typography, SessionRow, and shared page-heading classes. The 60px/84px Live timer and 40px/34px page heading values are intentional uses of prominent hierarchy, so these findings are not mobile defects by themselves. Review the small supporting values in context, but do not mechanically resize all metrics to satisfy the detector.

The detector is not a viewport simulator: it did not report the Planner’s cell width, touch ergonomics, mobile keyboard behavior, or horizontal clipping.

## What the current app does on mobile

### Shared shell

- Below 768px, the desktop sidebar becomes a focus-managed drawer. Athlete navigation exposes Home, Plan, Workouts, and History; Plan groups Calendar and Planner, Workouts maps Templates, and History maps Import. Coaches receive Home, Plan, Workouts, and Templates routes they own. Direct URLs and desktop sidebar destinations remain available.
- The drawer supports Escape, restores focus, contains keyboard focus, and isolates the page while open. Bottom-bar items and drawer links use at least 44px height.
- The shared page frame stays fluid with 20px mobile gutters. Page headings stack with their actions at narrow widths. Main content reserves room for bottom navigation, and the fixed Profile save bar accounts for the mobile bar and safe-area inset.
- Home turns the week into a horizontal, scroll-snapping channel and now shows a phone-only swipe cue. The authenticated 390px empty state was visually checked; populated long-title and physical touch checks remain open.
- The app shell clips horizontal overflow to contain its decorative backdrop. The phone review checked visible Planner content at 320px; a full route-wide edge/overflow audit on physical devices remains open.

### Route and capability inventory

| Routes | Current mobile treatment | Verification still open |
|---|---|---|
| /, /login, /signup, /setup | Authentication uses its own centered, fluid reading-width shell; shared fields are full-width and at least 44px on phones. | Narrow keyboard-open forms, password manager/autofill, error and success feedback, and iOS focus behavior. |
| /athlete (Home) | Week changes from a wall to a horizontal day channel with a phone-only swipe cue; empty-state actions remain available. | Populated long-title weeks and off-screen day discoverability on physical touch devices. |
| /athlete/calendar | Week/month views remain available. A phone-only Schedule workout action carries the current date into Planner. | Recheck agenda links and the dated handoff with populated calendar data on a device. |
| /athlete/workouts, /coach/workouts | The library is one column on narrow content, two columns from 560px, and three from 900px. On phones the shared editor offers an ordered block list with explicit move, duplicate, remove, and edit controls; the proportional chart remains the desktop editor. | Saved populated libraries, target editing, keyboard-open forms, and coach-only sharing on physical devices. |
| /athlete/templates, /coach/templates | Both use the shared template editor and canonical workout builder. Athlete Templates has a phone-only switch beside Workouts; cadence, editing, save, and reuse remain available. | Persisted day/week/month templates, validation states, long names, keyboards, and coach-only sharing on physical devices. |
| /athlete/planner, /coach/planner | The shared Planning Desk has a phone-only seven-day strip with 44px targets above the month. The current date is scrolled into view; the selected-workout action stays as a compact sticky row. Multi-date and exact template range selection remain available. | Verify API assignment, validation/conflict feedback, and coach placement using connected data; the phone layout was visually checked with a synthetic Planner fixture. |
| /athlete/session/[sessionId] | Session summary and ordered workout blocks use the shared session language; imported sensor measurements appear after plan context. | Planned, adjusted, completed, and imported states; expandable metric tables; comparison dialog; and all return paths. |
| /athlete/live/[sessionId] | A large current-block timer and local countdown stepper prioritize session execution; controls remain in the session flow. | Real phone wake/sleep/resume, portrait and landscape, reachable controls with the browser chrome present, and completion/error announcements. Live is a guidance stepper, not device telemetry. |
| /athlete/activity | Complete week/month history, sport filter, sort, per-sport totals, full completed rows, and outcome links remain. Phones show three key totals, with sport breakdown and filters in disclosures; Import activity is visible near the period controls. | Verify connected populated rows and empty periods on a physical device. A synthetic populated history and filter change were checked at 320px. |
| /athlete/import | File review and Strava import share one route. File selection uses the native picker; review fields stack; prior imports and metric details progressively disclose. Up to 10 files of 20MB each can be selected, parsed serially in the browser. | Native file picking on iOS/Android, a maximum-size file, a multi-file batch on a lower-memory phone, Strava review/OAuth return, long history, expanded chart tables, and import/delete feedback. |
| /athlete/profile, /profile, /settings | Profile save state stays in a viewport-pinned footer above mobile navigation with space reserved after the form. Settings shares the compact account frame. | Keyboard-open footer/form overlap, safe-area behavior, long validation errors, unsaved/saving/error states, and preference controls. |
| /athlete/find-coach, /coach, /coach/athletes/[athleteId] | Discovery, roster, and athlete detail use the shared page frame and drawer; coach features remain secondary but supported. | Long rosters, search/requests, athlete detail actions, and mobile return-to-Planner context. Do not regress these while editing shared owners. |
| /share/[token] | Public sanitized workout/template snapshots are separate from the authenticated shell. | Shared workout and template previews at 320–390px, long content, and authenticated intake. The project index still records public share browser acceptance as open. |
| /coach/builder, /athlete/imported-activities, /profile | Compatibility aliases or redirects; the first two resolve to current routes. | Check that redirect destinations remain usable and preserve the relevant context. |
| /design/* | Sample-data visual experiments have their own responsive behaviors. | Excluded from production MVP acceptance unless one is explicitly promoted into the product. |

## Findings and resolution status

### Resolved — Mobile text contrast

The baseline muted text was #7F8588 on paper #F5F4EF (**3.40:1**) and inactive mobile navigation was #65717A on #F1F0EB (**4.39:1**). Below 768px, local shell overrides now use #686E72 for muted text and #5E6870 for navigation. Their contrast is **4.69:1** and **4.99:1** on those surfaces. Global tokens and desktop colors are unchanged. A complete color-state audit and route-wide axe scan remain open.

### Resolved — Thumb-sized Planner date selection

The seven-column month still has about 35px-wide cells at 320px, so it remains useful for month context and range selection rather than as the only phone control. A phone-only seven-day strip now provides at least 44px-wide date buttons, adjacent-week controls, a swipe cue, and an automatic horizontal adjustment that keeps the selected date visible. The 320px and 390px Planner fixture views confirmed this behavior; assignment APIs and physical touch remain to be checked with connected data.

### Resolved — Touch-first workout editing

The shared phone editor now shows an ordered block list with duration, target, and skipped state, plus explicit move-up, move-down, duplicate, remove, and edit actions. Selecting a block retains the full existing inspector for its target and duration. The proportional chart and its desktop interactions remain unchanged. A 320px unsaved draft was used to verify add, duplicate, reorder, and target editing without saving a record.

### Resolved — Mobile navigation and frequent touch targets

Athlete mobile destinations are Home, Plan, Workouts, and History; the existing Calendar and Planner group under Plan, Templates map to Workouts, and Import maps to History. Coach mobile links stay within coach-owned pages. A mobile-only Calendar action carries the selected date into Planner. Shared button/field utilities and the frequent Planner, History, and editor controls target 44px on phones; desktop sizes and sidebar routes remain unchanged.

### P2 — Mobile runtime and browser-chrome cases are not measured

Activity files are parsed on the client, in sequence, and the UI allows a batch of up to ten 20MB files. Serial parsing limits simultaneous parser work, but retained samples, chart rendering, and browser memory still need a low-end device check. The fixed Profile footer, bottom navigation, form keyboard, safe area, landscape, and browser chrome also need direct device review.

**Remaining check:** profile the largest realistic import and exercise keyboard/safe-area states on one iPhone Safari and one Android Chrome device.

### P3 — Type-ramp advisories need intentional review

The 11 Impeccable warnings are advisories, not responsive failures. Most are semantic display or metric exceptions. Review small 10–14px supporting labels and their contrast as part of accessibility work; do not turn this into indiscriminate typography normalization.

## Evidence already recorded

| Date and evidence | What it establishes | What it does not establish |
|---|---|---|
| 2026-09-18: 56 athlete/coach route-viewport checks at 1280×720, 1366×768, 1920×1080, and 390×844. Planner, Templates, and Calendar screenshots were compared. | The captured routes had no reported horizontal overflow at those widths; mobile page scrolling and core Planner selection were checked. | It did not claim that every page fit in one viewport. Public sharing and populated session/live pages were not reverified in that pass. |
| 2026-09-18: fresh-account personal workflow passed through scheduling, live execution, completion, correction, comparison, and Activity; a 390px Planner viewport had no horizontal overflow. | Strong end-to-end evidence for the personal path at that recorded state. | It does not exercise all current route states or physical touch. |
| 2026-09-24: authenticated workout builder/library checks at 390px and desktop widths covered creation controls and editor layout. | The core builder reflow and the library header had focused mobile review at that point. | It predates the 2026-09-27 library/history restructuring and did not cover every mobile route. |
| 2026-09-27: Workouts and Activity loaded in an authenticated empty-data browser state. | Empty states and basic page load were visible. | Populated data and mobile rendering were explicitly not verified. |
| 2026-09-27: authenticated browser review at 390×844 of Home, Calendar, Planner, Workouts, unsaved workout editor, Activity, Templates, and Import. | Current page hierarchy, empty states, and editor density were observed at a phone viewport. The workout draft was not saved. | Populated list/history data, persistent-device touch/keyboard, iOS/Android, 320px, and live production route acceptance remain open. |
| 2026-09-27: final authenticated responsive review at 320×780 and 390×844 using removed-after-review synthetic Planner/History fixtures, plus a 1280×900 Planner desktop regression view. | Compact sticky assignment action, selected-day visibility in the week strip, month context, synthetic History summary/filter, bottom navigation, and desktop/phone breakpoint behavior were visible. No assignment or database record was saved. | Real connected-data assignment, data-backed library routes, physical iOS/Android, native keyboard/safe area, route-wide overflow, and performance remain open. |

### Review against latest commit

The pre-implementation review used committed source at `d7b7ffe` (`Add activity history overview and calendar summaries`). The Activity owner already loaded complete history with week/month periods, sport filter, sorting, totals, notes, metrics source, and outcome links. The final implementation keeps those defaults and instead adds phone-only summaries and disclosures. Calendar remains the Plan landing page, with a date-preserving link to the existing Planner. Import, Templates, and Live retain their existing route/service behavior.

The initial 390px page pass used an authenticated browser with empty history/schedule data. Final populated visual checks used local synthetic fixtures that were removed after review; the workout-editor draft was unsaved. During the final preview, database-backed pages could not connect to the configured Neon database, so connected-data assignment and library verification remain open. The current source completed a full production Next.js build with loopback-only database URLs; no migration or database write ran.

The current PageShell source renders a main landmark, so the older axe report’s missing-main finding should be rechecked on the exact route/state before carrying it forward. The older report also mentioned template ARIA-role findings; this investigation did not rerun axe and does not claim those are fixed. The current contrast calculation above is independently reproducible from the active CSS values.

## Implemented mobile product shape

### Mobile-only change boundary

The completed work is a **phone-layout redesign only**. The desktop navigation, page hierarchy, editor canvas, month-first Planner, card density, typography, spacing, and visible actions remain as they were. Shared components were edited only where their responsive presentation changes below 768px.

- Scope new presentation and interaction changes to the mobile shell and phone responsive styles. Use the app's existing mobile breakpoint as the starting point; verify phone landscape explicitly and adjust the responsive condition only when a real phone requires it. Do not use user-agent sniffing.
- At desktop widths (including the 1280px regression target), preserve the existing desktop screenshot, navigation destinations, control sizes, calendar/editor presentation, and action order. Shared components may be edited only when the changed rule is mobile-scoped and the desktop render is unchanged.
- Fix the measured mobile text contrast with a mobile-scoped semantic override or mobile-only text role. Do not change the global color tokens in a way that recolors desktop pages. Typography detector advisories do not justify desktop typography changes in this work.
- Scope 44px touch targets, the four-item mobile navigation, the agenda-first Plan view, the touch-first editor, and mobile-only progressive disclosure to the mobile presentation. Desktop keeps its current compact controls and full navigation.
- Keep existing routes, permissions, and shared data ownership. No History service/API extension, schema change, or remote data mutation is needed for this implementation.
- “Mobile-only” is implemented with responsive layout and input-capability rules, not a reliable OS detector. A narrow desktop browser window may receive the compact presentation; normal desktop widths must not. Check 768px/tablet and desktop explicitly for unintended crossover.

The app remains one product with a mobile-specific presentation layer; routes, role checks, services, and saved data behavior remain shared.

### Mobile navigation

Use four persistent destinations for the athlete workspace:

1. **Home** — today, the next planned workout, and a clear Start/Resume or Plan action.
2. **Plan** — the existing Calendar week agenda at `/athlete/calendar`, with date navigation and a clear Schedule workout action that opens `/athlete/planner?date=...`.
3. **Workouts** — saved workouts, create/edit, and a Templates subview.
4. **History** — completed sessions and outcome review, with Import activity available here.

This replaces the current **mobile** split between Calendar and Planner with one task-based Plan destination and brings Activity into the **mobile** always-visible navigation. Calendar, Planner, Activity, Templates, and Import URLs remain valid and directly reachable; only the mobile navigation groups them into this task hierarchy. Keep desktop navigation and its separate Calendar, Planner, Templates, Activity, and Import entry points unchanged. Profile, Settings, Find coach, and lower-frequency actions remain in the mobile drawer under clear labels. Use the current role to choose mobile destinations; coach users should land on `/coach`, `/coach/planner`, `/coach/workouts`, and `/coach/templates`, never athlete-only tabs.

Keep each screen’s primary action visible near the content it affects. When an action bar is fixed, reserve bottom space for both the bar and navigation, include the safe-area inset, and ensure the keyboard does not cover the focused field or Save/Finish action. Frequent touch controls should target 44×44 CSS px where practical; tightly grouped secondary controls need spacing and clear labels even when they remain smaller.

### Screen-by-screen current treatment and acceptance

Phone-only changes in this table are implemented where marked. Existing responsive flows remain intact. Desktop pages retain their current layout and action hierarchy.

| Screen / entry | Current phone layout and specific adjustments | Secondary UI / desktop behavior | State and acceptance condition |
|---|---|---|---|
| **Home** `/athlete` | The Today card and actions remain first; a phone-only “Swipe to browse your week” cue now signals the existing horizontal week ribbon. | Keep current summary cards and completed/upcoming rows. Desktop Home is unchanged. | The empty Home hierarchy and week cue were seen at 390px. Check populated long-title weeks on physical devices. |
| **Plan** `/athlete/calendar` + `/athlete/planner` | Plan opens the existing Calendar agenda. A phone-only **Schedule workout** action carries its date into Planner. Planner adds a horizontally scrollable week strip with 44px date targets, previous/next-week controls, and automatic visibility for the current date above the month. A selected source keeps a compact sticky assignment action visible while scrolling. | No new hub or second agenda. Keep desktop Calendar and Planning Desk unchanged. Retain month selection, multi-date behavior, template cadence, and range review. | The 320px/390px synthetic Planner showed the selected day, compact action, and month context. API assignment, feedback states, and coach placement still need connected-data verification. |
| **Workout library** `/athlete/workouts` | The library remains a one-column card list on narrow screens with create, search, and result count. Athlete pages have a phone-only Workouts/Templates switch. The shared phone editor shows ordered block summaries and 44px move, duplicate, remove, and edit actions; the desktop proportional chart is hidden only below 768px. | Keep desktop grid, filtering, action placement, chart, inspector, and controls. Keep the full target editor and repeat/pause tools available in phone disclosures. | A 320px unsaved draft verified add, duplicate, reorder, target editing, and save-bar placement. Recheck saved libraries and validation with connected data. |
| **Templates** `/athlete/templates` | The shared template editor uses the ordered touch-first block list on phones. Cadence choices, range explanations, save, and reuse remain available. | Keep desktop Templates hierarchy and coach share actions. | The phone switch was checked; persisted day/week/month templates, validation, and coach sharing need connected-data/device review. |
| **Scheduled session detail** `/athlete/session/[sessionId]` | Existing page stacks session context, plan blocks, action links, outcome notes, and imported measurements in a fluid page frame. Completed History rows link to **View outcome**; the outcome surface provides notes, compliance, and comparison access. | Preserve desktop detail hierarchy. Keep long imported charts and measurement tables after core plan/outcome context. | Source review confirms both planned and completed actions and the outcome route. Planned, adjusted, imported, and long-note states still need phone screenshots with connected data. |
| **Live session** `/athlete/live/[sessionId]` | Existing single-block view leads with status, current step, timer, progress, and a two-column set of 48px controls. It includes local pause/resume/skip/previous/finish actions, wake-lock support where available, and session progress below. | Keep current timer semantics and desktop layout. No drag or swipe is required for progression. | Code paths exist, but portrait/landscape, browser chrome, sleep/resume, and one-handed use remain physical-device checks. |
| **History** `/athlete/activity` | History is a mobile bottom destination. Phones show sessions, time, and distance in three metrics, disclose sport breakdown and filters, retain all rows/outcomes, and show **Import activity** on populated history. | Keep desktop filters, table, and complete history output. Do not add pagination or change service defaults. | Synthetic populated history and sport filtering were checked at 320px. Connected history and empty periods need a physical-device pass. |
| **Import activity** `/athlete/import` | Keep the current shared file/Strava route and native picker. History now exposes a one-tap **Import activity** action. The current flow stacks review fields and progressively discloses prior imports and metric detail. | Preserve the current desktop flow, multi-file selection, chart tables, and file limits; do not split routes or change parser/service behavior without device evidence. | Native file picking, parse/review errors, matching, Strava OAuth return, largest file/batch, and keyboard reachability still need iOS/Android checks. |
| **Profile and Settings** `/profile`, `/settings` | Preserve the single-column account form and pinned save-state footer above mobile navigation/safe area. Shared fields and buttons now target at least 44px on phones. | Keep low-frequency preferences and destructive account actions in Settings; place Account in the drawer, not a fifth bottom destination. | Check unsaved/saving/saved/error and validation states with a native keyboard; ensure focused fields and Save remain visible. |
| **Find coach** `/athlete/find-coach` | Use a simple search and request list with one request action per coach and clear pending/accepted state. Keep result cards one-column and make request feedback inline. | Keep this out of the core athlete bottom tabs unless product priorities change. | Search, request, pending, and empty states work at 320px without horizontal card layouts. |
| **Coach roster, planning, templates, athlete detail** `/coach/*` | Preserve current routes and authorization. The phone bar uses Home, Plan, Workouts, and Templates within coach-owned routes. Keep roster/athlete actions in the drawer and retain shared touch-first Planner/editor behavior. | Keep bulk multi-athlete assignment, dense month planning, and secondary roster actions available; retain current desktop coach navigation and behavior. | Coach source/athlete context, create/assign/review, and mobile return paths need connected-data review; no athlete-only destinations may leak into the coach bar. |
| **Authentication, setup, public shares** `/login`, `/signup`, `/setup`, `/share/[token]` | Use one-column forms and share previews, readable field labels, full-width primary actions, and stable validation after the mobile keyboard opens. On share previews, put the exercise summary before secondary metadata and keep **Use this workout** reachable. | Keep explanatory/legal text below the form or preview; preserve public-share sanitization and authentication gates. | Password managers/autofill, errors, signup/setup, public workout/template preview, and authenticated intake are checked in mobile browsers at 320–390px. |

## Implementation result and remaining acceptance

### Completed phone-only work

- Athlete bottom navigation now groups work as Home, Plan, Workouts, and History. Plan combines the existing Calendar and Planner routes; Workouts maps Templates; History maps Import. Coach destinations remain role-owned. Desktop navigation and direct route access are unchanged.
- Home signals its horizontal week ribbon. Calendar provides a phone-only, date-preserving Schedule workout action. Planner adds a 44px week strip, selected-date auto-visibility, and a compact sticky action when a source is selected. Month selection, multi-date assignment, template cadence, routes, and service contracts remain intact.
- The shared workout editor provides a phone-only ordered block list with touch actions and the full existing inspector. Chart editing remains on desktop. Repeat/pause tools use a mobile disclosure, and the save bar stays above mobile navigation and the safe area.
- History keeps full service data and desktop tables while adding phone totals, sport/filter disclosures, and a populated-history Import action. No pagination, schema, service, or authorization change was needed.
- Muted phone text and frequent touch controls were adjusted in responsive CSS/utilities. Global color tokens and desktop sizing were not changed.

### Verification completed

- Authenticated browser review at 320×780 and 390×844 used temporary local Planner/History fixtures. It covered selected-date visibility, the compact sticky action while scrolling, month context, populated History metrics/filtering, and an unsaved workout draft with tap editing. The fixtures were removed and no review action wrote a database record.
- At 1280×900, the Planner showed the desktop sidebar and month layout, with no phone week strip or mobile bottom navigation.
- The full test suite passes 249/249, full ESLint passes, and the production Next.js build passes. The build used a loopback database URL and ran no migrations or writes.
- The configured package-manager preflight attempted a dependency install in this noninteractive environment, so the package scripts were run directly through the already-installed Node executables. The first compile attempt also needed access to fetch the existing Google font; the successful build used that font and the isolated database URL.

### Remaining release acceptance

- Check real iOS Safari and Android Chrome in portrait and landscape, including browser chrome, safe-area insets, orientation changes, screen lock/resume in Live, keyboard-open Profile/Settings forms, and one-handed control reach.
- Validate the current route matrix with connected populated and empty data, especially saved Workouts/Templates, actual History/outcomes, Planner assignment/removal/conflict feedback, and coach planning. During the final browser pass the configured Neon database was unreachable; synthetic review fixtures covered only visual states and were not saved.
- Run keyboard-only navigation, VoiceOver/TalkBack spot checks, 200% zoom/text scaling, a route-wide contrast/landmark scan, and document/content-edge measurements at 320–430px and 768px.
- Profile the largest supported import on a representative phone for parsing progress, memory use, cancellation/recovery, and chart responsiveness.
- Recheck the full 1280px desktop route matrix after shared-component changes. The Planner was visually checked at 1280px; other routes were protected by viewport-scoped styles and production build/tests, but were not all re-screenshotted in this pass.

### Acceptance status

- **Passed in local review:** one-tap phone navigation to Home/Plan/Workouts/History; date context from Calendar to Planner; touch selection at 320px without relying on month cells; touch-first block ordering and editing; compact History totals and filtering; production build and automated tests; desktop Planner breakpoint check.
- **Still unverified:** connected-data assignment and all populated route states, native mobile browser/keyboard behavior, accessibility assistive technology, import performance, and full physical-device/desktop route matrices. These require a reachable database and physical iOS/Android devices.

## Method and limits

Reviewed README.md, ARCHITECTURE.md, PRODUCT.md, DESIGN.md, CURRENT-STATUS.md, and WORK-INDEX.md; inspected route, shell, responsive, Planner, editor, Activity, Import, and metric-chart owners; and used Impeccable audit/adapt guidance plus its targeted detector. Final 2026-09-27 browser review covered the synthetic Planner and History states at 320×780/390×844 and the Planner at 1280×900. The remote database could not be reached during the last preview; no review records were saved and temporary fixtures were removed. Physical devices, native keyboards, populated connected routes, full route overflow/a11y, and import profiling remain acceptance gates. Build and test results are in `CURRENT-STATUS.md`.

## Source map

- Product and acceptance: [PRODUCT.md](../../PRODUCT.md)
- Routes and ownership: [ARCHITECTURE.md](../../ARCHITECTURE.md)
- Visual contract: [DESIGN.md](../../DESIGN.md)
- Shared shell and controls: [AppShell.tsx](../../components/AppShell.tsx), [AppSidebar.tsx](../../components/AppSidebar.tsx), [ui.tsx](../../components/ui.tsx), [app-navigation.ts](../../lib/app-navigation.ts)
- Responsive rules: [globals.css](../../app/globals.css)
- Planner: [PlannerDesk.tsx](../../components/PlannerDesk.tsx)
- Workout authoring: [WorkoutBuilder.tsx](../../components/WorkoutBuilder.tsx), [WorkoutCanvasEditor.tsx](../../components/WorkoutCanvasEditor.tsx), [workout-canvas.css](../../components/design/workout-canvas.css)
- Activity imports and charts: [ActivityImportClient.tsx](../../components/ActivityImportClient.tsx), [ActivityMetricBars.tsx](../../components/tempo/ActivityMetricBars.tsx), [ActivityMetricPreview.tsx](../../components/ActivityMetricPreview.tsx)
- Session and activity data ownership: [athlete-service.ts](../../lib/athlete-service.ts), [athlete-execution.ts](../../lib/athlete-execution.ts)
- Current evidence and ownership index: [CURRENT-STATUS.md](CURRENT-STATUS.md), [WORK-INDEX.md](WORK-INDEX.md)
