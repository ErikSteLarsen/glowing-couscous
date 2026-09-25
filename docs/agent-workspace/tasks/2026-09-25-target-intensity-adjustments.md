# Task: Target intensity adjustments

- **Status:** `in-progress`
- **Agent:** `Codex`
- **Started:** `2026-09-25`
- **Updated:** `2026-09-25`
- **Capability IDs:** `SESSION-001`

## Goal

Allow precise target adjustments for one block, selected blocks, and a whole session, with sport-appropriate power, pace, or heart-rate targets and clear zone semantics.

## Plan

- [x] Add target-range adjustment logic and controls at block, selection, and session scope.
- [x] Give new blocks sport-aware midpoint targets and define shared bounds for all five zones.
- [x] Reclassify zones when adjustments cross a boundary; reset the target when a zone is selected.
- [x] Move session target mode beside Sport and notes beside the title editor.
- [x] Render fine intensity differences in chart height and pauses above the baseline.
- [ ] Verify authenticated desktop and mobile interaction.

## Progress

### 2026-09-25

- Change: Added fine-tuning controls for existing targets, moved target entry into the primary block inspector, and added session-wide target type and per-zone range setup.
- Change: Moved session-wide setup and adjustments into a centered dialog; kept current-block controls in the inspector and collapsed exact range fields.
- Change: Added sport-aware zone midpoint presets, threshold-based zone bounds, automatic zone crossing, fine chart heights, and a visible pause floor. Moved Session targets beside Sport and Notes beside the title.
- Decision or discovery: Shared editor zone boundaries are defined in code and inferred from each persisted block target, so the same target survives normal save and reload without a new schema field. Relative thresholds remain usable when a profile lacks absolute performance values. Existing workouts keep their original targets until edited.
- Files: `components/WorkoutBuilder.tsx`, `components/WorkoutCanvasEditor.tsx`, `components/design/workout-canvas.css`, `lib/workout-target-adjustment.ts`, `lib/workout-zone-intensity.ts`, `lib/workout-target-resolution.ts`, focused tests.
- Verification: Eleven focused target tests, focused lint, diff whitespace check, and the Impeccable layout detector passed. An authenticated desktop browser verified preset insertion, within-zone adjustment, Zone 3 to Zone 4 crossing, zone selection resetting the midpoint, session heart-rate mode, inheritance by a new block, and a visible pause. Full type checking remains blocked by existing Prisma and fixture errors, with no error in changed files. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the dependency-purge prompt. Mobile browser interaction has not been verified.
- Next step: Verify the authenticated editor at mobile width and finish the standard project checks when the dependency prompt can be cleared.
