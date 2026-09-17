# Project assessment — 2026-09-17

Scope: source review of personal planning, session editing/completion, authentication, schema, and tests. No application behavior changed. Findings below are source-confirmed; browser reproduction was not performed.

## Prioritized findings

1. **P1 — Personal planned-session edits fail without an Assignment.** `lib/athlete-session-adjustment-service.ts:183` unconditionally updates the Assignment row inside the edit transaction. Personal source placement in `lib/athlete-planner-service.ts:146-205` creates sessions without Assignment rows. The session detail PATCH route calls this adjustment service, so a normal personal-session edit encounters a missing-record error and rolls back. Update lineage only when present and cover a self-scheduled session with a real database regression test.
2. **P1 — Personal completion loses the original plan.** `createSourceCopyData` in `lib/athlete-planner-service.ts:379` does not initialize `coachBaselineJson`. `lib/athlete-completion-service.ts:145-163` replaces the session blocks with actual blocks while preserving that null baseline. Subsequent actual corrections cannot be compared with the original prescription. Capture a planned snapshot before the first actual write, including personal sessions, and test create → schedule → complete → correct → compare.
3. **P2 — Template cadence validation is missing on the personal API path.** `lib/athlete-planner-service.ts:146` calls `sourceDatesForCadence`; that helper accepts arbitrary multiple dates unchanged. A week template submitted with two nonconsecutive dates succeeds despite the exact-range product contract. Apply shared cadence validation server-side and explicitly reconcile the legacy single-date anchor behavior with the current contract. Include rejection tests for partial and nonconsecutive ranges.
4. **P2 — Multi-date assignment can partially save and duplicate on retry.** `lib/athlete-planner-service.ts:148,184` creates plans and sessions sequentially without a transaction or retry identity. A failure after the first date returns an error while retaining earlier sessions; retrying recreates them. Make the batch atomic and define idempotency for retried requests. Reuse shared source-copy ownership where practical, preserving role boundaries.
5. **P2 — Planner source durations ignore repetitions.** `app/(app)/athlete/planner/AthletePlannerClient.tsx:43` and `app/(app)/coach/planner/PlannerClient.tsx:57` sum raw block durations. A 5-minute block repeated four times displays as 5 minutes instead of 20. Use the canonical metric projection already responsible for repetition expansion.
6. **P2 — Switching to an empty source tab retains a hidden selection.** `components/PlannerDesk.tsx:149-154` changes tabs but only changes the selected source when the destination has an item. Select a workout, then switch to an empty Templates tab: the previous workout remains assignable. Clear the selection when the target tab is empty and test that transition.

## Cleanup and verification improvements

- Add a fresh-account browser acceptance test covering workout creation, planning, planned edits, completion, actual corrections, and persisted Activity. The passing suite does not establish that this complete flow works.
- Keep useful architecture checks, but supplement source-text regex assertions and permissive database mocks with database-backed mutation tests. The adjustment mock accepts an Assignment update without checking that a row exists.
- Pin the supported Node and pnpm versions and document dependency installation. The default WSL Node was 18.19.1; verification succeeded with the installed Node 24.8.0. `package.json` has no engines or packageManager declaration.
- Establish a migration/deployment path before retaining production data: the repository currently documents `prisma db push` and seeding, with no migration directory present.
- Resolve the build's middleware-to-proxy deprecation warning.
- Address the contrast, landmarks, and ARIA issues already recorded in CURRENT-STATUS.md. These were not visually reverified during this review.
- Retire transitional planner code only after mapping callers; prioritize the personal workflow defects above over expanding visual experiments.

## Verification

- `pnpm test`: pass, 188 tests.
- `pnpm lint`: pass.
- `pnpm build`: pass; middleware convention deprecation warning remains.
- Commands ran under WSL Ubuntu with Node 24.8.0.
- No browser, external OAuth, or production verification performed.
- Existing `.impeccable/live/` untracked work was preserved.
