# Task: Make Auth.js And Role Setup Coherent

- **Status:** `completed`
- **Agent:** `opencode-auth-2026-08-21`
- **Created:** `2026-08-21`
- **Task ID:** `AUTH-002`
- **Feature IDs:** `AUTH-001`, `COVERAGE-001`
- **Related records:** [auth](../features/auth.md), [current status](../CURRENT-STATUS.md), [audit](2026-08-21-incompleteness-audit.md)
- **Dependencies:** Decide whether role assignment is permanently one-time. This task recommends it is.
- **Completed:** 2026-08-21
- **Completion record:** [progress and verification](2026-08-21-auth-role-setup-progress.md)
- **Decision:** [one-time roles and explicit OAuth linking](../decisions/0003-auth-role-and-account-linking.md)

## Problem

The Auth.js Prisma adapter creates OAuth users from standard Auth.js fields,
but the application `User` model requires a role and lacks adapter-compatible
optional fields such as `image` and `emailVerified`. The application types and
setup route already assume a roleless first-login state. Separately, a roleful
user can call `/api/auth/setup` and change from coach to athlete or vice versa.

Relevant files:

- `prisma/schema.prisma`
- `auth.ts`
- `types/next-auth.d.ts`
- `middleware.ts`
- `app/api/auth/setup/route.ts`
- `app/(auth)/setup/page.tsx`
- `lib/auth-session.ts`
- `lib/api-auth.ts`
- `tests/`

## Design

Make the Prisma `User` contract compatible with the installed Auth.js Prisma
adapter while preserving numeric application IDs. The implementation must
inspect the installed adapter contract and choose the smallest safe solution:
schema compatibility fields or a custom adapter wrapper if required. Model
roleless users explicitly (`role String?`) and preserve application-level
`name ?? ''` behavior where needed.

Role setup is a one-time transition:

- only a roleless user can access `/setup`;
- a roleful user visiting `/setup` is redirected to the correct home;
- setup mutation conditionally assigns a role only when the current role is null;
- repeat or competing setup attempts return `409` without changing the role.

Retain or remove `allowDangerousEmailAccountLinking` only after recording a
dated security decision. If retained, document the trusted-provider assumption
and provide an OAuth smoke/integration test plan.

## Implementation Steps

1. Inspect the installed adapter and existing migration/data shape.
2. Add failing tests for roleless OAuth creation contract, setup redirects,
   repeat setup, and concurrent/conditional role assignment.
3. Update schema and generated types without losing seeded roleful users.
4. Harden auth session/principal parsing enough to reject invalid IDs/roles.
5. Update middleware and setup route/page for one-time setup.
6. Add or update OAuth account-linking decision documentation.
7. Run local DB reset/seed only if schema changes require it.
8. Update auth feature, current status, architecture, decision, and history records.

## Acceptance Criteria

- A first-time OAuth user can be created with no role and reaches `/setup`.
- Adapter-required user fields exist with correct nullability.
- Existing roleful accounts retain roles.
- Roleful users cannot change roles through `/setup` or its API.
- Competing setup requests cannot produce an invalid or ambiguous role state.
- Session/API guards reject malformed principals rather than relying only on casts.
- Account-linking behavior is explicit and tested/documented.
- Existing credentials login, signup, and role routing remain functional.

## Verification

```bash
pnpm exec prisma validate
pnpm test -- --test-name-pattern="auth|setup|role|guard"
pnpm lint
pnpm build
```

If schema changes are made locally:

```bash
pnpm db:push
pnpm db:seed
pnpm test
pnpm lint
pnpm build
```
