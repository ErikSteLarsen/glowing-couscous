# Decision: Universal Bearer Links For Workout Sharing

- **Date:** `2026-09-01`
- **Status:** `accepted; implementation in progress`
- **Feature ID:** `SHARE-001`

## Context

The app now has owner-scoped workout Templates, coach library Sessions, private
athlete Sessions, and a canonical editor. The next product loop is allowing
users to share one workout or Template and letting the recipient choose how to
reuse it without creating an unwanted schedule entry.

The initial product direction is intentionally broad: everyone may share, and
sharing rules can be added later. This makes a recipient-specific permission
model unnecessary for the first release, but it makes the link itself a
sensitive bearer credential.

## Decision

Use a generic share link for exactly one accessible `Session` or `Template`.
The URL contains a high-entropy opaque token; the database stores only its
cryptographic hash. A link is a read-only public preview of a sanitized,
share-time snapshot of the workout definition.

Anyone with the link may view it. A recipient must sign in before persistence
and chooses one of two actions:

- **Use in Planner:** open an editable unsaved draft. A coach saves to their
  private standalone library; an athlete saves to their private Planner.
- **Save as Template:** open an editable unsaved private Template draft.

Neither action creates a `Session`, `Plan`, `Assignment`, `Template`, or
`Activity` row until the recipient explicitly saves. A saved copy has no live
sync path to the source.

The public projection contains workout-definition content only. It excludes
actual outcomes, Activity data, baseline/actual snapshot JSON, private notes,
RPE, assignment data, owner identity, and coach-athlete relationship data.

Initial sharing has no recipient allowlist, approval, expiry, usage limit, or
role restriction beyond the creator's existing access to the source. The first
release supports scheduled/standalone Sessions and Templates; whole training
plans, public discovery, and sharing actual results are later work.

## Alternatives Considered

- **Role-specific recipient shares:** rejected for v1 because the product goal is
  universal sharing; can be added later without changing the link contract.
- **Live links to mutable source records:** rejected because later edits could
  unexpectedly change an already-shared workout and expose newly private data.
- **Automatic scheduling on receipt:** rejected because recipients need control
  over whether and when to use a shared workout.
- **Raw numeric IDs in URLs:** rejected because they are enumerable and reveal
  database structure; opaque bearer tokens are safer.
- **Public marketplace/discovery:** deferred because moderation, indexing,
  reporting, and privacy are separate product concerns.

## Consequences

- A `ShareLink` source must enforce an exactly-one-of `Session`/`Template`
  invariant and retain a sanitized snapshot.
- The public route must remain outside the authenticated app shell and use
  `noindex`/restrictive referrer behavior.
- Authentication continuation must preserve the share token and action through
  login, signup, and setup without permitting open redirects.
- Source deletion invalidates the link in v1; link revocation and expiry remain
  future hardening options.
- The source access matrix still matters when creating links: a link may only be
  created for a record the current user can already access.

## Implementation Notes

Recorded `2026-09-01`: the implementation uses `lib/share-link.ts` for the pure
sanitized projection and canonical create-mode import draft, and
`lib/share-link-service.ts` for access, SHA-256 token hashing, snapshot storage,
public lookup, and explicit copy orchestration. Recipient saves delegate to
existing Template, athlete Planner, and standalone coach-library services;
`assignment-service` is intentionally not involved. Browser acceptance remains
open before the feature can be marked shipped.
