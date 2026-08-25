# Baseline Actual Comparison

- **Date:** 2026-08-25
- **Task:** `SESSION-COMPARE-001`
- **Status:** shipped

## Behavior

- Added `lib/session-comparison-service.ts` for role-scoped athlete/coach access
  to the existing stored baseline and actual snapshots.
- Added athlete and coach comparison GET routes.
- Added `components/SessionComparisonDialog.tsx` with loading, error, empty,
  keyboard Escape, close focus, equal-version single view, and full baseline /
  actual toggle states.
- Reused the dialog on athlete session detail, athlete Activity entries, and
  coach athlete-detail session cards.
- Kept comparison views complete and stored; no inferred block-level diff or
  source/template access was introduced.

## Files

- `lib/session-snapshot-service.ts`
- `lib/session-comparison-service.ts`
- `components/SessionComparisonDialog.tsx`
- `app/api/athlete/sessions/[sessionId]/comparison/route.ts`
- `app/api/coach/sessions/[sessionId]/comparison/route.ts`
- `app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx`
- `app/(app)/athlete/activity/page.tsx`
- `app/(app)/coach/athletes/[athleteId]/page.tsx`
- `tests/session-comparison.test.ts`

## Verification

- `node --experimental-strip-types --test tests/session-comparison.test.ts` — 3 passing tests.
- `pnpm test` — 146 passing tests.
- `pnpm db:push --force-reset && pnpm db:seed` — pass.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing middleware deprecation warning remains.
- Browser narrow/wide viewport, loading, empty, error, keyboard/focus,
  contrast, and responsive inspection — not run; no browser inspection tool is
  available in this environment.

## Follow-up

- Manual browser verification and optional browser E2E should cover the dialog
  across mobile and desktop before production reliance.
- Full session-backed API integration coverage remains a separate high-value gap.
