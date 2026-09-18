# Functional reliability repair plan

Prepared 2026-09-17. Implementation completed 2026-09-18. Each repair was verified, committed, and pushed separately. The completion evidence is recorded in CURRENT-STATUS.md.

## Completion

All eight repairs shipped to main: perceptible builder placement, operation-specific Planner feedback, strict template ranges and shortcuts, editable self-planned sessions, correct personal planned baselines and actual comparisons, canonical repeated-block durations, stale-selection clearing, and atomic retry-safe placement. Final verification passed 196 tests, lint, production build, migrated-SQLite replay and concurrent-request checks, and the fresh-account Chromium journey documented in CURRENT-STATUS.md.

## Objective and order

A fresh personal account can create, schedule, edit, complete, and review training reliably. Address all six functional findings and the interaction feedback gates below before feature expansion. Every repair must preserve or improve the existing UX; interaction feedback is part of correctness, not a later polish pass. Implement in the order below; each change includes its regression checks. Preserve coach behavior and authorization. Do not reset the development database or discard unrelated work.

## 1. Restore editing of personal scheduled sessions — P1

Owners: lib/athlete-session-adjustment-service.ts, its tests, and the athlete session PATCH adapter.

- First reproduce the missing Assignment failure using an isolated SQLite database and a session created through the personal planner service.
- Keep session/block edits atomic. Update assignment lineage when present; personal sessions must not require a synthetic coach assignment.
- Preserve coach-assigned target-date updates, ownership checks, and completed-session edit rejection.
- Verify title/block edits and cross-week rescheduling persist after reload. Test both personal workout and template copies, a coach-assigned session, another user's session, and a completed session.

Acceptance: a personal user can adjust a scheduled session without a 500 response; coach lineage remains correct and unauthorized edits cannot write.

## 2. Preserve the planned baseline before completion — P1

Owners: lib/athlete-completion-service.ts, lib/session-snapshot-service.ts, lib/athlete-planner-service.ts, and comparison tests.

- Define personal baseline as the planned prescription captured before the first actual write; retain an existing baseline, including coach baselines.
- In the same transaction that saves actuals, capture a missing baseline from the persisted planned session before replacing blocks. Cover both quick completion and direct actual-outcome saving.
- Ensure repeated completion and later corrections do not overwrite that baseline. Verify reopen/recomplete behavior against the existing product contract.
- Test differing actual duration, repetitions, notes, and RPE, plus identical planned/actual outcomes and reloads.
- For already-completed legacy sessions with no baseline, report it as unavailable. Do not fabricate an original plan from current actual blocks or a mutable library source.

Acceptance: schedule → complete → correct actual → compare retains the original prescription and the latest actual outcome. Coach baselines remain unchanged.

## 3. Enforce template date rules on the server — P2

Owners: lib/template-cadence.ts, lib/athlete-planner-service.ts, lib/assignment-service.ts, and assignment routes/tests.

- Validate the complete request before any write: reject malformed date entries rather than silently dropping them.
- Enforce the current Planner contract: day = one date; week = seven consecutive dates starting Monday; month = every date of one calendar month.
- Explicitly handle the shared validator's current single-date shortcut. Trace legacy callers before changing it; preserve intentional legacy anchor behavior through an explicit compatibility path, not an implicit bypass in the current Planner API.
- Return an actionable 400 response for invalid selections.
- Cover partial ranges, gaps, wrong anchors, month boundaries, February/leap years, invalid dates, and unauthorized sources. Verify rejected requests leave no plans or sessions behind.

Acceptance: direct API requests obey the same rules as the Planner, and valid ranges create the expected sessions.

## 4. Make multi-date placement atomic and safe to retry — P2

Owners: personal/shared assignment services, assignment API, PlannerDesk, and Prisma schema if needed.

- Wrap source validation/read, plan creation, copied sessions, and associated records in one transaction using its transaction client throughout.
- Add a request identity for each deliberate placement action. Persist the result with the batch, scoped to the authenticated user and a normalized payload fingerprint.
- Reuse that identity when retrying an uncertain request. The same identity/payload returns the original session IDs; the same identity with a different payload is rejected. A new deliberate placement action gets a new identity and remains possible.
- Enforce retry uniqueness at the database boundary, including concurrent requests; UI button disabling alone is insufficient.
- If schema changes are needed, introduce and verify a data-preserving migration strategy for existing databases before applying them. Do not use a reset or destructive db push.
- Test a failure midway through a batch, concurrent identical requests, a lost-response retry, cross-user key isolation, and intentional repeat placement.

