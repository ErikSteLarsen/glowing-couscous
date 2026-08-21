# Decision 0002: Keep The Active Planner Separate From Compatibility Code

- **Recorded:** `2026-08-21`
- **Status:** `accepted-current-architecture`
- **Original implementation evidence:** `2026-06-23` planner and architecture cleanup work; current code verified at `57f9d45`
- **Related:** [planner](../features/planner.md), [compatibility](../features/compatibility.md), [architecture](../../../ARCHITECTURE.md)

## Context

The repository contains the active Tempo planner and an older coach-session API
that still serves compatibility behavior. Both use session/block models and
similar planner naming, so an incoming agent could extend the wrong boundary.

## Decision

New planner behavior goes through `coach-planner-service.ts`,
`coach-session-library-service.ts`, or `coach-training-plan-service.ts` according
to ownership mode. `planner-service.ts` and its old draft helpers remain live
only as a compatibility adapter until a deliberate migration removes them.

## Consequences

- Active planner work gets the richer ownership-aware draft contract and focused services.
- Compatibility behavior remains test-protected and must not be deleted casually.
- Cleanup requires reference analysis, a migration/removal decision, and a full verification pass.
