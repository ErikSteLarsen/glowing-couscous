# Decision 0010: Session Adjustments And Actual Outcomes

- **Date:** 2026-08-25
- **Status:** Accepted
- **Scope:** Canonical session editing, athlete/coach adjustments, completion outcomes, and template assignment snapshots

## Decision

- Create one new canonical session editor/data contract for empty creation,
  planned edits, and actual-outcome edits. Migrate active planner, template, and
  athlete flows to it; do not make the legacy `WorkoutBlocksEditor` contract the
  new source of truth.
- A template or coach source is copied into one independent scheduled session.
  Editing that session never changes the template, source session, or other
  assignments. Template edits never synchronize into existing assignments.
- Preserve the latest coach-authored version as the coach baseline. Before
  completion, a coach edit overwrites the current athlete-session plan and
  becomes the latest baseline; an athlete edit changes only that scheduled
  session and marks it adjusted.
- After completion, the current session represents the athlete actual. The
  latest actual replaces the previous actual when either role corrects it, while
  the latest coach baseline remains unchanged. No actual-version history is
  required in the first release.
- The editor supports all session fields, full block structure, explicit
  skipped blocks, schedule movement of the current assignment, athlete notes,
  coach notes, and optional integer RPE from 1 to 10. Planned saves and
  completion are separate actions. Corrections to an already completed actual
  save immediately and keep the session completed.
- Derived duration, TSS, zone totals, and segments are recomputed from the
  latest actual blocks. A baseline/actual comparison is available to both roles
  from session detail and Activity; the first version is a dialog that toggles
  between the two complete views without automatic diff highlighting.

## Rationale

Athlete and coach adjustments are common at the individual session level, while
template and reusable-source content must remain reusable and stable. Keeping a
latest coach baseline beside the latest actual preserves the useful comparison
without introducing synchronization or a full event/version-history system.

The shared editor prevents create, planned-edit, and actual-edit flows from
drifting. Direct correction of a completed actual is more useful than the
current reopen/delete-Activity behavior, while replacing only the latest actual
keeps the first release small.

## Consequences

- The current `Session`/`Activity` model needs a durable baseline and actual
  snapshot strategy; `Activity` metrics must no longer be treated as derived
  from mutable planned blocks after completion.
- Coach planner mutation guards must distinguish pre-completion plan edits from
  completed actual corrections.
- The existing immutable-completed-session decision is superseded for this
  explicit outcome-edit workflow; unrelated planner mutation paths remain
  protected.
- Skipped blocks, RPE, separate coach/athlete notes, and comparison access need
  validation and route/service coverage.

## Implementation Contract Notes

`SESSION-EDIT-001` implements the first part of this decision in the pure
`lib/session-editor.ts` module. The editor draft keeps targets nested as the
Tempo target value and serializes them to the existing flat `targetType`,
`targetLow`, and `targetHigh` persistence fields. Skipped blocks remain in the
draft and serialized content, but are excluded from `session-math` projections.
The difference identity intentionally compares only schedule fields and ordered
block content; session title, sport, summary, notes, sport metrics, and RPE are
metadata changes rather than a new baseline/actual version. The editor never
assigns or changes session status.

The coach planner and template migration keeps workspace ownership and
source-template context in `lib/session-editor-adapters.ts` rather than adding
planner concerns to the generic contract. Existing service payloads remain
compatibility adapters until the snapshot/persistence tasks add durable storage
for skipped blocks, RPE, and separate coach/athlete notes.

`SESSION-SNAPSHOT-001` uses latest-value JSON payloads rather than a new version
history relation: `Session.coachBaselineJson` stores the complete latest coach
baseline, and `Activity.actualSnapshotJson` stores the complete latest actual.
`Session.coachNotes`, `Session.rpe`, and `Activity.rpe` provide explicit access
to bounded metadata while the payload preserves skipped blocks, schedule, notes,
targets, and derived-input content. Actual equality is projected away when the
baseline/actual difference identity has no block or schedule difference.

`SESSION-PLAN-ADJUST-001` keeps planned edits on the assigned Session: athletes
use `athlete-session-adjustment-service` and set `adjusted`, while coach edits
through `coach-planner-service` clear `adjusted` and replace the latest baseline.
Moving a planned session updates its existing Plan and Assignment target date in
the same transaction; source/template lineage and other assigned Sessions are
not synchronized.

`SESSION-ACTUAL-001` exposes one `saveActualOutcome` command from
`athlete-completion-service` to both athlete and roster-coach adapters. It replaces
the current Session blocks and latest Activity payload transactionally, recomputes
manual actual metrics from the canonical draft, retains the completion timestamp
and completed status, and never overwrites `Session.coachBaselineJson`.