Acceptance: a batch either saves completely or writes nothing, and retrying a committed request creates no duplicates.

## 5. Show correct repeated-workout durations — P2

Owners: athlete and coach PlannerClient adapters, canonical session metrics and persisted-block conversion owners.

- Replace raw duration sums with the existing canonical metric projection; do not add another repetition formula in the UI.
- Preserve the canonical treatment of skipped blocks and legacy null repetition values rather than changing those semantics incidentally.
- Check the library source, Planner preview, and scheduled session agree for the same workout.
- Regression example: a 300-second block with four repetitions shows 1,200 seconds; include mixed repeated/nonrepeated blocks.

Acceptance: athlete and coach Planner durations agree with the canonical workout duration.

## 6. Prevent stale source assignment from empty tabs — P2

Owner: components/PlannerDesk.tsx and interaction tests.

- Clear source selection and stale source-specific range/message state when switching to an empty source tab.
- Require the selected source to belong to the active tab in both button eligibility and the submit guard.
- Cover populated → empty → populated tab changes, source removal after refresh, and keyboard activation. Keep date selection behavior consistent with the selected source type.

Acceptance: an empty tab cannot submit a previously selected hidden workout or template; no assignment request is sent until a valid source is selected.


## Interaction assessment and UX requirements — added 2026-09-17

Audience and purpose: people planning their own training should understand what they can do, where an action will apply, what changed, and whether it saved. Preserve Tempo's Ink Is Movement design, the shared components, and current working capabilities. Favor direct visual feedback and fewer unnecessary steps, with explicit labels and accessible alternatives.

Evidence is from source inspection and user feedback, not a fresh browser reproduction:

- WorkoutBuilder inserts dropped presets and selects the new block, but renders its DragOverlay conditionally with dropAnimation={null} and clears activePresetId immediately. This supports the reported loss of visual continuity; exact perceived behavior needs pointer/touch verification.
- The production PlannerDesk uses source/date selection plus Assign, rather than drag-and-drop. Review the workout sequence and any demonstrated planner preview as separate surfaces. Do not silently replace production planning with a preview interaction or treat new calendar drag support as an existing feature.
- Builder drag announcements expose internal IDs rather than meaningful block names and positions.
- PlannerDesk confirms assignments through a summary message and router.refresh(), without dedicated newly placed session feedback at the destination.
- Assignment and removal share isPending; AssignmentSummary labels any pending operation as Assigning. Date/range messages can retain an unrelated earlier messageTone.

### UX acceptance attached to the six repairs

1. **Personal edits:** keep the draft and relevant focus on failure; identify the failing action beside its controls. Show Saving then Saved only after persistence succeeds. On rescheduling, visibly identify the resulting date/session and preserve useful calendar context.
2. **Baseline and actual:** make Planned and Actual understandable for self-directed users; do not describe every personal prescription as a Coach baseline. Show meaningful differences and units, explain identical results plainly, and state when historical baseline data is unavailable. Keep existing coach context where relevant.
3. **Template dates:** show the selected span and why it is valid or invalid directly on the calendar. Provide a simple whole-week or whole-month selection action aligned with the template cadence, reusing the same validation as explicit selection. Make Monday/full-month anchors visible before submission; do not silently move dates. Preserve exact date selection and explain disabled actions nearby.
4. **Batch assignment:** distinguish placing, confirmed placement, failed placement, and uncertain network outcomes. Give pending/confirmed feedback on the affected dates; reconcile temporary indicators to returned session IDs without duplicates. A pending preview must not look saved. Preserve source/date choices for retry, using the same request identity. Avoid disruptive refresh jumps or moving focus unexpectedly.
5. **Durations:** show the same total and units across source preview and placed session. Where useful, reveal the repetition breakdown without requiring another screen or showing technical metrics internals.
6. **Source tabs:** visible selection, summary, and action must agree. Empty tabs explain how to create that source type; stale messages and hidden selections are cleared. Preserve deliberate date choices where compatible, and explain necessary changes.

### 7. Make drag-and-drop placement perceptible — functional UX priority

Owners: components/WorkoutBuilder.tsx and shared block/feedback primitives; planner preview owners only if the reported interaction is reproduced there. Complete first, alongside the Planner feedback work, per the implementation priority requested by the user.

