# Universal Workout And Template Sharing

- **Date:** `2026-09-01`
- **Feature ID:** `SHARE-001`
- **Status:** `in-progress`
- **Agent:** `OpenCode`

## Behavior

- Added `ShareLink` with named Session/Template/creator relations, hashed
  opaque bearer tokens, source indexes, and source-deletion cascades.
- Added a share-time sanitized projection and canonical import contract. The
  projection excludes identity, schedules, statuses, ownership, Activity,
  actual/baseline JSON, private notes, RPE, assignments, and relationship data.
- Added creator access checks for Template owners, athlete Sessions, roster
  coaches, and standalone coach-library Sessions. Training-plan child Sessions
  remain deferred.
- Added public `/share/[token]` preview outside the authenticated shell with
  noindex/no-referrer metadata and only Use in Planner or Save as Template.
- Added safe login, signup, and setup continuation for local share token/action
  paths.
- Added explicit athlete Planner, coach standalone-library, and either-role
  Template intake through existing persistence services. No Assignment or
  automatic scheduling is created, and copies retain no source relation.
- Added Share controls with link creation, loading, API failure, clipboard
  fallback, and copy states to supported Template and Session surfaces.

## Files

- `prisma/schema.prisma`
- `lib/share-link.ts`
- `lib/share-link-service.ts`
- `lib/session-editor-adapters.ts`
- `lib/template-service.ts`
- `lib/coach-session-library-service.ts`
- `app/share/[token]/page.tsx`
- `app/share/[token]/ShareLandingClient.tsx`
- `app/api/share-links/route.ts`
- `app/api/share-links/intake/route.ts`
- `components/ShareLinkButton.tsx`
- Auth continuation and supported Session/Template surfaces
- `tests/share-link-service.test.ts`
- `tests/share-link-routes.test.mjs`

## Verification

- `pnpm db:push --force-reset && pnpm db:seed` — pass; disposable SQLite
  database reset and seed completed without warnings.
- `pnpm test` — pass; 167 tests.
- Focused share service/route tests — pass; 16 tests.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing Next.js middleware deprecation warning remains.
- `git diff --check` — pass during implementation slices.
- Manual browser verification — not run; no browser-capable tool is available.

## Follow-Up

Run the required browser acceptance matrix on mobile and desktop: anonymous
Template and Session previews, invalid/deleted links, login/signup/setup
continuation, athlete and coach Planner/Template saves, explicit-save versus
no-auto-scheduling, source edits versus snapshots/copies, clipboard failure,
loading/error states, and responsive layout. Mark SHARE-001 shipped only after
recording that evidence.
