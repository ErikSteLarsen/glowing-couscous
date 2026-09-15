# Task: Workbench middle-surface experiments

- **Status:** `in-progress`
- **Agent:** `gpt-5.6-luna`
- **Started:** `2026-09-15`
- **Updated:** `2026-09-15`
- **Capability IDs:** `SESSION-001`, `LIB-001`

## Goal

Add three public Workbench preview routes that preserve the block library and
Block details inspector while exploring stronger middle-surface models for
intensity, full-width session reading, multi-selection, and temporary staging.

## Plan

- [x] Add Terrain, Ribbon, and Staging route entry points.
- [x] Implement intensity height, full-width selection, selection actions, and staging interactions.
- [x] Add responsive styling, tests, and workspace documentation.
- [ ] Complete desktop/mobile browser visual verification.

## Progress

### 2026-09-15

- Change: Added three Workbench middle-surface directions: Terrain, Ribbon, and Staging.
- Decision or discovery: The palette and inspector remain fixed so the experiment isolates the sequence field. Terrain maps block height to zone, Ribbon keeps a duration-weighted session across the full field, and Staging separates temporary repeated work from the final sequence.
- Files: `components/design/WorkoutFlowPreviews.tsx`, `app/globals.css`, and three `/design/workout-flow/workbench/*` route entries.
- Verification: `pnpm test` passes 184 tests, `pnpm lint` passes, and `pnpm build` passes. Browser verification remains open.
- Next step: Compare the three routes in desktop and mobile browsers and choose the strongest middle-surface direction for production extraction.

## Completion

- **Final status:** `deferred`
- **Current docs updated:** `WORK-INDEX.md` and `CURRENT-STATUS.md` record the new routes and remaining browser gate.
- **Remaining work:** Desktop/mobile browser verification and selection of a production direction.
