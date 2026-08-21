# Feature: Authentication And Access

- **ID:** `AUTH-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-21`
- **Owner:** `auth.ts`, `middleware.ts`, `lib/auth-principal.ts`, `lib/auth-role-service.ts`, `lib/auth-session.ts`, `lib/api-auth.ts`
- **Related work:** [current status](../CURRENT-STATUS.md), [history](../history/2026-08-21-baseline.md), [auth task](../tasks/2026-08-21-auth-role-setup.md), [API task](../tasks/2026-08-21-api-auth-validation.md)

## Contract

Users sign in with credentials or optional Google OAuth, choose a role during
setup when needed, and are routed to the coach or athlete application. Server
pages and API handlers must enforce the same role boundary.

## Live Path

- **Routes/UI:** `/`, `/login`, `/signup`, `/setup`, `/api/auth/*`.
- **Services:** `getCurrentUser()` for server-rendered pages; `requireCoach`,
  `requireAthlete`, and `requireSignedInUser` for APIs.
- **Data:** `User`, Auth.js `Account`, JWT session strategy.
- **Shared helpers/components:** `SessionProviderWrapper`, app shell, role-aware navigation.

## Behavior Already Implemented

- Credentials login verifies a bcrypt password hash.
- Google sign-in is available when OAuth environment variables are configured.
- JWTs carry numeric user ID and role; session shaping exposes them to the app.
- Middleware protects coach/athlete paths, redirects by role, and sends users
  without a role to setup.
- Signup validates required fields, role, and an eight-character minimum password.
- Auth.js first-login users may be created with nullable `name`, `image`, and
  `emailVerified` fields and a null application role.
- Role setup is a one-time conditional transition; roleful users are redirected
  home and competing setup writes return `409`.
- Session and API principal access rejects invalid numeric IDs and unknown roles.
- Google email account linking is not enabled through
  `allowDangerousEmailAccountLinking`.

## Verification

- `pnpm test` — 88 passing tests on 2026-08-21, including focused role setup and
  principal tests.
- `pnpm lint` — pass on 2026-08-21.
- `pnpm build` — pass on 2026-08-21.
- `pnpm exec prisma validate` — pass on 2026-08-21.
- `pnpm db:push` and `pnpm db:seed` — pass on the disposable local SQLite
  database on 2026-08-21.
- Auth.js Prisma adapter smoke test — pass for first-time roleless user creation
  on 2026-08-21.

## Known Gaps

- Auth callback and API guard behavior lacks a focused service-level test suite.
- Signup, setup, and session completion still contain direct Prisma behavior.
- Auth callback and OAuth provider flow still need a full external-provider
  integration test when OAuth credentials are configured.
- Next.js reports the `middleware.ts` convention is deprecated in favor of `proxy.ts`.

## Extension Rules

- Start in `auth.ts`, `lib/auth-session.ts`, or `lib/api-auth.ts` according to
  whether the change is session shaping, server-page lookup, or API authorization.
- Keep role assignment policy in `lib/auth-role-service.ts` and malformed
  principal handling in the framework-free `lib/auth-principal.ts` module.
- Preserve role checks in both middleware and route handlers.
- Never put credentials, secrets, or OAuth values into workspace records.
