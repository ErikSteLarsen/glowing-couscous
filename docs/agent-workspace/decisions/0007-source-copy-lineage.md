# Decision 0007: Explicit Source-Copy Lineage

- **Date:** 2026-08-21
- **Status:** Accepted
- **Scope:** Coach assignment of templates, library sessions, and training plans

## Decision

Reusable source assignment always creates a snapshot. Library copies record the
source Session and target date on `Assignment`; training-plan copies record the
source TrainingPlan in a unique parent assignment for athlete and Monday week,
then record each copied source Session on its child Assignment row. Template
copies continue to use the existing `Session.templateId` lineage.

The unified `assignmentService.assignSourceToAthlete` command verifies coach
ownership and roster membership, copies source content and metrics, and reuses
an existing lineage record for idempotent repeated assignment. Source changes
after assignment never update copied athlete sessions.

## Rationale

Explicit foreign keys preserve database integrity and make idempotency queries
safe without a polymorphic source type/ID pair. A training plan has a parent
operation because one source produces several weekday sessions; the Monday week
is the stable target identity.

## Consequences

- Library and training-plan assignment can be edited independently of its source.
- The active planner and future template UI can use one backend command contract.
- Live synchronization is intentionally not introduced.
- Existing template assignment remains backward compatible while routing through
  the same source command boundary.
