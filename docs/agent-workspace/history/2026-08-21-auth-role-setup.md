# Auth.js Role Setup Hardening

- **Date:** 2026-08-21
- **Task:** `AUTH-002`
- **Status:** Shipped
- **Agent:** `opencode-auth-2026-08-21`

## Changed

- Made Prisma `User` compatible with the installed Auth.js Prisma adapter by
  allowing nullable `name`, `role`, `emailVerified`, and `image`.
- Added `lib/auth-principal.ts` for strict application ID and role-claim parsing.
- Added `lib/auth-role-service.ts` with conditional `role IS NULL` assignment so
  only the first setup request wins.
- Updated middleware and setup API behavior for one-time role setup, invalid JSON,
  malformed principals, repeat setup, and competing setup requests.
- Removed `allowDangerousEmailAccountLinking` from Google configuration.
- Normalized nullable persisted names at account, athlete, coach, request,
  planner, and assignment service boundaries.
- Updated architecture, handoff, feature, status, and task records.

## Verification

- `pnpm exec prisma validate` — pass.
- `pnpm db:push` — pass; disposable local SQLite schema reset.
- `pnpm db:seed` — pass; roleful demo accounts restored.
- `pnpm test` — pass, 88 tests.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing Next.js middleware deprecation warning remains.
- Auth.js Prisma adapter smoke test — pass; a roleless OAuth-shaped user was
  created and removed.
- `git diff --check` — pass.

## Follow-Up

- Add external-provider OAuth integration coverage when OAuth credentials and a
  suitable test environment are available.
- `AUTH-001` still has direct Prisma behavior in signup and setup-adjacent auth
  routes that can be centralized in a later coverage task.
