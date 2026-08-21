# Decision 0003: One-Time Roles And Explicit OAuth Linking

- **Date:** 2026-08-21
- **Status:** Accepted
- **Scope:** Auth.js first-login role setup and Google account linking

## Decision

Application roles are assigned exactly once. A roleless Auth.js user may choose
`COACH` or `ATHLETE` during setup, but an existing role cannot be changed by the
setup route. The assignment is conditional on `role IS NULL` so competing setup
requests cannot overwrite one another.

The Google provider does not use
`allowDangerousEmailAccountLinking`. Accounts are linked only through Auth.js's
normal provider-account flow; matching an existing credentials email is not
treated as sufficient proof of control by an independently configured provider.

## Rationale

Role changes affect authorization boundaries and existing coach-athlete data, so
they require an explicit future account-management workflow rather than a
reusable onboarding endpoint. Removing dangerous email linking avoids silently
merging identities without a verified linking step. First-time OAuth users still
work because the Prisma user contract permits a null role until setup.

## Consequences

- `/setup` is only available to roleless users and redirects roleful users home.
- Repeat or concurrent setup mutations return `409` and preserve the first role.
- Users with an existing credentials account must sign in through that account or
  use a future explicit linking flow before adding Google.
- OAuth smoke testing must cover first-time roleless creation and normal provider
  account linking when OAuth credentials are configured.
