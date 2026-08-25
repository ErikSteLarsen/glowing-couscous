# Planned Session Adjustments

- **Date:** 2026-08-25
- **Task:** `SESSION-PLAN-ADJUST-001`
- **Status:** shipped

## Behavior

- Added `lib/athlete-session-adjustment-service.ts` for authorized athlete
  planned edits on one assigned Session.
- Athlete edits preserve source/template/assignment ownership fields, set
  `adjusted: true`, keep status planned, move the existing Plan/Assignment date,
  and persist the full canonical block structure including skipped blocks.
- Coach planner edits clear `adjusted`, replace the latest coach baseline, and
  update the existing Assignment target date when moving a session.
- Added the athlete PATCH route at
  `app/api/athlete/sessions/[sessionId]/route.ts`.
- Reused `SessionComposer` for athlete planned editing and added date/time
  controls; the session detail surface visibly exposes the adjusted state through
  the existing status mapping.
- No compatibility planner extension, source synchronization, or new Session
  copy path was introduced.

## Files

- `prisma/schema.prisma`
- `lib/athlete-session-adjustment-service.ts`
- `lib/coach-planner-service.ts`
- `lib/athlete-service.ts`
- `lib/planner-draft.ts`
- `lib/assignment-service.ts`
- `components/SessionComposer.tsx`
- `app/api/athlete/sessions/[sessionId]/route.ts`
- `app/(app)/athlete/session/[sessionId]/page.tsx`
- `app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx`
- `tests/athlete-session-adjustment-service.test.ts`
- `tests/coach-planner-service.test.ts`
- `tests/source-copy-assignment.test.ts`

## Verification

- `node --experimental-strip-types --test tests/athlete-session-adjustment-service.test.ts tests/coach-planner-service.test.ts tests/source-copy-assignment.test.ts` — 18 passing tests.
- `pnpm test` — 140 passing tests.
- `pnpm db:push --force-reset && pnpm db:seed` — pass.
- `pnpm exec prisma validate` — pass.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing middleware deprecation warning remains.
- Browser narrow/wide viewport, loading, empty, error, keyboard/focus, contrast,
  and responsive inspection — not run; no browser inspection tool is available
  in this environment.

## Follow-up

- `SESSION-ACTUAL-001` can now add direct completed-outcome editing without
  changing the planned ownership contract.
- Manual UI verification should be completed before relying on the new athlete
  editor in production.
