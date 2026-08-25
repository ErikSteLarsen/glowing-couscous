# Actual Outcome Editing

- **Date:** 2026-08-25
- **Task:** `SESSION-ACTUAL-001`
- **Status:** shipped

## Behavior

- Added `saveActualOutcome` to `lib/athlete-completion-service.ts` for first
  completion and direct correction by the owning athlete or roster coach.
- Actual saves replace current Session blocks and the single Activity outcome in
  one transaction, recompute duration/TSS/zones/segments from the canonical
  actual draft, preserve the completion timestamp, and keep status completed.
- Skipped actual blocks are persisted but excluded from derived metrics.
- Actual RPE, athlete notes, and complete actual snapshot payloads are persisted;
  manual outcomes use `metricsSource: manual-actual`.
- Coach baseline payloads remain unchanged during actual corrections.
- Added role-specific actual PATCH routes and the athlete completed-session
  correction editor using `SessionComposer`.

## Files

- `lib/athlete-completion-service.ts`
- `app/api/athlete/sessions/[sessionId]/actual/route.ts`
- `app/api/coach/sessions/[sessionId]/actual/route.ts`
- `app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx`
- `lib/athlete-service.ts`
- `tests/athlete-completion-service.test.ts`
- `tests/architecture-boundaries.test.mjs`

## Verification

- `node --experimental-strip-types --test tests/athlete-completion-service.test.ts` — 7 passing tests.
- `pnpm test` — 143 passing tests.
- `pnpm exec prisma validate` — pass.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing middleware deprecation warning remains.
- Browser narrow/wide viewport, loading, empty, error, keyboard/focus,
  contrast, and responsive inspection — not run; no browser inspection tool is
  available in this environment.

## Follow-up

- `SESSION-COMPARE-001` should consume the shared snapshot read model and expose
  baseline/actual toggles without adding another persistence path.
- Manual browser verification should be completed before relying on the athlete
  correction editor in production.
