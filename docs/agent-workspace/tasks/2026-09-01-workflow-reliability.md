# Task: Trustworthy workflow saves and recovery

- **Status:** `planned`
- **Agent:** Unclaimed
- **Started:** `2026-09-01`
- **Updated:** `2026-09-01`
- **Feature IDs:** `RELIABILITY-001`
- **Related records:** [workflow reliability](../features/workflow-reliability.md), [coverage](../features/coverage.md), [planner](../features/planner.md), [session adjustments](../features/session-adjustments.md), [templates](../features/templates.md), [share links](../features/share-links.md), [architecture](../../../ARCHITECTURE.md)

## Goal

Make existing workout workflows trustworthy under double-clicks, retries,
network failures, refreshes, authentication redirects, concurrent edits, and
multi-record persistence. A user should never lose a carefully edited workout,
create a duplicate by retrying, or unknowingly overwrite a newer edit.

This plan intentionally prioritizes product behavior and data integrity over
adding a new user-facing feature. Automated tests and manual verification are
supporting evidence, not the product goal.

## Starting Context

- `SessionComposer` and the canonical session editor are shared by coach planner,
  athlete Planner, Template editing, planned adjustment, and actual correction.
- `coach-planner-service`, `athlete-planner-service`,
  `coach-session-library-service`, `coach-training-plan-service`, and
  `template-service` are the persistence owners for their respective commands.
- `assignment-service` owns reusable source copies and existing duplicate
  prevention; do not route ordinary shared-link receipt through it.
- `athlete-completion-service` owns completion/reopen/actual outcome writes.
- `session-snapshot-service` owns canonical baseline/actual payloads.
- `share-link-service` owns share snapshots and explicit recipient copy
  orchestration. Raw share tokens may never be stored outside the URL response.
- Existing UI state is mostly component-local. Several mutation paths handle
  API errors but do not consistently handle network exceptions, retries, or
  authentication expiration.
- Existing `updatedAt` fields can support optimistic concurrency without adding
  a second version column.

## Product Reliability Contract

1. **At-most-once logical save:** Repeating one user action with the same
   request identity returns one logical result.
2. **No partial command:** A command that spans Session, Block, Plan, Assignment,
   Activity, or snapshot writes either commits all required records or commits
   none.
3. **Draft preservation:** A failed request never resets or discards the draft.
4. **Explicit recovery:** The UI tells the user whether work is unsaved, saving,
   saved, failed, conflicted, or awaiting authentication.
5. **Conflict visibility:** A stale edit never silently overwrites a newer save.
6. **Ownership preservation:** Recovery and retry cannot change the owner, role,
   athlete, source relation, or assignment boundary.
7. **Privacy preservation:** Draft recovery and command receipts never persist
   credentials, bearer tokens, Activity outcomes in public paths, or data from
   another user.
8. **Share-link exception:** Share-link creation must not use a generic response
   receipt if doing so would require storing a raw token. Multiple links remain
   acceptable until a token-safe recovery design exists.

## Architecture Decisions For Implementation

### Command receipt

Add a small `CommandReceipt` model and service for domain mutations that can be
safely replayed:

```text
CommandReceipt
- id
- userId
- operation       # server-defined operation name
- requestKey      # client-generated opaque key
- payloadHash     # canonical request payload excluding requestKey
- responseJson    # sanitized command result, never a share token
- createdAt
```

Add a unique key on `[userId, operation, requestKey]`. The service must expose:

- `beginOrReplay(userId, operation, requestKey, payload)`
- `complete(receiptId, response)`
- `rejectConflictingReplay(...)` when the same key is reused with a different
  payload hash.

The receipt and the domain write must commit in the same transaction. Failed
commands must not leave a completed receipt that blocks a retry. Receipts may
be retained indefinitely for the first implementation or receive a documented
cleanup policy later; do not delete them while a client may still retry.

Do not apply this generic receipt to `POST /api/share-links` unless the design
can return the original raw token without storing it. The recommended v1
reliability behavior is to allow multiple link creations and make link
management/revocation explicit in a later slice.

### Request identity

- Create commands receive `requestKey` from the client, generated once when a
  draft save begins and retained for retries.
- Update commands also accept a request key so a lost response can be replayed.
- The server chooses the operation name; clients cannot select the receipt
  namespace.
