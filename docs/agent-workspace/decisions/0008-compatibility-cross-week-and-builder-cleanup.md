# Decision 0008: Compatibility Cross-Week Reassignment And Builder Cleanup

- **Date:** 2026-08-21
- **Status:** Accepted
- **Scope:** Transitional coach session API and retired builder client

## Decision

Legacy coach-session updates use the draft's scheduled date to select the
Monday-based athlete week Plan. A cross-week edit therefore moves/reassigns the
session to the target week Plan rather than preserving a stale Plan relation.
Foreign template IDs are rejected unless the template belongs to the athlete's
coach. Activity-backed sessions remain immutable with the completion policy.

`/coach/builder` remains a compatibility redirect that preserves `templateId`
and `athleteId` query parameters. The unreferenced `BuilderClient.tsx` is removed;
the active planner and source assignment panel are the supported UI.

## Rationale

The old API is still needed by existing callers, but stale week ownership is
more misleading than reassignment under the active Monday-week model. Template
ownership must be checked at the service boundary because the compatibility
route receives untrusted legacy drafts. Reference analysis found no runtime
consumer for the old builder client.

## Consequences

- Compatibility updates remain narrow and do not add new product behavior to the
  old planner service.
- Existing callers can continue using the builder URL and old draft shape.
- New planner behavior belongs in the active planner services and assignment
  command, not in `planner-service`.
