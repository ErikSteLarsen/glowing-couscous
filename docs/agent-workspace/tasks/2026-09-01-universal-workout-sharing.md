# Task: Universal workout and template sharing

- **Status:** `in-progress`
- **Agent:** `OpenCode`
- **Started:** `2026-09-01`
- **Updated:** `2026-09-01`
- **Feature IDs:** `SHARE-001`
- **Related records:** [share-links](../features/share-links.md), [sharing decision](../decisions/0012-universal-workout-sharing.md), [planner](../features/planner.md), [templates](../features/templates.md), [athlete](../features/athlete.md)

## Goal

Allow any authenticated user with access to a workout Session or Template to
create a universal bearer link. Anyone with the link can preview a sanitized
workout definition. A signed-in recipient can use it as an unsaved Planner
draft or save it as a private Template copy, with no automatic scheduling and
no synchronization to the source.

## Starting Context

- Current behavior: Sessions and Templates can be built, edited, duplicated,
  assigned, and privately scheduled, but there are no share links or public
  workout previews.
- Existing owners/services: `SessionComposer`, `session-editor.ts`,
  `session-editor-adapters.ts`, `templateService`, `athletePlannerService`,
  `coachSessionLibraryService`, and `assignmentService` for coach scheduling.
- Related active or transitional work: `SESSION-ADJUST-001` remains the umbrella
  for session editing; this feature must reuse its canonical editor and must not
  create a second copy or synchronization path.

## Product Contract

### Share sources

- `Template`: reusable owner-scoped workout definition.
- `Session`: a concrete accessible scheduled or standalone library workout with
  workout blocks. Whole `TrainingPlan` sharing is deferred.
- `Activity` and actual outcomes are never share sources in v1.

### Who can create links

Any authenticated user who can already access the source through the live app:

| Source | Allowed creator |
|---|---|
| Owned Template | Template owner |
| Athlete Session | Owning athlete or roster coach |
| Standalone coach Session | Coach owner |
| Training-plan child Session | Deferred from v1 unless explicitly enabled later |

The service returns an indistinguishable not-found result for inaccessible and
missing records. A numeric source ID alone never grants access.

### Recipient actions

- Anonymous visitor: read-only sanitized preview only.
- Signed-in athlete: `Use in Planner` opens an editable unsaved private athlete
  draft; explicit save creates the private Session and Plan as appropriate.
- Signed-in coach: `Use in Planner` opens an editable unsaved standalone coach
  library draft; explicit save creates the private library Session.
- Signed-in user of either role: `Save as Template` opens an editable unsaved
  private Template draft; explicit save creates the owner-scoped Template.
- No recipient action creates a database row before explicit save.
- Saved copies do not retain a live source relation, source Template ID,
  Assignment, or synchronization path.

### Shared content

The link resolves a sanitized snapshot created when the link is generated. The
projection includes sport, title, summary, ordered workout blocks, targets,
duration, and derived workout metrics. It excludes Activity, actual outcomes,
baseline/actual JSON, coach/athlete notes, RPE, assignments, owner identity,
and relationship data.

For a completed Session, share the planned workout projection when a stored
baseline is available; never share Activity or actual outcome data. If no
baseline exists, use the current Session workout fields as a documented legacy
fallback.

## Scope Boundaries

### In scope

- Opaque bearer token generation and hashed storage.
- One share link for one Session or Template.
- Public preview outside the authenticated app shell.
- Login/signup/setup continuation that preserves the share intent.
- Unsaved Planner intake for coach and athlete roles.
- Unsaved Template intake for coach and athlete roles.
- Explicit-copy persistence, private ownership, and source independence.
- Share buttons on the existing Session and Template surfaces.
- Authorization, sanitization, invalid-link, and no-auto-scheduling tests.

### Deferred

- Recipient allowlists, approvals, or coach-athlete-only restrictions.
- Expiration, usage limits, link revocation UI, or abuse rate limiting.
- Public search, marketplace, social profiles, comments, likes, or analytics.
- Live synchronization or template version history.
- Whole TrainingPlan sharing.
- Sharing completed Activity or actual performance results.
- Anonymous persistence without an account.

## Proposed Data Model

Add `ShareLink` to `prisma/schema.prisma` with named relations:

```text
ShareLink
- id
- tokenHash (unique)
- sessionId (nullable)
- templateId (nullable)
- createdById
- snapshotJson
- createdAt
```

Enforce exactly one of `sessionId` or `templateId` in the service and tests.
Store only the hash of a high-entropy URL-safe token. Multiple links to one
source are allowed initially. Source deletion invalidates its links. The
snapshot is a sanitized share-time payload, not a replacement for the source
record or a history system.

## Implementation Slices

### Slice 0: Product contract and records

