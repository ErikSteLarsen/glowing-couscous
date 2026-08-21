# Decision 0005: Database-Backed Pending Coach Request Uniqueness

- **Date:** 2026-08-21
- **Status:** Accepted
- **Scope:** Athlete-to-coach request lifecycle

## Decision

`CoachRequest.pendingAthleteId` is nullable and unique. It contains the athlete
ID only while a request is `PENDING`; accepted and rejected rows set it to null.
New requests and rejected-request reopen operations write the pending key, and
unique-constraint races return a domain `409` conflict.

Accepting a request runs in one transaction: the selected request becomes
`ACCEPTED`, its pending key is cleared, the athlete is connected to the coach
and leaves self-coached mode, and all other pending requests for that athlete
become `REJECTED` with cleared pending keys.

## Rationale

SQLite does not provide the partial-index workflow assumed by some relational
databases, while a nullable unique column allows multiple historical nulls and
exactly one active pending key. The service check improves normal responses, but
the database constraint is the concurrency authority.

## Consequences

- An athlete with an active coach cannot create a new request.
- A self-coached athlete may request a coach and becomes coach-connected only
  after acceptance.
- Existing historical request rows remain unique per athlete/coach pair.
- Existing databases require a backfill of pending keys for any pre-existing
  pending rows before relying on the constraint.
