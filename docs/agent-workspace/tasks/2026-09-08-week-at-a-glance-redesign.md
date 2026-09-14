# Task: Week-at-a-glance product redesign

- **Status:** `in-progress`
- **Agent:** `OpenCode / current session`
- **Started:** `2026-09-08`
- **Updated:** `2026-09-14`
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`, `COACH-001`, `PLAN-001`, `TEMPLATE-001`
- **Related records:** [shell](../features/shell.md), [athlete](../features/athlete.md), [coach](../features/coach.md), [planner](../features/planner.md), [templates](../features/templates.md), [decision](../decisions/0017-week-at-a-glance-redesign.md)

## Goal

Replace the incumbent navy split-board visual world with a coherent
week-at-a-glance system that improves scan speed, interaction efficiency, and
calm information density across the authenticated athlete and coach surfaces.
Product truth, route behavior, Monday-based planning, role ownership, and
operational states remain intact.

## Starting Context

- Current behavior: authenticated routes use a navy/cool-white split-board system
  with shared shell and Tempo primitives.
- Existing owner/service: shared tokens in `app/globals.css`, primitives in
  `components/ui.tsx`, role navigation in `lib/app-navigation.ts`, and route-local
  pages/components under `app/(app)` and `components/`.
- Related active or transitional work: universal sharing remains `in-progress`;
  browser viewport acceptance is still outstanding; this task is visual/UX work
  and must not change service ownership or sharing semantics.

## Plan

- [x] Confirm replacement visual direction and sequence page families with the owner.
- [x] Document incumbent tokens/components and extract the shared target system.
- [x] Critique and implement the shared shell/primitives in one bounded batch.
- [x] Critique and implement athlete weekly surfaces: Home and Calendar.
- [x] Critique and implement athlete execution/history surfaces: Workouts, Session, Live, Activity.
- [x] Critique and implement athlete planning/reuse and coach families in bounded batches.
- [x] Run responsive/accessibility verification, detector, finish review, and update design records.

## Progress Log

### 2026-09-08

- What changed: Completed Impeccable shape discovery and locked the safer
  `Week-at-a-glance planner` direction after a reroll.
- Decision or discovery: The redesign is in-app first, athlete before coach,
  full-state, desktop/mobile, keyboard-aware, and optimized for information
  density plus fewer interaction steps without a cramped result. The chosen
  system makes the Monday-first training week the primary organizing surface.
- Files touched: task record, decision record, work index.
- Verification: Impeccable context and craft-floor loaded; direction selection
  recorded by `impeccable concept-seed`.
- Blocker or next step: document and extract the shared system before the first
  UI batch.

### 2026-09-08 (foundation critique)

- What changed: Completed dual-agent critique of the shared shell, tokens, UI
  primitives, and Tempo primitives; persisted the synthesis at
  `.impeccable/critique/authenticated-app-foundation.md`.
- Decision or discovery: The detector is clean, but the foundation is still a
  category-interchangeable split-board/card stack. Highest-value first fixes are
  semantic week-first tokens, intentional mobile destinations, state semantics,
  and calmer shared depth/focus behavior.
- Files touched: critique snapshot only.
- Verification: Assessment A scored 22/40; Assessment B detector returned `[]`;
  no browser evidence was available.
- Blocker or next step: implement only the selected foundation fixes before
  critiquing Home and Calendar.

### 2026-09-08 (foundation batch)

- What changed: Replaced shared navy split-board tokens with the initial
  week-first light system; added the `wall` shell tier, semantic status/state
  tokens, intentional role-aware mobile destinations, drawer Escape/focus
  recovery, safe-area padding, calmer surfaces/actions, and shared accessibility
  summaries for workout bars and steps.
- Decision or discovery: Keep the existing shared seams and domain data; use
  the token layer and primitives to establish the new world before migrating
  route-local composition.
- Files touched: `app/globals.css`, `lib/app-navigation.ts`,
  `components/AppShell.tsx`, `components/AppSidebar.tsx`,
  `components/ui.tsx`, and Tempo primitives.
- Verification: `pnpm test` (175 pass), `pnpm lint`, `pnpm build`,
  `git diff --check`, and Impeccable detector (`[]`) pass on 2026-09-08;
  build retains the existing middleware deprecation warning. Browser viewport
  inspection remains unavailable.
- Blocker or next step: critique the athlete Home + Calendar family and batch
  only its highest-value week-visibility improvements.

### 2026-09-08 (athlete weekly critique)

- What changed: Completed dual-agent critique of athlete Home and Calendar;
  persisted the synthesis at `.impeccable/critique/authenticated-athlete-weekly.md`.
- Decision or discovery: The read model already contained the needed session
  states and Monday-first data. The main issue was composition: Home needed a
  real seven-day context and explicit next action, while Calendar needed aligned
  day groups rather than nested cards.
- Files touched: critique snapshot only.
- Verification: Assessment A scored 23/40; Assessment B detector returned `[]`;
  no browser evidence was available.
- Blocker or next step: implement Home + Calendar only, then verify all gates.

### 2026-09-08 (athlete weekly batch)

- What changed: Added additive `weekDays` data to `athleteService`, created the
  shared `SessionRow`, redesigned Home around Next action + Week at a glance,
  aligned Calendar week/month status grammar, and added semantic loading/error,
  retry, selected-view, and day-focus treatments.
- Decision or discovery: Preserve existing session routes and `from` context;
  the new week wall is a presentation/read-model change, not a persistence or
  service-boundary change.
- Files touched: `lib/athlete-service.ts`, `components/tempo/SessionRow.tsx`,
  athlete Home/Calendar files, and updated source-contract tests.
- Verification: `pnpm test` (175 pass), `pnpm lint`, `pnpm build`,
  `git diff --check`, and Impeccable detector (`[]`) pass on 2026-09-08;
  build retains the existing middleware deprecation warning. Browser viewport
  inspection remains unavailable.
- Blocker or next step: critique the athlete execution/history family.

### 2026-09-08 (athlete execution critique)

- What changed: Completed dual-agent critique of athlete Workouts, Session,
  Live, and Activity; persisted the synthesis at
  `.impeccable/critique/authenticated-athlete-execution.md`.
- Decision or discovery: The family’s domain model and mutation seams are
  strong, but week/date context and state-derived actions disappeared after
  leaving Calendar. The first pass should fix continuity and recoverable
  feedback before deeper comparison or editor ergonomics.
- Files touched: critique snapshot only.
- Verification: Assessment A scored 22/40; Assessment B detector returned `[]`;
  no browser evidence was available.
- Blocker or next step: implement the bounded context/action/recovery batch.

### 2026-09-08 (athlete execution batch)

- What changed: Moved scheduled work ahead of the athlete library, reused
  `SessionRow`, added week/date/status context to Session and Live, made Session
  actions state-derived, added recoverable/announced completion feedback and a
  labelled notes field, hardened empty Live sessions, and aligned Activity to
  the latest-12 review scope.
- Decision or discovery: Keep unassigned authoring separate from scheduling;
  improve order and context without changing service ownership or mutation APIs.
- Files touched: athlete Workouts, Session, Live, Activity, `SessionDetailClient`,
  `LiveSessionClient`, `components/ui.tsx`, and tests through shared contracts.
- Verification: `pnpm test` (175 pass), `pnpm lint`, `pnpm build`,
  `git diff --check`, and Impeccable detector (`[]`) pass on 2026-09-08;
  build retains the existing middleware deprecation warning. Browser viewport
  inspection remains unavailable.
- Blocker or next step: critique coach oversight.

### 2026-09-08 (coach oversight critique)

- What changed: Completed dual-agent critique of coach roster and athlete
  detail; persisted the synthesis at
  `.impeccable/critique/authenticated-coach-oversight.md`.
- Decision or discovery: Coach data already provides a Monday-first week, but
  the roster and detail compositions did not share the athlete week grammar.
  The highest-value fixes were direct planning handoffs, real empty state,
  reliable next-session selection, and contextual repeated actions.
- Files touched: critique snapshot only.
- Verification: Assessment A scored 22/40; Assessment B detector returned `[]`;
  no browser evidence was available.
- Blocker or next step: implement the bounded coach oversight batch.

### 2026-09-08 (coach oversight batch)

- What changed: Added roster empty/action states, direct per-athlete planning
  handoffs, a planned/adjusted-first next-session selection, aligned coach
  athlete-week groups with today emphasis and day-level assignment links, and
  contextual Compare/Share labels.
- Decision or discovery: Preserve coach ownership, comparison, sharing, and
  planner route boundaries; this is a read/composition improvement.
- Files touched: `lib/coach-service.ts`, coach roster/detail pages,
  `components/ShareLinkButton.tsx`, and source-contract tests.
- Verification: `pnpm test` (175 pass), `pnpm lint`, `pnpm build`,
  `git diff --check`, and Impeccable detector (`[]`) pass on 2026-09-08;
  build retains the existing middleware deprecation warning. Browser viewport
  inspection remains unavailable.
- Blocker or next step: critique coach authoring and assignment.

### 2026-09-08 (coach authoring critique)

- What changed: Completed dual-agent critique of coach Workouts, Templates,
  Planner, Source Assignment, and Builder boundary; persisted the synthesis at
  `.impeccable/critique/authenticated-coach-authoring.md`.
- Decision or discovery: Ownership/cadence/snapshot semantics are valuable but
  source and target state can diverge in the Planner. Reliability and target
  synchronization were higher value than a full three-pane replacement for
  this bounded pass.
- Files touched: critique snapshot only.
- Verification: Assessment A scored 19/40; Assessment B detector returned `[]`;
  no browser evidence was available.
- Blocker or next step: implement the bounded coach authoring/assignment batch.

### 2026-09-08 (coach authoring batch)

- What changed: Synchronized Planner and Source Assignment athlete state,
  refreshed the week after assignment with source/athlete-specific feedback,
  normalized training-plan week input, added transport recovery and live
  feedback to Planner/source operations, confirmed Planner deletion, and kept
  all visible athlete-day sessions available.
- Decision or discovery: Preserve source-copy ownership, snapshot independence,
  Monday boundaries, and the Builder compatibility redirect.
- Files touched: `PlannerClient.tsx`, `SourceAssignmentPanel.tsx`, and related
  coach planner contracts/tests.
- Verification: `pnpm test` (175 pass), `pnpm lint`, `pnpm build`,
  `git diff --check`, and Impeccable detector (`[]`) pass on 2026-09-08;
  build retains the existing middleware deprecation warning. Browser viewport
  inspection remains unavailable.
- Blocker or next step: run the cross-app audit and finish review.

### 2026-09-08 (finish audit)

- What changed: Ran the independent dual-agent finish review and final
  technical audit, addressed the identified P1 integrity/accessibility risks,
  finalized `DESIGN.md` and `.impeccable/design.json`, and persisted the finish
  synthesis at `.impeccable/critique/authenticated-app-finish.md`.
- Decision or discovery: The week-first world is coherent and product-specific
  across the athlete loop and coach oversight, but Coach Planner remains a
  deliberate follow-up for workflow consolidation. Browser evidence is the
  remaining verification blocker, not an inferred pass.
- Files touched: shared shell, session row/editor, all bounded family surfaces,
  final design artifacts, critique snapshots, history, and workspace records.
- Verification: final detector `[]`, `pnpm test` (175 pass), `pnpm lint`,
  `pnpm build`, and `git diff --check` pass on 2026-09-08. Build retains the
  existing middleware deprecation warning. No browser is connected.
- Blocker or next step: manual browser acceptance and an explicit decision on
  deferred Coach Planner/comparison/loading-boundary work.

### 2026-09-08 (finish hardening)

- What changed: Resolved the finish audit's highest-value source findings:
  visible date context and complete SessionRow names, stronger muted contrast,
  2xl-only seven-column walls, keyboard-operable block reordering, isolated
  mobile drawer focus, and the stale TopBar eyebrow contract.
- Decision or discovery: The design detector's type-ramp advisories were closed
  by documenting the actual compact type scale in the final design system,
  rather than changing established product copy or shrinking the UI.
- Files touched: `SessionRow`, `SessionComposer`, `AppShell`, `AppSidebar`,
  `TopBar` callers, `app/globals.css`, and `DESIGN.md`.
- Verification: final detector `[]`, 175 tests, lint, build, and diff check pass;
  no browser is connected.
- Blocker or next step: manual browser acceptance remains the only required
  verification before changing this task to `completed`.

### 2026-09-08 (athlete planning critique)

- What changed: Completed dual-agent critique of athlete Planner, Templates,
  and coach discovery; persisted the synthesis at
  `.impeccable/critique/authenticated-athlete-planning.md`.
- Decision or discovery: The Monday-first data model and ownership seams are
  sound, but planning obscures selected scope and template/discovery actions
  compete. Reliability and role-specific language were higher value than a
  full composer redesign for this bounded pass.
- Files touched: critique snapshot only.
- Verification: Assessment A scored 20/40; Assessment B detector returned `[]`;
  no browser evidence was available.
- Blocker or next step: implement the bounded planning/reuse batch.

### 2026-09-08 (athlete planning batch)

- What changed: Added Today and selected-day summaries to Planner, tied pending
  state to save requests, added network recovery and delete confirmation,
  tailored shared template vocabulary/actions by role, and hardened coach
  discovery labels, live feedback, pending continuation, and search recovery.
- Decision or discovery: Keep the existing editor, cadence, request, and
  ownership contracts; improve clarity around them rather than inventing new
  persistence behavior.
- Files touched: athlete Planner/Templates/discovery, shared template/share
  clients, and source-contract tests.
- Verification: `pnpm test` (175 pass), `pnpm lint`, `pnpm build`,
  `git diff --check`, and Impeccable detector (`[]`) pass on 2026-09-08;
  build retains the existing middleware deprecation warning. Browser viewport
  inspection remains unavailable.
- Blocker or next step: critique coach authoring and assignment.

### 2026-09-08 (browser finish review)

- What changed: Completed the visual acceptance pass with local headed Chrome
  through CDP after the connected OpenCode desktop-browser bridge reported no
  desktop browser. Added a 44px minimum width and shared focus ring to the
  calendar day-focus controls after the review found their content-sized
  21–30px widths.
- Decision or discovery: Headed Chrome on `DISPLAY=:0` provided real pointer and
  hover media, so hover behavior was verified rather than inferred from CSS.
  Headless Chrome was used first for automated route/overflow collection but
  remained insufficient for hover acceptance.
- Files touched: `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`
  and this task record.
- Verification: Authenticated athlete and coach route families were loaded at
  1440×1000, 1024×900, and 390×844. Dense scheduled Calendar, completed
  Session, Live stepper, coach roster/detail, coach Workouts, Planner, and
  Templates states were reviewed. No horizontal overflow, console errors, or
  sub-32px visible interactive targets remained. Mobile drawer open/close,
  focus isolation, Tab cycling, Escape recovery, and focus restoration passed.
  Hover styles changed from surface/#C8D3D9 to field-surface/#155EEF on headed
  Chrome. Key text/token contrast ratios are at least 4.95:1, with body ink
  at 14.77:1 and primary action text at 5.41:1.
- Blocker or next step: This bounded redesign is complete. Public sharing
  browser acceptance, full mutation-flow interaction coverage, and the
  deferred Coach Planner consolidation/comparison/loading-boundary decisions
  remain separate follow-up work.

### 2026-09-08 (final browser acceptance)

- What changed: Ran the authenticated athlete and coach route matrix in local
  headed Chrome through CDP on `DISPLAY=:0`, then fixed the one material mobile
  finding: the shared `SessionComposer` skipped-block checkbox now has a
  `44px` label hit area and pointer cursor.
- Decision or discovery: The connected OpenCode browser bridge remains
  unavailable, but local headed Chrome is a real desktop browser with X11
  pointer media and supplied the required runtime evidence. The current seeded
  week is intentionally empty; the prior Monday week was used for dense
  scheduled/completed content. The coach Planner's competing paths and lack of
  visible week navigation were confirmed as deferred product work per the
  owner's instruction, not fixed in this acceptance pass.
- Files touched: `components/SessionComposer.tsx`, this task record, feature
  records, the finish critique, and the append-only history record.
- Verification: Athlete Home, Calendar week/month, Workouts, Session, Live,
  Activity, Planner, Templates, and discovery plus coach roster, athlete
  detail, Workouts, Templates, and Planner were inspected at `390x844`,
  `1280x900`, `1440x1000`, and `1920x1080`. The matrix covered 64 route/width
  states. No horizontal overflow, runtime exceptions, or console errors were
  found. Mobile drawer Tab focus stayed inside the drawer for ten cycles,
  Escape closed it, focus returned to `Open menu`, and role boundaries
  redirected correctly. All checkbox label hit areas measured at least `44px`.
- Blocker or next step: No browser blocker remains for this bounded redesign.
  Public sharing acceptance, planned-edit/actual/comparison mutation-flow
  coverage, Coach Planner consolidation and week navigation, comparison dialog
  focus/deltas, route-level loading/error boundaries, and complete month-source
  assignment remain explicitly deferred per the owner's instruction.

### 2026-09-09 (continuation browser blocker)

- What changed: Resumed from the handoff after the server restart without
  repeating the completed UI batches. Rechecked the connected browser bridge
  and reran source-level verification.
- Decision or discovery: The desktop browser bridge remains disconnected in this
  session, so no new viewport, focus, hover, touch-target, or runtime evidence
  is claimed. Existing local headed-Chrome evidence remains historical context;
  this task stays `in-progress` until the owner authorizes a browser-backed
  acceptance pass for the required widths.
- Files touched: coordination records only; no product code changed in this
  continuation.
- Verification: `pnpm test` (175 passing), `pnpm lint`, `pnpm build`,
  `git diff --check`, and the focused Impeccable detector (`[]`) pass on
  2026-09-09. A broad detector scan also reported advisory-only token/ramp
  findings in shared `app/globals.css`; no changes were made for those findings.
- Blocker or next step: Connect or authorize a desktop browser, then inspect
  the agreed athlete and coach route matrix at 390px, 1280px, 1440px, and wide
  desktop before changing this task to `completed`.

### 2026-09-11 (athlete Home overview polish)

- What changed: Removed duplicate Calendar actions from the athlete Home page,
  gave the empty next-action state a Planner handoff, moved overview settings
  out of the data-card grid, and added a four-column large-desktop week tier
  with modest wide-screen spacing.
- Decision or discovery: Keep the top-bar Calendar action as the single global
  Calendar entry point; the week wall should own weekly context rather than
  repeat navigation.
- Files touched: `app/(app)/athlete/page.tsx` and this task record.
- Verification: `pnpm test` (175 passing), `pnpm lint`, `pnpm build`,
  `git diff --check`, and the focused Impeccable detector (`[]`) pass on
  2026-09-11. Browser viewport inspection remains unavailable in this session.
- Blocker or next step: Review the updated Home layout at mobile, intermediate,
   and wide desktop sizes when browser access is available.

### 2026-09-13 (calendar-only empty state)

- What changed: Removed the standalone “No sessions this week” summary from the
  Calendar route so an empty week remains represented by the calendar itself.
- Decision or discovery: Calendar is the complete view for this surface; it
  should not append a second workout summary when there are no assigned sessions.
- Files touched: `app/(app)/athlete/calendar/page.tsx`, the athlete feature
  record, this task record, the work index, and the dated history record.
- Verification: Direct calendar tests (8 passing), `pnpm lint`,
  `git diff --check`, and the focused Impeccable detector (`[]`) pass. The full
  test suite and production build exceeded the available timeout during
  unrelated long-running work.
- Blocker or next step: None for this scoped Calendar change.

### 2026-09-13 (calendar status density)

- What changed: Removed visible planned/completed status badges from Calendar
  workout rows in both week and month views. Completed rows now use a subtle
  muted treatment so active work carries the visual emphasis.
- Decision or discovery: Keep status in accessible session labels while removing
  repeated status text from the visual calendar grammar; Home and Workouts retain
  their existing status badges.
- Files touched: `app/(app)/athlete/calendar/page.tsx`,
  `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`,
  `components/tempo/SessionRow.tsx`, the athlete feature record, the work index,
  and the dated history record.
- Verification: Direct calendar tests (8 passing), `pnpm lint`,
  `git diff --check`, and the focused Impeccable detector (`[]`) pass.
- `pnpm exec tsc --noEmit` remains blocked by existing unrelated test fixture
  errors in coach planner/assignment and session comparison tests; no errors
  were reported in the changed Calendar or SessionRow source.
- Blocker or next step: None for this scoped Calendar change.

### 2026-09-13 (calendar time density)

- What changed: Removed assignment times from visible Calendar workout rows in
  both week and month views. Session detail remains the drill-in location for
  time information.
- Decision or discovery: Keep Calendar focused on day, workout, sport, and
  completion emphasis; preserve time data for detail views and other surfaces.
- Files touched: `app/(app)/athlete/calendar/page.tsx`,
  `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`,
  `components/tempo/SessionRow.tsx`, the athlete feature record, the work index,
  and the dated history record.
- Verification: Direct calendar tests (8 passing), `pnpm lint`,
  `git diff --check`, and the focused Impeccable detector (`[]`) pass.
- Blocker or next step: None for this scoped Calendar change.

### 2026-09-13 (shared workout card variants)

- What changed: Standardized the Home week cards, Calendar week cards, Calendar
  month tiles, and Workouts cards on the shared `SessionRow` primitive. Added
  explicit `default`, `compact`, and `month` variants plus a card-sized block
  bar option; removed the month route's duplicate workout-tile markup.
- Decision or discovery: The card owns the workout title/context/structure/
  metrics/accessibility grammar. Callers choose only the space variant and
  state-density overrides (`showStatus`, `showTime`, `muted`), so calendar
  density decisions remain explicit without creating another card component.
- Files touched: `components/tempo/SessionRow.tsx`,
  `components/tempo/SessionBlockBar.tsx`, athlete Home/Calendar/Workouts pages,
  `DESIGN.md`, athlete feature/work records, decision, and history.
- Verification: Focused athlete/calendar and architecture suite (175 passing),
  `pnpm lint`, `pnpm build`, `git diff --check`, and Impeccable detector (`[]`)
  pass. Build retains the existing middleware-to-proxy deprecation warning;
  browser inspection remains blocked by the disconnected bridge.
- Blocker or next step: Recheck the three card variants at the documented mobile,
  intermediate, and wall widths when browser access is available.

### 2026-09-13 (completed-status UI cleanup)

- What changed: Removed status rendering and the `showStatus` escape hatch from
  `SessionRow`; removed all Calendar/Workouts overrides; made `StatusBadge`
  centrally suppress completed state; and removed the Activity page's dead
  completed badge call.
- Decision or discovery: Completed is a domain state used by actions, metrics,
  history, and muted density treatment, not a visible status badge. Planned,
  adjusted, and missed badges remain available where they help an active
  decision.
- Files touched: `components/tempo/SessionRow.tsx`,
  `components/tempo/StatusBadge.tsx`, athlete Calendar/Workouts/Activity pages,
  the architecture contract test, `DESIGN.md`, and workspace records.
- Verification: The architecture regression was red before the source cleanup
  and green afterward. The full suite now passes with 175 tests; lint, build,
  and `git diff --check` also pass. Build retains the existing middleware-to-
  proxy deprecation warning.
- Blocker or next step: Browser visual inspection remains unavailable because
  the desktop browser bridge is disconnected; no source-level blocker remains.

### 2026-09-14 (shared workout-card intensity timeline)

- What changed: Reworked `SessionBlockBar` at `card` and `compact` sizes into a
  low-profile intensity timeline shared by Home, Calendar week, and scheduled
  Workouts cards. Segment widths still reflect duration and existing colors are
  retained, while Zone 1 through Zone 5 now rise in height. Full-detail bars and
  the month tile remain unchanged for their tighter layout constraints.
- Decision or discovery: Height carries effort, not duration; duration remains
  horizontal, so the combined chart is quick to scan without consuming a full
  card row. The accessible summary now includes each zone as text.
- Files touched: `components/tempo/SessionBlockBar.tsx`, `DESIGN.md`, athlete
  feature/work records, a decision record, and the dated history record.
- Verification: `pnpm test` (175 passing), `pnpm lint`, `pnpm build`,
  `git diff --check`, and Impeccable detector (`[]`) pass. Build retains the
  existing middleware-to-proxy deprecation warning. No local Chromium binary is
  available for a new visual browser pass.
- Blocker or next step: Review the compact timeline at narrow, intermediate, and
  wall widths when browser access is available.

### 2026-09-14 (intensity timeline proportion refinement)

- What changed: Removed the card-bar background, capped the graphic at `18rem`,
  raised the card/compact heights to `32px`/`24px`, and increased the zone rise
  to a direct 20% step per zone.
- Decision or discovery: The first treatment read too much like a wide, flat
  progress strip. A transparent, bounded skyline uses the available card space
  more deliberately while making the high-intensity blocks immediately visible.
- Files touched: `components/tempo/SessionBlockBar.tsx`, `DESIGN.md`, athlete
  feature/work records, this task, and the append-only refinement history.
- Verification: `pnpm test` (175 passing), `pnpm lint`, `pnpm build`,
  `git diff --check`, and Impeccable detector (`[]`) pass. Build retains the
  existing middleware-to-proxy deprecation warning.
- Blocker or next step: Review the revised proportions at narrow, intermediate,
  and wall widths when browser access is available.

### 2026-09-14 (intensity timeline edge refinement)

- What changed: Removed border radius from the card/compact intensity timeline
  container and its individual zone segments. The full-detail structure bar
  preserves its established rounded treatment.
- Decision or discovery: Short blue zone segments looked visually clipped by the
  rounded corners. Square edges make every bar read as a deliberate intensity
  column rather than a truncated pill.
- Files touched: `components/tempo/SessionBlockBar.tsx`, `DESIGN.md`, athlete
  feature/work records, this task, and the append-only edge-refinement history.
- Verification: `pnpm test` (175 passing), `pnpm lint`, `git diff --check`, and
  Impeccable detector (`[]`) pass. A production build is rerun after this record.
- Blocker or next step: Review the square-edge treatment at narrow, intermediate,
  and wall widths when browser access is available.

## Verification

- `impeccable concept-seed --kind pick --from c1410433 --scope direction --mode operate --reroll 1 --register safer` — choice recorded on 2026-09-08
- `pnpm test` — 175 passing on 2026-09-08.
- `pnpm lint` — pass on 2026-09-08.
- `pnpm build` — pass on 2026-09-08; existing middleware-to-proxy deprecation warning remains.
- `git diff --check` — pass on 2026-09-08.
- `/home/forsvaret/.config/opencode/skills/impeccable/scripts/impeccable detect --json 'app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx'` — `[]`.
- Browser finish review — headed Chrome via CDP on `http://localhost:3002` at
  wide, intermediate, and narrow viewports; authenticated athlete and coach
  route matrix, responsive layout, focus, drawer, touch target, contrast, and
  hover evidence recorded above. The OpenCode desktop-browser bridge itself
  remained disconnected.