- Limit key size and character set in `route-params` or a focused mutation
  parser. Reject missing/invalid keys with `400` on commands that require them.
- Never use a predictable numeric database ID as a request key.

### Plan uniqueness

Add a unique database constraint for one athlete/week Plan, preferably
`[athleteId, startDate, endDate]`, after checking the existing seed/data shape.
Update `findOrCreatePlan` and equivalent coach/athlete paths to handle a unique
race by loading the existing Plan rather than surfacing a 500.

### Optimistic concurrency

- Include `updatedAt` in edit read models that can be edited later.
- Require `expectedUpdatedAt` for editing an existing Session or Template.
- Service code must check ownership and expected version in the same transaction
  as the update.
- Return a stable `409` conflict response with enough current metadata for the
  client to offer `Reload current` or `Keep my draft`; do not merge silently.
- Create commands do not need an expected version.

### Draft recovery

Add a versioned client-only draft recovery helper, preferably backed by
`sessionStorage` for the current tab:

```text
draft key = reliability namespace + user id + route + record id + mode
payload  = { version, savedAt, draft }
```

Rules:

- Store only the canonical editable draft, never credentials or raw share
  tokens.
- Debounce writes and cap payload size.
- Expire stale drafts after a documented short window.
- On load, show an explicit restore/discard choice when a recovery draft exists.
- Clear the recovery draft only after the server confirms success or the user
  explicitly discards it.
- Keep a failed draft available after a `401`, `409`, network failure, or 5xx.

## Implementation Slices

### Slice 0: Register the reliability capability

- **Depends on:** None.
- **Files:** This task, `features/workflow-reliability.md`, `WORK-INDEX.md`,
  optional decision record.
- **Done when:** The contract, boundaries, receipt exception for raw share
  tokens, draft privacy rules, and dependency graph are recorded. The feature
  remains `planned` until code work begins.

### Slice 1: Command identity and response semantics

- **Depends on:** Slice 0.
- **Likely files:** `prisma/schema.prisma`, new
  `lib/command-receipt-service.ts`, `lib/route-params.ts`, focused API/service
  modules, relevant route adapters.
- **Implement:** Add `CommandReceipt`, canonical payload hashing, request-key
  parsing, replay/conflict results, and a small service API. Keep routes thin.
- **Done when:** A command can distinguish first execution, same-request retry,
  and same-key/different-payload conflict without storing sensitive values.

### Slice 2: Database uniqueness and atomic Plan creation

- **Depends on:** Slice 1.
- **Likely files:** `prisma/schema.prisma`, `lib/athlete-planner-service.ts`,
  `lib/coach-planner-service.ts`, `lib/planner-service.ts`, relevant plan
  services and tests.
- **Implement:** Add the athlete/week Plan unique key; make all find-or-create
  paths safe under a unique race; return the existing Plan after a conflict.
- **Done when:** One athlete/week cannot produce duplicate Plans, and concurrent
  callers converge on one Plan without a user-visible server error.

### Slice 3: Atomic athlete Planner commands

- **Depends on:** Slices 1-2.
- **Likely files:** `lib/athlete-planner-service.ts`, athlete Planner route and
  client, `lib/session-editor.ts`, adapters, Prisma transaction types.
- **Implement:** Make multi-date create one logical command. Create/reuse each
  required Plan and all Sessions in one transaction. Add request-key replay so
  a lost response cannot duplicate Sessions. Preserve the existing one-date
  edit and completed-session protections.
- **Done when:** A failed multi-date save leaves no partial dates; retry returns
  the original Session IDs; no Assignment is created for private athlete
  Planner saves.

### Slice 4: Atomic coach Planner, library, template, and assignment commands

- **Depends on:** Slices 1-3.
- **Likely files:** `lib/coach-planner-service.ts`,
  `lib/coach-session-library-service.ts`, `lib/coach-training-plan-service.ts`,
  `lib/template-service.ts`, `lib/assignment-service.ts`, their API routes and
  clients.
- **Implement:**
  - Make coach athlete-session save atomic across Session, Blocks, baseline,
    Plan movement, and Assignment update.
  - Make standalone library create/update request-key safe.
  - Make Template create/duplicate/update request-key safe and return the saved
    Template ID where clients need reconciliation.
  - Preserve existing Assignment unique keys and source lineage.
  - Ensure retries of source assignment converge on the existing copy rather
    than create another Session.
