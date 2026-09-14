# Workout Card Intensity Timeline

- **Date:** 2026-09-14
- **Agent:** OpenCode
- **Feature:** `ATHLETE-001`

## Behavior

- Shared `SessionRow` card variants now show a compact intensity timeline for
  their workout segments.
- Each segment keeps its existing zone color and duration-proportional width.
  Its height rises from Zone 1 through Zone 5, making intensity visible at a
  glance in Home, Calendar week, and scheduled Workouts cards.
- The `card` bar is 24px high and the `compact` bar is 18px high. Full-detail
  views retain the original flat structure bar, and the dense Calendar month
  tile remains title-only.
- Screen-reader descriptions now include every segment's zone, label, and
  duration.

## Files

- `components/tempo/SessionBlockBar.tsx`
- `DESIGN.md`
- `docs/agent-workspace/CURRENT-STATUS.md`
- `docs/agent-workspace/WORK-INDEX.md`
- `docs/agent-workspace/features/athlete.md`
- `docs/agent-workspace/tasks/2026-09-08-week-at-a-glance-redesign.md`
- `docs/agent-workspace/decisions/0020-workout-card-intensity-timeline.md`

## Verification

- `pnpm test` — 175 passing
- `pnpm lint` — pass
- `pnpm build` — pass; existing middleware-to-proxy deprecation warning remains
- `git diff --check` — pass
- `.opencode/skills/impeccable/scripts/impeccable detect --json components/tempo/SessionBlockBar.tsx components/tempo/SessionRow.tsx` — `[]`

## Follow-up

Review the bar-height treatment at narrow, intermediate, and wall widths when a
browser becomes available.
