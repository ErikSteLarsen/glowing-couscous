# Decision 0006: Immutable Completed Sessions

- **Date:** 2026-08-21
- **Status:** Accepted
- **Scope:** Completion outcomes and coach planner mutations

## Decision

Once a session has an `Activity` outcome, its planned workout content and
schedule are immutable through coach planner save/delete paths. Those mutations
return `409` until a future explicit outcome-edit workflow exists. Athletes may
reopen the session through the completion service; reopening removes the Activity
outcome, restores `planned` status, and retains notes on the Session.

Manual completion stores an explicitly labeled `manual-planned` metric source,
planned duration/TSS/zone estimates, and nullable compliance. It does not claim
100% compliance without performed data.

## Rationale

Activity history is an outcome record. Allowing planner edits to rewrite the
blocks used to display an old outcome produces misleading history, while a
manual completion click does not provide enough information to calculate
performed compliance. Preserving notes across reopen avoids losing athlete
context while keeping Activity existence and session status consistent.

## Consequences

- Coaches must duplicate or create a new session instead of silently editing a
  completed one.
- Activity and completion readers must use stored outcome values and label manual
  values as estimates.
- Reopen is a deliberate lifecycle transition; completion itself remains
  idempotent for an already completed session.