- **Done when:** Every affected save either commits its related records together
  or leaves them unchanged, and a lost response can be safely retried.

### Slice 5: Completion, planned adjustment, and actual correction recovery

- **Depends on:** Slices 1-4.
- **Likely files:** `lib/athlete-completion-service.ts`,
  `lib/athlete-session-adjustment-service.ts`,
  `lib/session-snapshot-service.ts`, completion/actual/adjustment routes and
  Session detail clients.
- **Implement:**
  - Use one atomic command for Activity, Session status, notes, metrics, and
    actual snapshot writes.
  - Preserve notes when reopening and preserve baseline/actual separation.
  - Make planned date movement update Plan and Assignment consistently.
  - Make actual correction retry-safe without changing completion status.
  - Return stable domain errors for immutable/completed/conflict states.
- **Done when:** Completion, reopen, planned adjustment, and actual correction
  cannot leave mismatched Session/Activity/snapshot state or lose notes.

### Slice 6: Standard save state, network recovery, and draft preservation

- **Depends on:** Slices 3-5; can begin UI scaffolding earlier.
- **Likely files:** New `lib/client-mutation.ts` or equivalent small helper,
  new draft-recovery helper, `SessionComposer` consumers, Planner clients,
  Template client, Session detail client, shared UI primitives.
- **Implement:**
  - Standardize `idle`, `dirty`, `saving`, `saved`, `failed`, `conflict`, and
    `auth-required` states.
  - Disable duplicate submits while retaining a stable request key for retry.
  - Catch network failures in every active mutation client.
  - Preserve the draft on all failures and expose a Retry action.
  - Store/recover recent drafts in bounded, user-scoped session storage.
  - Clear recovery only after confirmed success or explicit discard.
  - Do not reset a loaded draft merely because `router.refresh()` occurs.
- **Done when:** A user can intentionally retry a failed save, recover after a
  refresh or auth redirect, and see whether the server accepted the command.

### Slice 7: Optimistic concurrency and authentication expiry

- **Depends on:** Slice 6 and the relevant service updates from Slices 4-5.
- **Likely files:** Session/Template read models, `session-editor-adapters.ts`,
  planner/template/session clients, `api-auth.ts`, auth continuation helpers,
  route adapters.
- **Implement:**
  - Send `expectedUpdatedAt` on existing edits.
  - Return and render a clear 409 conflict state with Reload/Keep draft choices.
  - On 401 during save, persist the draft, send the user through a local
    allowlisted callback, and restore the same editor after sign-in.
  - Ensure role/ownership is revalidated after authentication; never replay a
    draft into a different owner or role boundary.
- **Done when:** Concurrent edits are visible and recoverable, and auth expiry
  does not lose the user's work or create a duplicate on return.

### Slice 8: Share-link lifecycle reliability

- **Depends on:** Slices 1 and 7; independent of Planner transaction work.
- **Likely files:** `prisma/schema.prisma`, `lib/share-link-service.ts`, share
  APIs/UI, `ShareLinkButton`, share route, feature/decision records.
- **Implement:** Add nullable `revokedAt` and `expiresAt` to `ShareLink`.
  Add creator-only revoke and optional expiry at creation/management time.
  Public lookup must reject revoked or expired links with the same generic
  unavailable state. Keep raw tokens out of receipts and management reads.
- **Recommended v2 policy:** Existing links have no expiry until the creator
  explicitly sets one; revocation is immediate; no allowlists, approvals,
  usage limits, or public discovery are introduced in this slice.
- **Done when:** A creator can revoke a link, optional expiry is enforced, and
  recipients never receive source details for inactive links.

### Slice 9: Product verification and documentation

- **Depends on:** Slices 1-8.
- **Likely files:** Feature records, architecture docs, history, all affected
  UI/service modules.
- **Implement:** Verify the user-visible failure/retry/recovery behavior across
  coach and athlete Planner, Templates, Session lifecycle, auth continuation,
  and sharing. Record known limitations such as live telemetry remaining
  intentionally local and browser-specific evidence.
- **Done when:** Reliability behavior is documented, current status is accurate,
  and `RELIABILITY-001` is marked shipped only if the product acceptance matrix
  is complete.

