# Feature: Universal Workout And Template Sharing

- **ID:** `SHARE-001`
- **Status:** `in-progress`
- **Last verified:** `2026-09-01` (automated implementation verification)
- **Owner:** `lib/share-link.ts`, `lib/share-link-service.ts`, shared session-editor adapters, and role-specific planner/template intake
- **Related work:** [implementation task](../tasks/2026-09-01-universal-workout-sharing.md), [sharing decision](../decisions/0012-universal-workout-sharing.md), [sharing history](../history/2026-09-01-universal-workout-sharing.md), [planner](planner.md), [templates](templates.md), [athlete](athlete.md)

## Contract

Any authenticated user who can access a workout `Session` or reusable
`Template` can create a bearer link. Anyone with the link can view a sanitized
read-only preview. A signed-in recipient can either open the source in the
appropriate Planner as an unsaved draft or save it as a private Template copy.
Neither action schedules or persists anything until the recipient explicitly
saves.

Copies are independent from the source and can be edited by their new owner.
Initial sharing has no recipient allowlist, approval, expiry, usage limit, or
role restriction beyond the source access check and the requirement to sign in
before saving.

## Live Path

- **Routes/UI:** `/share/[token]`, `POST /api/share-links`, `POST /api/share-links/intake`, share controls on Session and Template surfaces, and role-specific Planner/Template intake.
- **Services:** `shareLinkService`; existing `templateService`, `athletePlannerService`, `coachSessionLibraryService`, and canonical session-editor adapters remain the persistence boundaries.
- **Data:** `ShareLink` stores one hashed-token source relation and a sanitized share-time snapshot. Source deletion cascades to invalidate links; recipient copies use existing private `Session`, `Template`, `Block`, and `Plan` persistence without source lineage.
- **Shared helpers/components:** `SessionComposer`, `session-editor.ts`, `session-editor-adapters.ts`, `share-link.ts`, `api-auth.ts`, `route-params.ts`, `ShareLinkButton`, and shared UI primitives.

## Behavior Already Implemented

- `ShareLink` creation uses 32 random bytes encoded as a URL-safe bearer token;
  only its SHA-256 hash is stored.
- Source access covers Template owners, Session owners, roster coaches, and
  standalone coach-library owners. Training-plan child Sessions are deferred.
- Public previews read only the stored sanitized snapshot and are generic for
  invalid, deleted, malformed, and inaccessible records.
- Completed Session links use the planned coach baseline when present and never
  expose Activity or actual outcome data. Planned Sessions use current planned
  fields; legacy completed sessions without a baseline fall back to current
  planned fields.
- Anonymous visitors can choose only Use in Planner or Save as Template;
  signed-in recipients edit an unsaved canonical draft before explicit save.
- Athlete planner saves create private athlete Sessions/Plans; coach planner
  saves create private standalone library Sessions; either role can save a
  private Template copy. No Assignment or automatic scheduling is created.
- Saved copies clear source IDs and use independent Blocks. Later source edits
  cannot update the snapshot or recipient copy.

## Verification

- `pnpm db:push --force-reset && pnpm db:seed` — pass on 2026-09-01.
- Focused share-link/service/route tests — 17 passing tests.
- `pnpm test` — 167 passing tests on 2026-09-01.
- `pnpm lint` — pass on 2026-09-01.
- `pnpm build` — pass on 2026-09-01; existing middleware deprecation warning
  remains.
- Required browser verification has not been run because this environment has
  no browser-capable tool. The feature remains `in-progress` until anonymous
  preview, authentication continuation, role-specific save, no-auto-scheduling,
  source-independence, and narrow/wide layout checks are recorded.

## Known Gaps

- Existing Template persistence does not represent every canonical Session field;
  skipped state is now preserved, while RPE and separate coach/athlete notes
  remain outside Template storage.
- Share controls currently create a new bearer link for each request; revocation,
  expiry, rate limiting, and abuse reporting remain intentionally deferred.
- Bearer-link leakage, abuse/rate limiting, link revocation, expiry, and public
  discovery are intentionally deferred from the first release.
- Whole TrainingPlan sharing and sharing actual workout outcomes are deferred.

## Extension Rules

- Start source access, token handling, public projection, and copy-intake
  orchestration in `shareLinkService`; keep API routes thin.
- Preserve the distinction between a reusable Template, a scheduled Session,
  and a saved private copy.
- Preserve sanitized projections: never expose Activity, actual snapshots,
  baseline JSON, private notes, RPE, assignment records, or account identity.
- Preserve no-auto-scheduling: link actions open drafts and require explicit
  recipient save commands.
- Avoid adding recipient-specific sharing tables or role-specific sharing rules
  until the unrestricted bearer-link flow is proven.
- Keep browser acceptance evidence visible; do not change this record to
  `shipped` without the required manual checks.

## History

| Date | Change | Evidence |
|---|---|---|
| `2026-09-01` | Initial feature record and implementation plan | [universal sharing plan](../tasks/2026-09-01-universal-workout-sharing.md) |
| `2026-09-01` | Implemented automated sharing path; browser acceptance remains | [sharing history](../history/2026-09-01-universal-workout-sharing.md) |
