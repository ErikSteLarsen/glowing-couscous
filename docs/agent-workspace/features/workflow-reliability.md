# Feature: Trustworthy Workflow Saves And Recovery

- **ID:** `RELIABILITY-001`
- **Status:** `planned`
- **Last verified:** `2026-09-01` (planning baseline)
- **Owner:** Existing planner, template, session-lifecycle, auth, and share-link services; shared mutation and draft-recovery helpers to be added only where they deepen those boundaries
- **Related work:** [implementation plan](../tasks/2026-09-01-workflow-reliability.md), [coverage](coverage.md), [planner](planner.md), [session adjustments](session-adjustments.md), [templates](templates.md), [share links](share-links.md), [architecture](../../../ARCHITECTURE.md)

## Contract

Users should be able to trust that a workout save either completes once or
does not complete, that retrying a failed request does not duplicate data, and
that an unsaved draft is recoverable after a transient failure or authentication
redirect.

Planner, Template, Session adjustment, completion, and share-link flows should
make saving state explicit, preserve user input on failure, detect stale edits,
and keep related database records consistent. This is a product reliability
capability, not merely a test-coverage effort.

## Live Path

- **Routes/UI:** `/coach/planner`, `/athlete/planner`, `/coach/templates`, `/athlete/templates`, athlete Session detail, completion/actual routes, `/share/[token]`, and their mutation APIs.
- **Services:** `coach-planner-service`, `athlete-planner-service`, `coach-session-library-service`, `coach-training-plan-service`, `template-service`, `assignment-service`, `athlete-session-adjustment-service`, `athlete-completion-service`, `session-snapshot-service`, `share-link-service`.
- **Data:** `Session`, `Block`, `Plan`, `Assignment`, `TrainingPlanAssignment`, `Template`, `Activity`, `ShareLink`, and a planned command-receipt/idempotency record.
- **Shared helpers/components:** `SessionComposer`, session-editor adapters, `route-params`, `api-auth`, a small client mutation state helper, and a versioned draft-recovery helper.

## Behavior Already Implemented

- Session block replacement and several source-copy operations already use
  transactions or unique keys.
- Assignment creation has unique lineage and duplicate-prevention rules.
- Completed sessions are protected from planner mutations.
- Canonical baseline and actual snapshots preserve source/outcome independence.
- Client surfaces already show some loading, success, and error states.

## Planned Behavior

- Every create/update command has a stable request identity for safe retries,
  except share-link creation, which must not store or replay a raw bearer token.
- Retrying a mutation after a lost response returns the original logical result
  instead of creating another Session, Plan, Template, or Assignment.
- Multi-record writes such as athlete multi-date creation and coach session plus
  Assignment changes commit atomically.
- Failed saves leave the editor draft intact and provide a retry path.
- Refreshing or returning from authentication offers recovery of a recent
  unsaved draft without silently restoring stale or unrelated data.
- Updates detect a stale `updatedAt` version and offer reload or keep-draft
  behavior instead of silently overwriting another edit.
- Authentication loss during a save preserves the draft and returns the user to
  the same editor after sign-in.
- Session completion, reopening, planned adjustment, and actual correction keep
  notes, snapshots, status, and derived metrics consistent.
- Share links can eventually be revoked or expired without storing raw tokens;
  existing v1 links remain valid unless explicitly revoked or expired.

## Known Gaps

- New athlete multi-date creation can perform several writes without one
  cross-date atomic command boundary.
- Some Plan lookup/create paths lack a database uniqueness constraint for one
  athlete/week and can be vulnerable to concurrent duplicate Plans.
- Several mutation APIs do not carry a client request key or expected version.
- Client fetch paths do not share one consistent network-error, retry, or
  authentication-expiry behavior.
- SessionComposer drafts are local component state and can be lost on refresh or
  authentication redirects.
- Source and outcome writes have uneven transaction boundaries across services.
- ShareLink v1 intentionally has no revoke/expiry controls.

## Extension Rules

- Start domain behavior in the existing owning service; do not create a generic
  planner replacement or move Prisma calls into pages/routes.
- Use a small command-receipt boundary for idempotency. Do not store raw share
  tokens in a receipt, log, browser persistence, or new database field.
- Preserve existing Assignment uniqueness and source-copy lineage. Never use
  `assignment-service` to receive a shared link.
- Keep `Session.updatedAt` and `Template.updatedAt` as the optimistic-concurrency
  version source unless a concrete migration requires a new version column.
- Keep draft recovery bounded, versioned, user-scoped, and explicitly
  clearable. Do not persist credentials or bearer tokens in draft storage.
- Preserve the distinction between planned, completed, actual, reusable, and
  shared-snapshot data.
- Prefer explicit user recovery choices over silent overwrite or silent discard.
