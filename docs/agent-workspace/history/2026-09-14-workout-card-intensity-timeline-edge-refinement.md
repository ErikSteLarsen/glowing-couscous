# Workout Card Intensity Timeline Edge Refinement

- **Date:** 2026-09-14
- **Agent:** OpenCode
- **Feature:** `ATHLETE-001`
- **Follows:** [proportion refinement](2026-09-14-workout-card-intensity-timeline-refinement.md)

## Behavior

- Card and compact intensity timelines now have square outer and segment edges.
- Removing the previous small segment-top and outer-container radii prevents
  short blue bars from appearing clipped.
- The full-size detail structure timeline preserves its rounded shape; only the
  compact card visualization changes.

## Files

- `components/tempo/SessionBlockBar.tsx`
- `DESIGN.md`
- `docs/agent-workspace/WORK-INDEX.md`
- `docs/agent-workspace/features/athlete.md`
- `docs/agent-workspace/tasks/2026-09-08-week-at-a-glance-redesign.md`
- `docs/agent-workspace/decisions/0020-workout-card-intensity-timeline.md`

## Verification

- `pnpm test` — 175 passing
- `pnpm lint` — pass
- `git diff --check` — pass
- `.opencode/skills/impeccable/scripts/impeccable detect --json components/tempo/SessionBlockBar.tsx components/tempo/SessionRow.tsx` — `[]`
- `pnpm build` — pass; existing middleware-to-proxy deprecation warning remains

## Follow-up

Review the square-edge timeline in a browser at narrow, intermediate, and wall
widths before making further visual proportion changes.