- **Depends on:** None.
- **Files:** This task, `features/share-links.md`,
  `decisions/0012-universal-workout-sharing.md`, `WORK-INDEX.md`.
- **Done when:** Source types, creator access matrix, snapshot semantics,
  privacy projection, recipient actions, and non-goals are recorded.

### Slice 1: Shared projection and import draft contract

- **Depends on:** Slice 0.
- **Likely files:** New types/helpers near `lib/share-link-service.ts` and
  `lib/session-editor-adapters.ts`; `tests/share-link-service.test.ts`.
- **Done when:** A `Session` or `Template` source can be converted into one
  sanitized shared projection and then into the canonical Session editor draft
  without Prisma calls in UI code. The conversion explicitly drops schedule,
  status, ownership, private fields, Activity, and actual outcomes.

### Slice 2: Schema and token persistence

- **Depends on:** Slice 1.
- **Likely files:** `prisma/schema.prisma`, new `lib/share-link-service.ts`,
  `tests/share-link-service.test.ts`.
- **Done when:** `ShareLink` relations, indexes, one-source invariant, token
  hashing, token lookup, and source deletion behavior are implemented. The
  disposable SQLite database can be reset and seeded successfully.

### Slice 3: Source access and link commands

- **Depends on:** Slice 2.
- **Likely files:** `lib/share-link-service.ts`, `lib/api-auth.ts`,
  `lib/session-comparison-service.ts` or snapshot readers if reuse is needed,
  `tests/share-link-service.test.ts`.
- **Done when:** Owner athlete, roster coach, standalone coach owner, and
  Template owner cases can create links. Unrelated users and inaccessible IDs
  receive the same not-found result. Completed Sessions never project Activity
  or actual outcome data.

### Slice 4: Link creation API

- **Depends on:** Slice 3.
- **Likely files:** `app/api/share-links/route.ts`, `lib/route-params.ts`,
  `tests/route-params.test.ts`, route boundary tests.
- **Done when:** `POST /api/share-links` uses `requireSignedInUser`, validates a
  strict source kind and positive source ID, returns a relative `/share/<token>`
  URL, and performs no copy or scheduling mutation.

### Slice 5: Public share preview

- **Depends on:** Slice 3.
- **Likely files:** `app/share/[token]/page.tsx`, optional
  `app/share/[token]/ShareLandingClient.tsx`, share UI component/tests.
- **Done when:** Anonymous visitors can view the sanitized snapshot for both
  source kinds. Invalid, deleted, malformed, and inaccessible links show a
  generic unavailable state. The page offers only `Use in Planner` and `Save as
  Template`, does not mutate data, sits outside `(app)`, uses `noindex`, and
  limits referrer leakage.

### Slice 6: Authentication and share-intent continuation

- **Depends on:** Slice 5.
- **Likely files:** Login/signup/setup pages and auth redirect helpers, likely
  `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`,
  `app/(auth)/setup/page.tsx`, plus route tests.
- **Done when:** An anonymous recipient can select an action, authenticate or
  complete role setup, and return to the same share token and action. Callback
  paths are local allowlisted paths with no open redirect.

### Slice 7: Save-as-Template intake

- **Depends on:** Slices 1, 4, 5, and 6.
- **Likely files:** `lib/template-service.ts`,
  `lib/session-editor-adapters.ts`,
  `app/(app)/coach/templates/page.tsx`,
  `app/(app)/athlete/templates/page.tsx`,
  `app/(app)/coach/templates/CoachTemplatesClient.tsx`, template tests.
- **Done when:** A signed-in recipient gets an editable private Template draft
  from either source kind, can explicitly save it, and receives independent
  Blocks owned by that recipient. Source schedule, status, notes, RPE, Activity,
  and ownership are not copied. Existing owner checks remain authoritative.

### Slice 8: Use-in-Planner intake

- **Depends on:** Slices 1, 4, 5, and 6.
- **Likely files:** `lib/athlete-planner-service.ts`,
  `lib/coach-session-library-service.ts`,
  `app/(app)/athlete/planner/page.tsx`,
  `app/(app)/athlete/planner/AthletePlannerClient.tsx`,
  `app/(app)/coach/planner/page.tsx`,
  `app/(app)/coach/planner/PlannerClient.tsx`, adapter and service tests.
- **Done when:** An athlete receives an unsaved private athlete draft and a
  coach receives an unsaved standalone library draft. Explicit save is the only
  point that creates a Session or Plan. No Assignment, roster scheduling, or
  source relation is created.

### Slice 9: Share controls on existing surfaces

- **Depends on:** Slice 4 and the preview contract; can run alongside Slices 7-8.
- **Likely files:** New `components/ShareLinkButton.tsx`,
  `app/(app)/coach/templates/CoachTemplatesClient.tsx`,
  `app/(app)/athlete/templates/page.tsx`,
  `app/(app)/coach/planner/PlannerClient.tsx`,
  `app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx`, and any
  coach athlete-detail/session list surface selected during implementation.