- Reproduce preset insertion and existing-block reorder with pointer and touch. Record current behavior before changing it; confirm the exact affected route rather than assuming the production Planner supports dragging.
- During drag, clearly mark the valid destination and exact insertion position, with a placeholder or insertion rule matching the resulting order. Show invalid/no destination states; dropping outside or cancelling must not add a block.
- On release, maintain visual continuity from dragged item to the inserted block. Coordinate the preview and destination by block identity so a copied preset settles at the new block, not back at its library source. Do not merely enable the library's default drop animation and assume this fixes copied-item placement.
- Briefly emphasize the inserted/moved block and keep it selected. Keep it visible when needed without gratuitous scrolling. Make the inspector update clearly correspond to that block.
- Distinguish Added to workout (local draft) from Saved (server persistence). Keep the existing undo/reorder/click-insertion capabilities and prevent duplicate insertion from the click that follows a drop.
- Replace raw-ID announcements with block name and resulting position. Preserve meaningful focus and explicit earlier/later controls. Click/tap insertion must give equivalent destination feedback.
- Use restrained existing selection/focus tokens. Reduced-motion mode uses a stable destination cue and announcement instead of spatial animation; color or motion alone never carries the result.

Acceptance: users can identify exactly where the block landed and whether it changed the draft or saved data. Verify insertion at beginning/middle/end, empty and long sequences, same-position reorder, cancellation, outside drop, multi-selection reorder, undo/redo, touch scrolling, keyboard alternatives, and reduced motion. Each completed insertion creates exactly one block and one undoable change.

### 8. Make operation feedback specific and simplify planning

Owners: components/PlannerDesk.tsx and shared status/action primitives. Implement with repairs 3, 4, and 6.

- Track the operation and affected item separately: assignment shows Placing, deletion shows Removing on that session, and neutral selection guidance stays neutral. Derive message tone with each state rather than inheriting an earlier error/success.
- Put the primary visual confirmation where the change happened. Retain a concise accessible summary, but do not make a distant toast or banner the only proof of success.
- Prevent conflicting duplicate actions while preserving harmless inspection/navigation. Keep pending, failure, selection, and saved states visually distinct.
- Review source → dates → placement for redundant instructions and unnecessary clicks. Prefer calendar highlighting, accurate inline summaries, and one clear next action; do not remove labels or compress controls solely to reduce visual density.
- Use current component owners and semantic tokens. Retain reachable mobile controls, visible focus, readable contrast, and screen-reader state announcements.

Acceptance: deleting never claims to be assigning; guidance never inherits stale error/success styling; success/failure identifies the affected workout and dates. A user can determine what will be placed and where before committing, then see the result without searching another screen.

### Combined usability verification gate

- For each repaired action, verify ready → selected/dragging → pending (where persisted) → confirmed or failed → recovered states, including slow responses, network loss, and cancellation.
- Exercise desktop pointer, mobile touch and scrolling, keyboard-only operation, reduced motion, and readable non-color cues. Check names/positions in assistive announcements and avoid noisy repeated announcements.
- Capture a bounded before/after review of the affected production surfaces. Inspect desktop/mobile together, correct discovered issues together, and confirm once; functional failures still require regression coverage.
- Success means accurate data AND an understandable visible result, with no lost working capability or added mandatory steps for the same routine action. Existing 188-test success does not establish these interaction gates.
- Production calendar drag-to-schedule is a possible later enhancement, not a prerequisite or implicit redesign in this repair plan. First repair feedback in existing interactions; if added later, it must use the same validation, transaction, retry, and accessible alternative paths.

## Verification and completion gate

- Add focused regressions with each fix. Use a disposable SQLite database for persistence, missing-record, rollback, and uniqueness behavior; do not rely only on permissive mocks or source-text assertions.
- Run the smallest relevant checks during iteration; before completing behavior changes run pnpm test, pnpm lint, and pnpm build using a documented compatible Node/pnpm environment.
- Complete a fresh-account browser journey without seeded content or a coach: signup → create a repeated workout → schedule multiple dates → edit/reschedule → follow session → complete → correct actual → compare → review Activity → refresh and sign in again.
- In browser acceptance also cover exact template ranges, empty source tabs, removal, month navigation, useful failure feedback, desktop/mobile layouts, and keyboard access. Run a focused coach regression for shared assignment/edit behavior.
- If browser execution is unavailable, leave that acceptance gate open explicitly; passing unit tests does not substitute for it.
- Record actual outcomes in CURRENT-STATUS.md and adjust WORK-INDEX.md ownership/status only when warranted. Create a dated active task brief when implementation starts, then remove it after results are reflected in the current documents.

## Deferred work

Defer broad refactoring, visual experiments, coach feature expansion, and the middleware deprecation cleanup until these functional repairs pass. Fix any accessibility issue that blocks this acceptance journey as part of the journey. Runtime setup and migration work move into scope only where needed to execute these fixes and checks safely.
