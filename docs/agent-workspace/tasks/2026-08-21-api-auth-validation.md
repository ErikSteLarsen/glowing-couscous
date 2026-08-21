# Task: Centralize API Authorization And Input Validation

- **Status:** `completed`
- **Agent:** `opencode-api-2026-08-21`
- **Created:** `2026-08-21`
- **Task ID:** `API-001`
- **Feature IDs:** `AUTH-001`, `COVERAGE-001`, `COMPAT-001`
- **Related records:** [auth](../features/auth.md), [compatibility](../features/compatibility.md), [coverage](../features/coverage.md), [audit](2026-08-21-incompleteness-audit.md)
- **Dependencies:** Auth role/principal policy from the auth task. Preserve intentional public Auth.js/signup/setup routes.
- **Completed:** 2026-08-21
- **Completion record:** [progress and verification](2026-08-21-api-auth-validation-progress.md)
- **Decision:** [JWT principal guards and domain ownership reads](../decisions/0004-api-principal-validation.md)

## Problem

Middleware bypasses all `/api/*` paths, so every non-public route must remember
its own guard. Guards rely on TypeScript casts and dynamic routes frequently use
`Number()` directly. JSON body validation is inconsistent, causing malformed
input to reach Prisma or return 500 instead of 400. There are no focused tests
for 401/403/400 outcomes across route families.

Relevant files:

- `lib/api-auth.ts`
- `lib/auth-session.ts`
- all dynamic handlers under `app/api/coach/` and `app/api/athlete/`
- `app/api/auth/signup/route.ts`
- `app/api/auth/setup/route.ts`
- `tests/`

## Design

Create small, reusable parsing seams:

```text
lib/route-params.ts
lib/api-auth.ts
```

`route-params.ts` should expose a positive-integer parser that returns a typed
value or a route-level error result. `api-auth.ts` should parse the session
principal at runtime, validate positive numeric IDs and app roles, and retain
the current 401/403 response contract. Decide explicitly whether sensitive
operations re-read the current database user or continue with JWT-only access.

Routes remain adapters: authenticate, parse, call the owning module, serialize.
Do not put domain behavior into the validation helper.

## Implementation Steps

1. Inventory all API routes and classify public versus protected handlers.
2. Add failing guard/parser tests for no session, wrong role, malformed ID,
   Infinity/fractional/zero IDs, valid principals, and public exceptions.
3. Implement runtime principal and positive-ID parsing helpers.
4. Replace direct parsing in planner, request, template, assignment, session,
   and athlete routes.
5. Add route behavior tests or focused adapter tests for each route family.
6. Update architecture/coverage records and history.

## Acceptance Criteria

- Every protected API route has an explicit guard.
- Unauthenticated requests return 401; wrong roles return 403.
- Malformed/non-positive IDs return 400 before Prisma.
- Ownership failures retain the current 404 resource-disclosure policy.
- Malformed JSON and invalid command fields return 400 where the route owns parsing.
- Principal validation does not rely only on a TypeScript cast.
- Public Auth.js, signup, and setup routes remain reachable under their intended policy.
- Adding a new protected route has a clear guard/test pattern.

## Verification

```bash
pnpm test -- --test-name-pattern="api|authorization|guard|route|params"
pnpm lint
pnpm build
```
