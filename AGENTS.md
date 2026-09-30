# Agent Operating Guide

Read `README.md`, `docs/agent-workspace/CURRENT-STATUS.md`, and
`docs/agent-workspace/WORK-INDEX.md` before non-trivial work. Read
`ARCHITECTURE.md` when changing routes, services, Prisma, or authentication.
Read `PRODUCT.md` and `DESIGN.md` for product or interface work.

The same rules apply to every model and tool. Keep task scope, acceptance and
blockers explicit; do not maintain separate instructions by model family.
Setup commands live in `docs/OPERATIONS.md`; repeatable acceptance lives in
`docs/VERIFICATION.md`. Consult the relevant section rather than copying it.

## MVP Priority

Follow PRODUCT.md: complete self-directed personal training first, from a fresh
account through workout creation, scheduling, completion, and outcome review,
without requiring a coach. Treat the current Athlete role as the personal-use
workspace. Prioritize core reliability and usability over coach feature
expansion. Preserve existing coach behavior and authorization boundaries in
shared changes; coach-only gaps are secondary unless explicitly requested.

## Operating Rules

- Source code and tests override documentation when they disagree.
- Inspect the existing service owner before adding business logic to a route or component.
- Keep route handlers thin and keep Prisma-backed behavior in `lib/` services.
- Use `pnpm`; do not introduce another package manager.
- Preserve unrelated worktree changes. Never reset or checkout files to discard them.
- Do not claim browser or production verification unless it was actually run.
- For interface work, treat `DESIGN.md` as the durable visual contract, verify
  tokens in `app/globals.css`, and inspect shared component owners before adding
  route-local styles.

## Coordination

- Update `CURRENT-STATUS.md` when verified behavior, risks, or gates change.
- Update `WORK-INDEX.md` when a capability or its owner changes.
- For active multi-step work, create a dated task from `docs/agent-workspace/tasks/TEMPLATE.md` and list it in the index.
- Remove a completed task brief after its result is reflected in current status and the index. Task files are not an archive.
- Put durable product, architecture, or visual rules in `PRODUCT.md`, `ARCHITECTURE.md`, or `DESIGN.md`. Do not recreate a history or decisions archive.

## Verification

Run the smallest relevant checks while iterating. Before finishing a behavior
change, run `pnpm test`, `pnpm lint`, and `pnpm build` when the environment
allows it, then record the actual result in the current status document. For prose-only
changes, check references/source accuracy and `git diff --check`; application
tests and a migration-bearing build are not required.
