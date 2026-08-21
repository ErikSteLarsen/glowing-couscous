# Task: Make Auth.js And Role Setup Coherent

- **Status:** `completed`
- **Agent:** `opencode-auth-2026-08-21`
- **Started:** `2026-08-21`
- **Updated:** `2026-08-21`
- **Feature IDs:** `AUTH-002`, `AUTH-001`, `COVERAGE-001`
- **Related records:** [planned task](2026-08-21-auth-role-setup.md), [auth feature](../features/auth.md), [current status](../CURRENT-STATUS.md), [decision](../decisions/0003-auth-role-and-account-linking.md)

## Goal

Make the Auth.js Prisma contract compatible with roleless first-login users and
make role setup a one-time, conditional transition.

## Starting Context

- Current behavior: `User.role` is required by the schema while setup and OAuth
  paths assume a roleless first-login state; setup can also change an existing role.
- Existing owner/service: `auth.ts`, `middleware.ts`, `lib/auth-session.ts`,
  `lib/api-auth.ts`, and the auth setup route.
- Related active or transitional work: None recorded.

## Plan

- [x] Inspect the installed Prisma adapter contract and current auth/data paths.
- [x] Add focused tests for roleless users, one-time setup, principal parsing, and account linking.
- [x] Implement schema/auth/setup changes without breaking seeded roleful accounts.
- [x] Run targeted and repository verification gates.
- [x] Update workspace records and commit the completed task.

## Progress Log

### 2026-08-21

- What changed: Claimed `AUTH-002` as the active task.
- Decision or discovery: The task brief recommends permanent one-time role assignment; this will be recorded as a security/product decision before implementation.
- Files touched: This task progress record and `WORK-INDEX.md`.
- Verification: Repository was clean before claiming the task.
- Blocker or next step: Inspect auth source, Prisma schema, installed adapter, and tests.

### 2026-08-21

- What changed: Added nullable Auth.js user fields, a framework-free principal parser,
  atomic role setup service, one-time setup redirects, and hardened API guards.
  Normalized nullable persisted names at service boundaries.
- Decision or discovery: Installed `@auth/prisma-adapter@2.11.2` passes
  `name`, `emailVerified`, and `image` directly to Prisma `User.create`; the
  schema now accepts those fields and a null role. Dangerous email account
  linking was removed under [decision 0003](../decisions/0003-auth-role-and-account-linking.md).
- Files touched: `auth.ts`, `middleware.ts`, `prisma/schema.prisma`,
  `lib/auth-principal.ts`, `lib/auth-role-service.ts`, `lib/auth-session.ts`,
  `lib/api-auth.ts`, `app/api/auth/setup/route.ts`, service name-normalization
  modules, and focused tests.
- Verification: `pnpm exec prisma validate` passed; focused auth and shell tests
  passed; `pnpm build` passed with the existing middleware deprecation warning.
- Blocker or next step: None for `AUTH-002`; external-provider OAuth integration
  coverage remains a follow-up gap.

## Verification

- `pnpm exec prisma validate` — pass on 2026-08-21.
- `pnpm db:push` — pass; disposable local SQLite schema reset on 2026-08-21.
- `pnpm db:seed` — pass on 2026-08-21.
- `pnpm test` — pass, 88 tests, on 2026-08-21.
- `pnpm lint` — pass on 2026-08-21.
- `pnpm build` — pass on 2026-08-21; existing middleware deprecation warning.
- Auth.js Prisma adapter smoke test — pass on 2026-08-21.
- `git diff --check` — pass on 2026-08-21.

### 2026-08-21

- What changed: Completed schema reset/seed verification and direct adapter smoke
  testing. Updated auth feature, current status, architecture, and handoff records.
- Decision or discovery: Existing roleful seeded users retain their roles after
  `db:push` and `db:seed`; the adapter successfully creates and removes a
  roleless user with nullable Auth.js fields.
- Files touched: Workspace records and implementation files listed above.
- Verification: All task verification commands passed; the build warning is the
  existing Next.js middleware deprecation.
- Blocker or next step: None for this task.

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [2026-08-21 auth role setup](../history/2026-08-21-auth-role-setup.md)
- **Feature records updated:** [auth](../features/auth.md), [current status](../CURRENT-STATUS.md), [architecture](../../../ARCHITECTURE.md), [handoff](../../AI-HANDOFF.md)
- **Remaining work:** Add a full external-provider OAuth integration test when provider credentials are available.
