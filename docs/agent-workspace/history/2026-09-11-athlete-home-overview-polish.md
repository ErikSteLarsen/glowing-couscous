# Athlete Home overview polish — 2026-09-11

## What changed

- Removed the duplicate Calendar action from the Week at a glance header while
  keeping the top-bar Calendar action as the global entry point.
- Replaced the empty next-action Calendar link with a clear empty-week message
  and a Planner handoff.
- Moved overview customization outside the metric-card grid so it cannot become
  an orphaned fifth grid item.
- Added a four-column large-desktop week tier and modest wide-screen spacing to
  reduce vertical stacking and give the overview more breathing room.

## Files

- `app/(app)/athlete/page.tsx`
- `docs/agent-workspace/tasks/2026-09-08-week-at-a-glance-redesign.md`
- `docs/agent-workspace/features/athlete.md`
- `docs/agent-workspace/WORK-INDEX.md`

## Verification

- `pnpm test` — 175 passing.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing middleware-to-proxy deprecation warning remains.
- `git diff --check` — pass.
- Impeccable detector for `app/(app)/athlete/page.tsx` — `[]`.
- Browser viewport inspection — not run; the connected browser bridge is
  unavailable in this session.

## Follow-up

- Review the updated Home route at mobile, intermediate, and wide desktop sizes
  when browser access is available.
