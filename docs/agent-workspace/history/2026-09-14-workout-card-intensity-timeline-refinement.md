# Workout Card Intensity Timeline Refinement

- **Date:** 2026-09-14
- **Agent:** OpenCode
- **Feature:** `ATHLETE-001`
- **Follows:** [initial intensity timeline](2026-09-14-workout-card-intensity-timeline.md)

## Behavior

- `SessionBlockBar` card and compact intensity timelines now have a transparent
  background instead of the recessed grey field.
- The chart caps at `18rem` wide in roomy cards, while still shrinking naturally
  in narrow calendar columns.
- Card and compact heights are now `32px` and `24px`. Zone bars use direct 20%
  steps, making Zone 1 through Zone 5 substantially easier to distinguish.
- The full-size detail structure bar and title-only month card remain unchanged.

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

Use a browser-backed review at narrow, intermediate, and wall widths before
making another proportion change.