## Dependency Graph

```text
0 -> 1 -> 2 -> (3 || 4) -> 5 -> 6 -> 7 -> 8 -> 9
```

Slice 3 and Slice 4 may proceed in parallel after the command-receipt and Plan
uniqueness contracts are stable. Slice 8 can proceed after the shared auth and
service conventions are settled, but should not block core Planner save
reliability.

## User Acceptance Matrix

### Save and retry

- Double-clicking Save creates one logical result.
- A lost response can be retried without duplicate Sessions, Plans, Templates,
  or Assignments.
- Network failure leaves the full editor draft visible.
- Retry uses the same logical request and reports the final server result.
- A failed multi-date athlete save creates either all selected dates or none.

### Draft recovery

- Refreshing an editor with a recent unsaved draft offers Restore or Discard.
- A failed save does not clear the recovery draft.
- Successful save clears only the matching recovery draft.
- Drafts are scoped to the user, route, record, and editor mode.
- No password, session credential, or raw share token is persisted.

### Conflicts and auth

- A stale Session or Template edit returns a visible conflict instead of
  overwriting newer data.
- Reload current replaces the draft only after explicit user choice.
- Keep my draft preserves the user's edits for manual reconciliation.
- A 401 during save redirects through local auth continuation and restores the
  same draft after sign-in/setup.

### Session lifecycle

- Planned adjustment preserves source and baseline independence.
- Completion and actual correction preserve notes, status, metrics, and snapshots.
- Reopen does not erase retained notes unexpectedly.
- No partial Session/Block/Activity/Assignment state is visible after failure.

### Share lifecycle

- Revoked links show the same generic unavailable state as deleted links.
- Expired links do not reveal whether the source still exists.
- Existing sanitized snapshot privacy rules remain unchanged.

## Non-Goals

- Do not add messaging, social discovery, comments, likes, or public workout
  search as part of this reliability work.
- Do not add offline workout execution or sensor telemetry.
- Do not replace the canonical editor or planner service boundaries.
- Do not make share-link creation store raw tokens for the sake of generic
  idempotency.
- Do not silently merge concurrent edits in the first implementation.

## Agent Handoff

An implementing agent should begin by reading this task, the feature records
listed above, `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, and
`docs/AI-HANDOFF.md`. Claim `RELIABILITY-001` in `WORK-INDEX.md` before code
changes. Start with Slice 1 and record the command-receipt shape before adding
domain-specific request keys.

For each slice:

- Inspect the existing service and route before editing.
- Preserve unrelated uncommitted planning documents and `next-env.d.ts`.
- Keep route handlers thin and business rules in services.
- Run focused verification for the changed workflow before continuing.
- Update this task's progress log with changed files, decisions, and behavior.
- Commit only the verified logical slice; do not amend or push without request.

## Progress Log

### 2026-09-01

- What changed: Registered `RELIABILITY-001` and documented a dependency-ordered
  plan for trustworthy saves, atomic domain mutations, retry identity, draft
  recovery, optimistic conflicts, auth expiry, and share-link lifecycle.
- Decision or discovery: Use a small command-receipt boundary for replayable
  domain writes, but explicitly exclude share-link creation unless raw bearer
  tokens can remain hash-only. Use existing `updatedAt` fields for conflicts
  and bounded user-scoped `sessionStorage` for recent drafts.
- Files touched: `features/workflow-reliability.md`,
  `tasks/2026-09-01-workflow-reliability.md`,
  `decisions/0013-trustworthy-workflow-mutations.md`,
  `history/2026-09-01-workflow-reliability-plan.md`, `WORK-INDEX.md`,
  `CURRENT-STATUS.md`, and the related coverage record.
- Verification: Existing repository status and reliability-related feature
  records inspected; no application code changed by this planning task.
- Blocker or next step: An implementing agent should claim the planned feature
  and begin Slice 1 with the command-receipt contract.

## Handoff / Completion

- **Final status:** `planned`
- **History record:** [workflow reliability plan](../history/2026-09-01-workflow-reliability-plan.md)
- **Feature records updated:** [workflow reliability](../features/workflow-reliability.md), [work index](../WORK-INDEX.md)
- **Remaining work:** Implement Slices 1-9 in dependency order. Slice 0 is
  complete as this planning record.
