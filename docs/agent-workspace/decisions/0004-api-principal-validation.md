# Decision 0004: JWT Principal Guards And Domain Ownership Reads

- **Date:** 2026-08-21
- **Status:** Accepted
- **Scope:** Protected API authorization and route validation

## Decision

Protected API guards validate the signed JWT principal at runtime and use its
numeric user ID and app role for the initial 401/403 decision. They do not query
`User` on every request. Sensitive resource mutations continue to re-read the
target resource and ownership relationship inside their owning service or
compatibility adapter before changing data.

All dynamic route IDs use the strict positive-integer parser. Mutation routes
reject malformed or non-object JSON bodies with `400` before calling domain
services.

## Rationale

Roles are assigned once under the auth policy, so a valid signed role claim is
stable for the current session. Re-reading the principal for every route would
add database work without replacing the ownership checks already required at
the domain boundary. Resource ownership remains database-backed, preserving the
existing `404` disclosure policy for resources outside the caller's scope.

## Consequences

- New protected routes must call `requireCoach`, `requireAthlete`, or
  `requireSignedInUser` and use `parsePositiveInteger` for dynamic IDs.
- A revoked or changed account role takes effect when the JWT expires or is
  refreshed; an explicit revocation mechanism is out of scope for this task.
- Route adapters own transport parsing while services continue to own business
  validation and ownership checks.