- `/home/forsvaret/.config/opencode/skills/impeccable/scripts/impeccable detect --json "app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx" components/SessionComposer.tsx components/tempo/SessionRow.tsx components/tempo/StatusBadge.tsx components/tempo/SessionBlockBar.tsx components/tempo/Stepper.tsx components/tempo/Toggle.tsx components/ui.tsx components/AppShell.tsx components/AppSidebar.tsx` — `[]` on 2026-09-08.
- Browser evidence artifacts — `/tmp/opencode/tempo-browser-evidence/acceptance.json`, `/tmp/opencode/tempo-browser-evidence/confirmation.json`, and route screenshots generated by the headed Chrome CDP pass on 2026-09-08.
- Final post-fix gates — `pnpm test` (175 passing), `pnpm lint`, `pnpm build`, and `git diff --check` pass on 2026-09-08; build retains the existing middleware-to-proxy deprecation warning.

## Handoff / Completion

- **Final status:** `in-progress` — browser acceptance is blocked in the current
  session by the disconnected desktop browser bridge.
- **History record:** [week-at-a-glance redesign](../history/2026-09-08-week-at-a-glance-redesign.md)
- **Feature records updated:** [shell](../features/shell.md), [athlete](../features/athlete.md), [coach](../features/coach.md), [planner](../features/planner.md), [templates](../features/templates.md), [onboarding](../features/onboarding.md)
- **Remaining work:** complete browser acceptance, then decide whether to fund deferred Coach Planner consolidation,
  comparison focus/deltas, route-level loading/error boundaries, and existing
  sharing acceptance; run browser acceptance for SHARE-001 separately.
- **Deferred proposal:** keep the current week-first route system shipped and
  fund separate bounded batches for (1) Coach Planner consolidation plus week
  navigation, (2) comparison dialog focus/delta semantics, and (3) route-level
  loading/error boundaries. Run public sharing browser acceptance independently;
  do not fold those changes into this redesign task.
