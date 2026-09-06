# Universal Workout Sharing Plan

- **Date:** `2026-09-01`
- **Agent:** `OpenCode`
- **Feature ID:** `SHARE-001`
- **Task:** [universal workout and template sharing](../tasks/2026-09-01-universal-workout-sharing.md)
- **Decision:** [universal bearer links](../decisions/0012-universal-workout-sharing.md)

## Planning Outcome

Defined the complete implementation plan for universal Session and Template
share links. Any authenticated user with access can create an opaque bearer
link. Anyone with the link can view a sanitized snapshot. Signed-in recipients
choose between an unsaved Planner draft and an unsaved private Template copy;
neither action schedules or persists anything until explicit save.

## Planned Slices

- Contract and workspace records.
- Sanitized projection and canonical import draft.
- ShareLink schema, token hashing, and source access commands.
- Link creation API and public preview route.
- Authentication continuation through login, signup, and setup.
- Save-as-Template and Use-in-Planner intake for both roles.
- Share controls on existing Session and Template surfaces.
- Privacy, copy-independence, route-boundary, and full repository hardening.

## Verification

- Planning review only on `2026-09-01`.
- No application code, schema, or runtime behavior was changed.
- Implementation verification is not run.

## Follow-up

- Implement the plan in dependency order beginning with the projection contract
  and ShareLink schema.
- Revisit revocation, expiry, rate limiting, whole-plan sharing, and actual-result
  sharing after the first private-link workflow is proven.
