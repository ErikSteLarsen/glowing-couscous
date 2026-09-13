# Handoff: Continue the Week-at-a-glance redesign

## Start with unavailable capabilities

Resolve these before changing UI:

1. **Desktop browser / screenshots are unavailable.** The previous session had
   no connected desktop browser, so no runtime viewport, focus, contrast, hover,
   or touch evidence exists. First check browser availability and ask the owner
   to connect/authorize one if necessary. If available, capture at minimum
   390px, 1280px, 1440px, and a wide desktop width for representative athlete
   and coach routes.
2. **Impeccable `document` and `extract` launcher commands were unavailable.**
   `/home/forsvaret/.config/opencode/skills/impeccable/scripts/impeccable --help`
   exposed `detect` but not those two commands. The equivalent documentation
   and extraction were completed manually. Recheck the launcher before trying
   again; do not claim those commands ran unless the executable supports them.
3. **Browser-based finish review is therefore conditional.** Source review,
   detector, tests, lint, build, and diff checks are evidence, not a substitute
   for browser screenshots. Keep this limitation visible.

## Required reading

Read these before continuing, in order:

- `AGENTS.md`
- `docs/agent-workspace/README.md`
- `docs/agent-workspace/CURRENT-STATUS.md`
- `docs/agent-workspace/WORK-INDEX.md`
- `docs/agent-workspace/tasks/2026-09-08-week-at-a-glance-redesign.md`
- `docs/agent-workspace/decisions/0017-week-at-a-glance-redesign.md`
- `DESIGN.md`
- `.impeccable/surfaces/authenticated-app.md`
- `.impeccable/critique/authenticated-app-finish.md`

## Current direction

The owner selected **Week-at-a-glance / The Training Calendar Wall** as a
replacement visual world, not a polish pass on the old navy split-board.

The Monday-to-Sunday week is the shared operating object. The system uses a
light high-contrast work surface, one active/action signal, semantic status
colors with visible labels, aligned day/session groupings, compact tabular
metrics, restrained borders, and flat-by-default surfaces.

Preserve product truth and behavior: role ownership, Monday boundaries,
structured workout blocks, templates, source-copy snapshots, completion/actual
semantics, session origins, sharing privacy, and existing service/API seams.

## What is already complete

- Shared shell/tokens/primitives migrated to the new system.
- Mobile navigation destinations made intentional; drawer focus isolation,
  Escape handling, focus restoration, inert closed state, and safe-area padding
  added.
- Athlete Home + Calendar redesigned around a real seven-day week wall and an
  explicit next action.
- Athlete Workouts + Session + Live + Activity carry week/date/status context;
  scheduled work leads Workouts; completion and network feedback is recoverable.
- Athlete Planner + Templates + coach discovery have selected-day summaries,
  scoped save copy, network recovery, private athlete vocabulary, reduced
  secondary actions, labelled search, announced feedback, and a pending private
  planning path.
- Coach roster/detail and coach Workouts/Templates/Planner/Source Assignment
  have direct planning handoffs, aligned week groups, synchronized athlete
  selection, specific assignment confirmation, and recoverable mutations.
- `SessionRow`, semantic `StatusBadge`, accessible `SessionBlockBar`, and
  keyboard move earlier/later controls exist as shared seams.
- `DESIGN.md`, `.impeccable/design.json`, the authenticated surface brief,
  direction decision, critique snapshots, task record, and history are present.

## Verification already recorded

- `pnpm test` — 175 passing
- `pnpm lint` — pass
- `pnpm build` — pass; existing middleware-to-proxy deprecation warning
- `git diff --check` — pass
- Final Impeccable detector over changed production UI targets — `[]`

## Next work, in order

### 1. Browser acceptance first

Start the app using the least-sandboxed available path. Capture and inspect
representative routes at 390px, 1280px, 1440px, and wide desktop:

- athlete Home
- athlete Calendar week/month
- athlete Workouts
- athlete Session and Live
- athlete Activity
- athlete Planner/Templates
- coach roster/detail
- coach Planner/Source Assignment

Check real content, long workout titles, multiple sessions per day, empty days,
loading/error/success states, keyboard focus, drawer behavior, touch target
comfort, and intermediate-width column reflow. Do one batched fix round, then
one confirmation round at most. If no browser is available, stop short of
claiming visual acceptance and record the blocker.

### 2. Only then decide whether to fund deferred work

The finish review left these visible but non-blocking follow-ups:

- Coach Planner still exposes two competing planning paths and lacks visible
  week navigation.
- Comparison dialog needs focus trap/restoration and stronger planned-vs-actual
  deltas.
- Route-level loading/error boundaries are still absent.
- Month-cadence assignment remains guided, not a complete month source model.
- Public sharing still needs browser acceptance.

Do not implement these automatically. Present the owner with the browser evidence
and a bounded batch proposal first.

## Working rules for the next agent

- Announce the exact scope before every batch.
- Critique one family at a time; fix only the highest-value findings.
- Preserve the existing task record and keep its status `in-progress` until
  browser evidence exists.
- Run `pnpm test`, `pnpm lint`, `pnpm build`, `git diff --check`, and the
  Impeccable detector for changed UI after each meaningful batch.
- Update the relevant feature records, `WORK-INDEX.md`, task progress, and add
  append-only history before finishing.
- Never reset, discard, or overwrite existing worktree changes.

## Completion criterion

This task can move to `completed` only when the agreed browser viewports have
been inspected, any material findings have been fixed or explicitly deferred by
the owner, final screenshots/evidence are recorded, the finish critique is
updated, and `DESIGN.md` describes the shipped system.

## Resolution — 2026-09-08

The connected OpenCode browser bridge remained unavailable, but local headed
Chrome via CDP on `DISPLAY=:0` supplied the required authenticated route review
at `390x844`, `1280x900`, `1440x1000`, and `1920x1080`. The route matrix and
confirmation evidence are recorded in `/tmp/opencode/tempo-browser-evidence/`.
One mobile touch-target defect in the shared skipped-block checkbox was fixed
and rechecked at `44px`. The bounded redesign is complete; Coach Planner
consolidation/week navigation, comparison dialog focus/deltas, route-level
loading/error boundaries, month-source assignment, and public sharing acceptance
remain explicitly deferred follow-up work.