- **Done when:** Every supported accessible Template and Session surface has a
  Share action with loading, failure, copy-link, and success states. The UI
  warns that anyone with the URL can view the workout and does not expose
  controls for deferred whole-plan sharing.

### Slice 10: Copy independence and security hardening

- **Depends on:** Slices 2-9.
- **Likely files:** `lib/share-link-service.ts`, schema/service tests,
  `tests/architecture-boundaries.test.mjs`, `tests/route-params.test.ts`,
  public-route tests, and auth continuation tests.
- **Done when:** Raw tokens are never persisted or logged, public projections
  exclude private fields, source edits do not mutate copies, preview creates no
  rows, error responses do not enumerate records, and dynamic routes do not
  perform direct Prisma business logic.

### Slice 11: Full verification and documentation

- **Depends on:** All prior slices.
- **Likely files:** `ARCHITECTURE.md`, `docs/AI-HANDOFF.md`,
  `docs/agent-workspace/CURRENT-STATUS.md`, `features/share-links.md`, a dated
  history entry, and all relevant tests.
- **Done when:** The route/service/data ownership map is documented, the feature
  is recorded with verification evidence, and the following pass:
  `pnpm db:push --force-reset && pnpm db:seed`, `pnpm test`, `pnpm lint`,
  `pnpm build`, and `git diff --check`. Manual browser checks cover anonymous
  preview, invalid links, authentication continuation, both source kinds, both
  roles, explicit save behavior, privacy projection, and mobile/desktop layouts.

## Dependency Graph

```text
0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> (7 || 8) -> 9 -> 10 -> 11
```

Slices 7 and 8 can be developed in parallel once the shared projection and
authentication continuation contract are stable. Slice 9 can proceed in
parallel after the creation API and public action URLs are fixed.

## Verification Matrix

### Service/data

- Session and Template source projection.
- Creator access matrix and indistinguishable not-found behavior.
- Token entropy, hashing, malformed-token rejection, and one-source invariant.
- Sanitized fields and exclusion of Activity, actuals, private notes, RPE,
  assignments, and identity data.
- No persistence during preview or action selection.
- Independent recipient Blocks and no source synchronization.

### Route/architecture

- Link creation uses `requireSignedInUser`.
- Public share routes remain outside the signed-in app layout.
- API routes are thin and use shared transport parsing.
- Auth callbacks accept only local allowlisted paths.
- Public route and clients delegate source behavior to the service/adapters.

### Browser

- Anonymous Template preview.
- Anonymous Session preview.
- Invalid/deleted link state.
- Login, signup, and setup continuation.
- Athlete Use in Planner and Save as Template.
- Coach Use in Planner and Save as Template.
- Explicit save versus no-auto-scheduling behavior.
- Source edit after link creation does not alter the shared snapshot or saved
  recipient copy.
- Narrow and wide layouts, clipboard failure, loading, and error states.

## Open Follow-up Work

- Add link revocation, expiry, rate limiting, and abuse reporting if bearer links
  are widely distributed.
- Add source versioning if users need links that target a specific historical
  revision rather than a share-time snapshot.
- Decide whether to support whole TrainingPlan links.
- Decide whether to share actual performance results as a separate explicit
  projection with stronger privacy controls.
- Consider public discovery only after private-link usage is proven.

## Handoff / Completion

- **Final status:** `in-progress`
- **History record:** [universal sharing implementation](../history/2026-09-01-universal-workout-sharing.md)
- **Feature records updated:** [share-links](../features/share-links.md), [work index](../WORK-INDEX.md), [current status](../CURRENT-STATUS.md)
- **Remaining work:** Perform and record the required manual browser checks at
  mobile and desktop widths. Keep SHARE-001 in-progress until that evidence
  exists; automated implementation and repository gates are complete.

## Progress Log

### 2026-09-01

- What changed: Claimed SHARE-001 for implementation and confirmed the existing
  planning records are uncommitted workspace changes to preserve.
- Decision or discovery: The active app already has canonical SessionComposer
  drafts, owner-scoped Template persistence, private athlete Planner creation,
  and standalone coach library persistence. Sharing will add a snapshot/import
  boundary rather than extend assignment or compatibility planner behavior.
- Files touched: `docs/agent-workspace/tasks/2026-09-01-universal-workout-sharing.md`,
  `docs/agent-workspace/features/share-links.md`, `docs/agent-workspace/WORK-INDEX.md`.
- Verification: Repository status, recent commits, current diff, and all listed
  architecture/feature/decision records inspected on 2026-09-01.
- Blocker or next step: Implement the shared projection and canonical import
  draft contract, then continue through the persistence and route slices.

### 2026-09-01

