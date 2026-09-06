# Decision: Trustworthy Workflow Mutations

- **Date:** `2026-09-01`
- **Status:** `accepted for planning`
- **Feature ID:** `RELIABILITY-001`

## Context

Workout Planner already has separate service boundaries for Planner, Templates,
Assignments, Session adjustments, completion, snapshots, and sharing. The main
remaining product risk is not missing domain functionality; it is uncertainty
around saves under retries, network failures, refreshes, authentication expiry,
and concurrent edits.

## Decision

Use a small server-side command-receipt boundary for replayable domain mutations.
Each mutation carries a client-generated opaque request key, a server-defined
operation name, and a canonical payload hash. A receipt is completed in the same
transaction as the domain write and replays the original sanitized response for
the same user/operation/key/payload.

Use existing `updatedAt` fields for optimistic concurrency. Existing-record
updates require an expected version and return a visible conflict instead of
silently overwriting a newer edit.

Use bounded, user-scoped `sessionStorage` for recent unsaved canonical editor
drafts. Drafts are restored or discarded explicitly and are cleared only after
confirmed save or explicit discard.

Do not apply generic response receipts to share-link creation unless a future
design can recover the original URL without storing a raw bearer token. The
share contract permits multiple links, and raw tokens must remain outside the
database.

Add nullable `revokedAt` and `expiresAt` to ShareLink in a later lifecycle slice;
existing links remain valid by default, creator revocation is immediate, and
inactive links return the same generic unavailable state.

## Consequences

- Domain services remain the owners of atomic writes and ownership rules.
- Create commands become safe to retry without duplicate user-visible records.
- The UI must distinguish failure, retry, conflict, and authentication recovery
  rather than resetting drafts.
- A generic command receipt cannot be used for every mutation; share-link token
  privacy is an explicit exception.
- SQLite uniqueness constraints and transaction boundaries become part of the
  product reliability contract.

## Alternatives Rejected

- **Client-only duplicate prevention:** insufficient after refreshes, retries,
  multiple tabs, or lost responses.
- **Blind last-write-wins updates:** can erase coach/athlete edits and notes.
- **Persisting raw share tokens for replay:** violates the bearer-token storage
  contract.
- **One generic service owning every domain write:** would weaken existing
  planner/template/session service boundaries.
