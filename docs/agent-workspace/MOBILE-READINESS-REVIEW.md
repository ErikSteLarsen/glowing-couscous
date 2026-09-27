# Mobile readiness investigation and implementation plan

**Reviewed:** 2026-09-27
**Purpose:** Document current mobile behavior, confirmed gaps, and a specific proposed mobile implementation plan. This is a planning document; no product code changes are included.
**Scope:** Production routes for both roles, shared authenticated shell, public/auth pages, and the core personal training workflow. Internal /design/* explorations are inventoried but are not production acceptance surfaces.

## Executive assessment

Tempo already has a thoughtful responsive foundation. It uses a mobile drawer plus four-item bottom navigation, fluid page frames, horizontal week navigation, container-responsive workout editing, a narrow Planner layout, and a pinned Profile save bar. The app generally reflows the same capabilities instead of removing them.

The current product is **partially mobile-ready, but not yet verified well enough to call every route and task usable on mobile**. The most actionable confirmed concerns are small muted text that misses WCAG AA contrast and the Planner’s narrow day buttons at a 320px viewport. The largest confidence gap is that the September 27 Workouts and Activity layout changes have only been checked in empty states, not in a mobile viewport. Import, share, coach, and several populated session states also lack a fresh all-route mobile pass.

The earlier version of this review contained findings and broad follow-up themes, but not implementation-level screen decisions. The plan below now spells out the proposed mobile navigation, per-screen changes, which capabilities move behind secondary actions, the order of work, and concrete acceptance criteria. The recommendation is to optimize the phone experience around four jobs: see what is next, plan a workout, complete it, and understand what was done. Desktop keeps its existing denser workflows.

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

**Mobile-only fix:** use a mobile-scoped text role or override for the affected labels, then recheck all mobile roles and states against actual backgrounds. Do not darken a global token if it would recolor desktop screens. Keep color-only status cues out of the fix.

### P1 — Planner date buttons get too narrow on a 320px viewport

The Planner always renders seven columns. At a 320px viewport, 20px page gutters and 16px calendar insets leave about 248px for the grid, or roughly **35px per date button**. At 390px, the same calculation is about 45px. The cells remain identifiable and keyboard-labeled, but the 320px targets are cramped for thumb selection in the core scheduling task.

**Next:** test 320px on device, then choose a mobile date-selection treatment if needed—such as a compact week/day selection mode that keeps the current month context and selected-day details. Keep the full month available as a useful navigation view.

### P1 — Current mobile acceptance evidence does not cover the current product state

The latest status says the new Workouts and Activity layouts were checked in empty states only; their populated and mobile renders remain unverified. Import/Strava review, public share, populated session/live states, 320px, landscape, and physical touch behavior also lack a fresh end-to-end pass. A 390px result from September is useful history, but it cannot certify later changes or every route.

**Next:** use an isolated local or preview dataset and run a route/state matrix before treating mobile readiness as complete. Do not use the configured remote database to create review fixtures.

### P2 — Compact controls are often 32–40px on touch surfaces

The shared design intentionally uses 32px compact controls in dense toolbars. The Planner’s previous/next month buttons are 32×32px; other removal, editor, and menu controls also use compact sizes. These are above WCAG 2.2 SC 2.5.8’s 24px minimum, but fall short of Impeccable’s 44px mobile ergonomics target and are difficult to operate where controls are close together.

**Mobile-only fix:** identify which compact controls appear in frequent phone tasks and enlarge only those in the phone presentation. Preserve desktop control sizes and dense layouts; keep destructive actions visually distinct.

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

## Proposed mobile product shape

### Mobile-only change boundary

This plan authorizes a **phone-layout redesign only**. The current desktop navigation, page hierarchy, editor canvas, month-first Planner, card density, typography, spacing, and visible actions remain as they are. Do not make a global redesign or shared-token change just to implement the mobile proposal.

- Scope new presentation and interaction changes to the mobile shell and phone responsive styles. Use the app's existing mobile breakpoint as the starting point; verify phone landscape explicitly and adjust the responsive condition only when a real phone requires it. Do not use user-agent sniffing.
- At desktop widths (including the 1280px regression target), preserve the existing desktop screenshot, navigation destinations, control sizes, calendar/editor presentation, and action order. Shared components may be edited only when the changed rule is mobile-scoped and the desktop render is unchanged.
- Fix the measured mobile text contrast with a mobile-scoped semantic override or mobile-only text role. Do not change the global color tokens in a way that recolors desktop pages. Typography detector advisories do not justify desktop typography changes in this work.
- Scope 44px touch targets, the four-item mobile navigation, the agenda-first Plan view, the touch-first editor, and mobile-only progressive disclosure to the mobile presentation. Desktop keeps its current compact controls and full navigation.
- Keep existing routes, permissions, and shared data ownership. A service/API extension is acceptable only to support a mobile-only affordance (for example, loading older History rows); its default response and desktop UI behavior must remain unchanged. No schema change is proposed.
- “Mobile-only” is implemented with responsive layout and input-capability rules, not a reliable OS detector. A narrow desktop browser window may receive the compact presentation; normal desktop widths must not. Check 768px/tablet and desktop explicitly for unintended crossover.

Any implementation should be reviewed as a mobile-specific presentation layer over the current product, not as a new desktop/mobile split in product behavior.

### Mobile navigation

Use four persistent destinations for the athlete workspace:

1. **Home** — today, the next planned workout, and a clear Start/Resume or Plan action.
2. **Plan** — the merged mobile entry for Calendar and Planner: upcoming sessions, day/week agenda, date navigation, and scheduling.
3. **Workouts** — saved workouts, create/edit, and a Templates subview.
4. **History** — completed sessions and outcome review, with Import activity available here.

This replaces the current **mobile** split between Calendar and Planner with one task-based Plan destination and brings Activity into the **mobile** always-visible navigation. Calendar, Planner, Activity, Templates, and Import URLs remain valid and directly reachable; only the mobile navigation groups them into this task hierarchy. Keep desktop navigation and its separate Calendar, Planner, Templates, Activity, and Import entry points unchanged. Profile, Settings, Find coach, and lower-frequency actions remain in the mobile drawer under clear labels. Use the current role to choose mobile destinations; do not expose athlete-only pages to a coach or weaken route authorization. The coach role is marked transitional in the work index, so keep its existing routes and desktop behavior unchanged, then set a coach-specific mobile priority order when that workflow is actively supported.

Keep each screen’s primary action visible near the content it affects. When an action bar is fixed, reserve bottom space for both the bar and navigation, include the safe-area inset, and ensure the keyboard does not cover the focused field or Save/Finish action. Frequent touch controls should target 44×44 CSS px where practical; tightly grouped secondary controls need spacing and clear labels even when they remain smaller.

### Screen-by-screen recommendations

Every proposed layout, control, navigation, and disclosure adjustment in this table applies to the phone presentation only. Desktop pages retain their current layout and action hierarchy.

| Screen / entry | Proposed phone layout and specific adjustments | Move to secondary UI / retain | Main acceptance condition |
|---|---|---|---|
| **Home** `/athlete` | Lead with a compact “Today” card: date, planned workout title, start time, and one contextual action (**Start/Resume**, **View workout**, or **Plan a workout**). Keep the week strip, but show a clipped next-day cue and a visible swipe/scroll affordance; use 44px date targets. Put this week’s completed/upcoming count and the latest completed session below the next action. | Long-range trends and secondary summaries can follow the week’s next task; do not bury the next workout below charts. | At 320–430px, a user can identify today’s plan and reach its next action without horizontal page scrolling. Empty, planned, in-progress, and completed-today states have distinct actions. |
| **Plan hub** `/athlete/calendar` + `/athlete/planner` | On phone only, make the default Plan entry an agenda: a horizontally navigable 7-day strip, selected date label, then a vertical list of scheduled sessions and open time. Place **Schedule workout** beside the agenda. When scheduling, use a focused sequence: choose a saved workout/template; choose a date (today/next available date by default); optionally choose time; review title, date, and duration; confirm. Return to the selected date after save. | Keep the desktop month/week Planner and its current placement workflow unchanged. On phone, keep the month grid as a secondary date picker or explicit Month view. Put multi-date selection, week/month template ranges, and less-common placement options under **More scheduling options**. Preserve all range choices and exact start/end dates. | On 320px, selecting a date does not depend on seven thumb-sized 35px cells. Day/week browsing, single-day scheduling, range scheduling, removal, and return context work without hidden content or lost selection; desktop Planner screenshots and behavior match the current baseline. |
| **Workout library** `/athlete/workouts` | On phones, use a single-column list with title, sport, estimated duration, and one-line block summary. Keep **Create workout** as the first page action, search accessible, and show the result count beside search/filter controls. Make each row open the workout; keep row actions in a labeled overflow menu. | Keep the current desktop grid, filtering, and action placement unchanged. Keep advanced filtering and bulk actions secondary on phone. Keep Templates as a clear adjacent subview or segmented control in the phone Workouts area; preserve its existing desktop entry. | Populated, empty, no-search-results, long-title, and error states remain easy to scan and act on at 320–430px; desktop library layout and actions match the current baseline. |
| **Workout editor** `/athlete/workouts?...` | On phone layouts only, replace the proportional chart as the main touch editing surface with a vertical ordered block list. Each block card shows order, type/zone, duration/repeats, target, and note; tap **Edit** to open a focused inline editor or full-screen sheet. Put an explicit **Add block** action between/after blocks, with labeled **Move up / Move down**, **Duplicate**, and **Remove** controls. Keep a compact session timeline preview for orientation. Pin **Save workout** and save/error state above the bottom navigation and safe area. | Keep the existing desktop chart, palette, inspector, layout, and actions unchanged. Keep drag-and-drop as an optional phone shortcut only. Put exact target fields, multi-block editing, and less frequent controls behind **More options** on phone; all existing workout construction abilities remain available. | A complete workout can be created, edited, reordered, duplicated, and saved using taps only, including with a phone keyboard open; desktop editor screenshots and interactions match the current baseline. |
| **Templates** `/athlete/templates` | Add a phone-only Templates subview under Workouts. Make template setup a short sequence: choose cadence (day/week/month), enter title/sport/summary, build ordered blocks, review what dates/range the cadence will affect, then save. Show a compact cadence badge and duration on each template card. Keep **Reuse in Plan** as the primary card action. | Keep the current desktop Templates page and editor hierarchy. On phone, move explanatory hero/cadence prose below the list or into help. Keep edit, duplicate, delete, and advanced range details in an overflow menu, with a clear delete confirmation. | Day/week/month templates can be created and reused with exact cadence and date effects visible before save; desktop Templates appearance and actions remain unchanged. Coach template sharing remains available where authorized. |
| **Scheduled session detail** `/athlete/session/[sessionId]` | On phone, start with title, date/time, status, sport, duration, then one full-width primary action: **Start/Resume** for a planned session or **Review outcome** for a completed session. Show planned blocks as a compact ordered list with target and duration. For completed sessions, lead with actual duration, load (or explicit unavailable state), compliance, and notes. | Keep desktop detail hierarchy unchanged. On phone, collapse imported sensor charts and long measurement tables under labeled metric accordions. Put compare, share, source editing, and less common actions under secondary controls, without hiding outcome notes or planned-versus-actual summary. | Planned, adjusted, completed, and imported-without-plan sessions show the right action and useful summary at phone width; return goes to originating Plan, Home, or History. Desktop detail remains unchanged. |
| **Live session** `/athlete/live/[sessionId]` | On phone, use a distraction-free single-block view: current step and total progress, block name/target, large timer, then anchored **Pause/Resume** and **Next/Finish** controls. Keep controls above safe area and browser chrome. Give each step an explicit tap target and concise completion confirmation. | Keep current desktop live layout unchanged. On phone, put skip, previous, restart, and other recovery actions in a clearly labeled **More** menu; never make swipe/drag the only way to advance. Keep current local timer semantics clear; do not imply device-measured performance. | A user can start, pause, resume, move through blocks, finish, and recover from an accidental advance one-handed in portrait and landscape, including after screen lock/app resume. Desktop layout/actions remain unchanged. |
| **History** `/athlete/activity` | Make this the phone History destination. Lead with a short period summary, then completed sessions grouped by date, newest first. Each row shows title, date/sport, duration, load/compliance when available, and a clear tap target to open the outcome. Show manual outcomes and unavailable imported load as text, not as blank or zero. | Keep the desktop page and its current first-12 presentation unchanged. Keep **Compare**, detailed charts, and notes in session detail or an expanded row on phone. Put period/sport filters and search behind one compact **Filter** control. The current page says it shows the latest 12; add a phone-only **Load more** or date-range path so users can reach older training. Service defaults and desktop output stay unchanged. | A user can find recent and older workouts, distinguish planned from recorded facts, and open an outcome quickly with populated data; empty and long-history states stay clear. Desktop remains on its existing presentation. |
| **Import activity** `/athlete/import` | Enter from **History → Import activity**. On phone, separate file and Strava sources into clear steps/tabs. For file import, pick files, show parse progress and per-file errors, review the proposed activity and any plan match, then use one prominent **Import activity** confirmation. Keep summary metrics ahead of charts and show whether load is unavailable. | Preserve the current desktop Import page and flow. Keep multi-file selection, detailed sensor charts/tables, and delete/history management available under advanced/review details on phone. Do not lower the existing file count/size limit without profiling and an explicit product decision. | Verify native file picking, parsing, review, duplicate/error handling, matching, and Strava OAuth return on real iOS Safari and Android Chrome; import feedback remains reachable with the keyboard open. Desktop remains unchanged. |
| **Profile and Settings** `/profile`, `/settings` | Keep a single-column account form, clear section headings, full-width inputs, and the existing pinned save-state footer. Ensure the footer adjusts to keyboard and safe-area height. Make toggles and units explicit with short labels. | Keep low-frequency preferences and destructive account actions in Settings; place Account in the drawer, not a fifth bottom destination. | Unsaved/saving/saved/error states and validation remain visible; no focused field or Save action is covered by the keyboard or navigation. |
| **Find coach** `/athlete/find-coach` | Use a simple search and request list with one request action per coach and clear pending/accepted state. Keep result cards one-column and make request feedback inline. | Keep this out of the core athlete bottom tabs unless product priorities change. | Search, request, pending, and empty states work at 320px without horizontal card layouts. |
| **Coach roster, planning, templates, athlete detail** `/coach/*` | Preserve current routes and authorization. Use one-column roster and athlete cards, put athlete selection before plan actions, show the selected athlete and date continuously while placing workouts, and give template reuse a clear primary action. Avoid requiring drag to assign sessions. If coach work becomes active again, set a coach-specific four-item mobile nav from actual coach jobs rather than reusing athlete labels. | Keep bulk multi-athlete assignment, dense month planning, and secondary roster actions behind explicit advanced controls; retain current desktop planning and coach behavior. | Existing coach create/assign/review paths still work on phone, the athlete/date context cannot silently change, and no shared mobile shell change leaks personal-only pages across roles. |
| **Authentication, setup, public shares** `/login`, `/signup`, `/setup`, `/share/[token]` | Use one-column forms and share previews, readable field labels, full-width primary actions, and stable validation after the mobile keyboard opens. On share previews, put the exercise summary before secondary metadata and keep **Use this workout** reachable. | Keep explanatory/legal text below the form or preview; preserve public-share sanitization and authentication gates. | Password managers/autofill, errors, signup/setup, public workout/template preview, and authenticated intake are checked in mobile browsers at 320–390px. |

## Recommended implementation sequence

These are proposed work packages for a later implementation task. Each package should preserve the existing desktop layout unless a shared fix is needed for accessibility.

### 0. Lock the mobile information architecture and test data

- Confirm the four athlete mobile destinations above and the route mapping for Calendar/Planner, Templates, Activity, and Import. This plan recommends them as the default direction.
- Create isolated local/preview fixtures for: first-use empty account; populated week; multi-block workout; planned, active, completed, and imported sessions; long history; template cadence variants; and coach roster/assignment. Do not create fixtures in the configured remote database.
- Record the current behavior on phone portrait and landscape before changing the shell. Save desktop screenshots and interaction notes at 1280px as a no-change regression baseline.

### 1. Shared shell, text contrast, and touch behavior

- Change only the athlete **mobile** bottom navigation to **Home / Plan / Workouts / History**; route the Plan tab into the mobile agenda and expose scheduling there. Keep direct URLs and drawer links for every existing page. Keep desktop navigation items and order unchanged. Confirm mobile nav labels/active states remain understandable and keyboard accessible.
- Review role-specific navigation before changing coach affordances. Preserve existing coach URLs and authorization; do not route coach users to athlete pages.
- Fix the two measured contrast failures in mobile-scoped text roles/overrides, then check actual mobile backgrounds and small text in inactive, selected, disabled, and status states. Do not change global tokens or desktop colors in this task. Re-run the focused mobile accessibility scan and the exact route axe checks for previously reported main-landmark/template-role issues.
- If an accessibility finding needs a global code or visual change to fix, record it as a separate follow-up; include it in this work only when it can be corrected without changing desktop output.
- Define a mobile coarse-pointer touch rule: 44px target for frequent actions; smaller controls only when well spaced, not destructive, and still comfortably usable. Use visible labels for important actions and do not rely on hover. Keep desktop control dimensions unchanged.
- Verify drawer focus, bottom bar, fixed footers, safe area, keyboard, 200% text zoom, and overflow measurement. Avoid using `overflow-x: clip` as proof that content fits.

### 2. Plan and scheduling

- Add an agenda mode to the mobile Plan entry, reusing calendar/session data owners rather than adding a second source of schedule truth. Keep desktop Calendar and Planner presentations and entry points unchanged.
- Make selected day and its session list the primary mobile content. Make the month view secondary and provide an accessible, thumb-sized way to move dates at 320px.
- Convert schedule placement into the focused source → date/time → review → confirm flow. Keep current day/week/month cadence operations available under advanced options and show exact date range before commit.
- Verify assignment removal, conflict/validation feedback, source-empty states, and return-to-selected-date. Preserve the coach Planning Desk behavior.

### 3. Workout authoring and templates

- Add a phone-only editor mode based on an ordered block list and touch controls; gate it by the mobile presentation condition rather than a general container query that could restyle a narrow desktop panel. Retain the existing desktop canvas and use the timeline as an orientation preview on phone.
- Keep editing one block at a time, with explicit add, edit, reorder, duplicate, and remove controls. Preserve unsaved-change protection, validation, target presets, target editing, and session settings.
- Move exact/advanced controls into labeled disclosures, not out of the product. Place save status and Save action above the bottom navigation and keyboard.
- Surface templates as a Workouts subview; make cadence selection and affected dates clear in the create/reuse flow.

### 4. Session execution and outcome review

- Reorder mobile session detail around the immediate task and saved outcome; keep plan/actual context and unavailable metric explanations visible.
- Refine the live stepper for one-handed execution and recovery. Keep timer behavior unchanged unless separately specified; test sleep/resume and delayed foregrounding.
- Promote History into mobile bottom navigation only. Make a completed phone row open detail; move compare and dense sensor review to the detail surface on phone while retaining all existing data and notes. Keep the desktop Activity page unchanged.
- Coordinate with any active ACTIVITY-001 history work before changing the feed service. Reuse its pagination/filter support if available; this mobile plan adds only the phone controls and presentation. If service support is still needed, preserve the existing default response and desktop first-12 page, and expose older rows through the phone-only control.
- Verify the personal journey end to end: create workout → schedule → inspect upcoming → start/pause/advance/finish → save outcome/notes → find in History → review and compare.

### 5. Import and supporting pages

- Refine the phone import steps and progress/errors without changing supported formats or limits before a device profile exists. Keep the desktop Import flow unchanged. Test large and multi-file cases on actual devices.
- Check Profile/Settings pinned controls with native keyboards, plus authentication, share, and discovery layouts.
- Review coach pages for one-column usability and shared-shell regressions. Keep coach expansions secondary to self-directed training but do not remove or weaken them.

### 6. Cross-device release acceptance

- Run the full route/state matrix on physical iOS Safari and Android Chrome. Add a fresh mobile pass for all current production routes, both empty and populated, and verify a long-content and error state for each relevant workflow.
- Check 320, 360, 390, and 430px portrait; phone landscape around 667×375 and 844×390; 768px tablet; and 1280px desktop. Check both orientation changes and browser chrome/safe-area insets.
- Check keyboard-only operation, VoiceOver or TalkBack spot checks, 200% zoom/text scaling, minimum contrast, touch target spacing, and focus visibility.
- Measure document and key content widths and inspect the screen edges so clipped content is found even when scrollbars are hidden.
- Profile the largest supported import on a representative mid-range phone. Confirm parsing progress, memory behavior, cancellation/recovery, and charts do not make the rest of the app unresponsive.
- Recheck the 1280px desktop baseline after every shared-component change. Treat any desktop screenshot, navigation, control-size, data-output, or interaction difference as out of scope and correct it before the mobile work is accepted.

### Acceptance definition for implementation

- A first-time athlete can finish the complete create → schedule → execute → complete → review flow on a phone without a desktop-only action, drag-only control, or accidental loss of context.
- Today’s/next workout and completed history are each reachable in one tap from the mobile bottom navigation.
- Scheduling works at 320px without requiring precise taps on narrow month cells; the month calendar remains available.
- Every workout can be built and adjusted with explicit touch controls; the phone layout keeps the current block list, target, and save state clear.
- Live controls remain reachable with one hand, safe-area padding, browser chrome, portrait/landscape, pause/resume, and app return.
- All production routes have current iOS and Android evidence for empty and populated states; unresolved exceptions are named and accepted explicitly rather than inferred from desktop screenshots.
- Small text meets 4.5:1 contrast; status is not communicated by color alone; frequent mobile targets aim for 44px.
- At the 1280px desktop regression target, visual layout, navigation, action order, control dimensions, and default data output are unchanged. Supporting service/API changes preserve existing default behavior and are invoked only by the mobile-only affordance.

### Decisions to confirm when implementation starts

- Whether the mobile Plan destination should open `/athlete/calendar` as an agenda or introduce a dedicated mobile hub route that composes Calendar and Planner. Recommendation: keep canonical routes and let Calendar own the mobile agenda initially, avoiding a new route until a prototype proves it necessary.
- Whether templates should be a segmented view or a nested tab under Workouts. Recommendation: use a clearly labeled Templates subview in the Workouts area and preserve `/athlete/templates` as a deep link.
- How much of coach navigation should be surfaced on mobile while the role remains transitional. Recommendation: preserve all routes and existing behavior, but defer coach-specific bottom destinations until the coach workflow is prioritized.

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
- Session and activity data ownership: [athlete-service.ts](../../lib/athlete-service.ts), [athlete-execution.ts](../../lib/athlete-execution.ts)
- Current evidence and ownership index: [CURRENT-STATUS.md](CURRENT-STATUS.md), [WORK-INDEX.md](WORK-INDEX.md)