- What changed: Added the pure shared workout projection and canonical import
  adapters for Planner and Template drafts.
- Decision or discovery: The projection retains only workout-definition fields,
  derived metrics, and block instructions. Imports always start in `create`
  mode with null source IDs, no schedule unless the recipient chooses one, and
  empty private fields.
- Files touched: `lib/share-link.ts`, `lib/session-editor-adapters.ts`,
  `tests/share-link-service.test.ts`.
- Verification: `pnpm exec node --experimental-strip-types --test tests/share-link-service.test.ts` — 4 passing tests.
- Blocker or next step: Add ShareLink persistence and hashed bearer-token lookup.

### 2026-09-01

- What changed: Added the `ShareLink` schema with named source/creator
  relations, source deletion cascades, hashed token persistence, source access
  checks, snapshot lookup, and explicit template/planner copy commands. Added
  the thin authenticated link-creation API.
- Decision or discovery: Session links are allowed for the owning athlete, the
  athlete's roster coach, or a standalone coach-library owner; training-plan
  children remain deferred. Completed-session Activity data is never loaded or
  projected, and recipient saves clear all source IDs before delegating to the
  existing owner-scoped services.
- Files touched: `prisma/schema.prisma`, `lib/share-link-service.ts`,
  `lib/template-service.ts`, `lib/coach-session-library-service.ts`,
  `app/api/share-links/route.ts`, `tests/share-link-service.test.ts`.
- Verification: `pnpm db:push --force-reset && pnpm db:seed` — pass; focused
  share-link tests — 7 passing tests. Existing TypeScript test errors remain in
  unrelated pre-existing test fixtures and are not caused by this service.
- Blocker or next step: Build the public share route and authentication intent
  continuation before wiring recipient intake UI.

### 2026-09-01

- What changed: Added the public `/share/[token]` preview outside the app shell,
  noindex/no-referrer metadata, anonymous action gating, signed-in canonical
  editing, role-aware explicit intake saves, login/signup/setup continuation,
  and Share controls on Template and Session surfaces.
- Decision or discovery: Authentication callbacks accept only local opaque share
  paths with the two supported actions. Anonymous and roleless visitors remain
  on preview until authentication and role setup are complete; selecting an
  action itself performs no persistence.
- Files touched: `app/share/[token]/page.tsx`,
  `app/share/[token]/ShareLandingClient.tsx`,
  `app/api/share-links/intake/route.ts`, `app/(auth)/*/page.tsx`,
  `middleware.ts`, `components/ShareLinkButton.tsx`, supported Session/Template
  surfaces, `lib/share-link.ts`, and route/service tests.
- Verification: Focused share route/service tests — 13 passing tests;
  `pnpm lint` — pass; `pnpm build` — pass with the existing middleware
  deprecation warning.
- Blocker or next step: Harden persistence independence and add final privacy,
  no-auto-scheduling, deletion, and architecture regression coverage.

### 2026-09-01

- What changed: Added regression coverage for standalone coach ownership,
  deferred training-plan children, completed-session baseline projection,
  private/actual field exclusion, source-deletion cascades, and local callback
  allowlisting. Share-link controls now report network failures as well as API
  and clipboard failures.
- Decision or discovery: Completed-session sharing reads only the durable coach
  baseline when present; current mutable content is only the documented legacy
  fallback. The shared service never reads Activity or actual snapshot data.
- Files touched: `tests/share-link-service.test.ts`,
  `tests/share-link-routes.test.mjs`, `components/ShareLinkButton.tsx`.
- Verification: Full `pnpm test` — 166 passing tests; focused share tests — 16
  passing tests. Lint/build remain passing from the route/UI slice.
- Blocker or next step: Run the final database reset/seed and repository gates,
  then update architecture and completion records. Browser verification still
  requires a browser-capable environment.

### 2026-09-01

- What changed: Corrected source-time projection selection so completed Sessions
  use the durable planned baseline while planned Sessions use current planned
  fields. Hardened stored snapshot parsing by validating nested blocks/metrics,
  rebuilding the sanitized projection, and rejecting malformed metric payloads.
  API adapters now use the exported `shareLinkService` singleton.
- Decision or discovery: A baseline is historical planned content for completed
  Sessions only; using it for an adjusted planned Session would violate the
  share-time snapshot contract.
- Files touched: `lib/share-link.ts`, `lib/share-link-service.ts`,
  `app/api/share-links/route.ts`, `app/api/share-links/intake/route.ts`, and
  `tests/share-link-service.test.ts`.
- Verification: Focused share tests — 17 passing; full `pnpm test` — 167
  passing; `pnpm lint`, `pnpm build`, and `pnpm exec prisma validate` — pass.
  Build retains the existing middleware deprecation warning.
- Blocker or next step: Preserve the visible browser-verification follow-up and
  complete final worktree review.
