# Task: Workout flow direction previews

- **Status:** `in-progress`
- **Agent:** `gpt-5.6-luna`
- **Started:** `2026-09-15`
- **Updated:** `2026-09-15`
- **Capability IDs:** `SESSION-001`, `LIB-001`

## Goal

Ship three public design-preview routes that make workout authoring easier to
understand and compare: a connected flowline, a focused workbench, and a staged
trail. Each preview should use the Tempo system, expose durable reorder affordances,
and demonstrate real local interactions without changing production persistence.

## Plan

- [x] Add shared interactive preview component and three route entry points.
- [x] Add route-scoped visual language, responsive behavior, and comparison links.
- [x] Run detector, tests, lint, and build.
- [ ] Complete desktop/mobile browser visual verification.

## Progress

### 2026-09-15

- Change: Started three-direction workout authoring preview task.
- Decision or discovery: Existing `WorkoutBuilder` already owns the canonical editor; previews should demonstrate alternate composition and flow rather than fork production behavior.
- Files: Added `WorkoutFlowPreviews`, three `/design/workout-flow/*` route entries, scoped CSS, and Impeccable sidecars.
- Verification: Concept seed `f2a373e6` dealt flowline, workbench, and trail structures. Detector completed with advisory-only scoped token findings. `pnpm test` passes 183 tests, `pnpm lint` passes, and `pnpm build` passes.
- Next step: Verify the three routes in a desktop and mobile browser, including keyboard reorder, touch/pointer drag, preset insertion, Trail intention choices, and reset/save states.

### 2026-09-15 finish pass

- Change: Prevented a completed preset drag from also firing its click insertion, made Trail intention choices real stateful controls, added accessible zone labels, and raised preview drag/picker/choice targets to the 44px touch floor.
- Files: `components/design/WorkoutFlowPreviews.tsx`, `app/globals.css`, `tests/architecture-boundaries.test.mjs`.
- Verification: `pnpm test` passes 183 tests; `pnpm lint` passes; `pnpm build` passes. No browser executable is installed in the environment, so visual verification remains open.

## Completion

- **Final status:** `deferred`
- **Current docs updated:** `WORK-INDEX.md` remains active; `CURRENT-STATUS.md` records the verified implementation and browser gap.
- **Remaining work:** Desktop/mobile browser verification when a browser-capable environment is available.
