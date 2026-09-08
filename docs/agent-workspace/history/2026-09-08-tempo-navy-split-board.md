# Tempo navy split-board refinement — 2026-09-08

## Change

Applied the selected split-board direction to the authenticated Tempo surfaces
with a more professional navy and cool-white treatment:

- Dark navy desktop and mobile navigation with restrained active states.
- Cool white paper/surface tokens, blue-gray borders, and muted typography.
- Steel-blue brand actions and quieter success/warning treatments.
- Muted on-screen workout block bars without changing serialized zone colors.
- Updated the split-board preview to represent the production system.
- Replaced remaining warm neutral/green accents across shell, forms, planner,
  calendar, session, coach, activity, and sharing surfaces.

## Files

- `app/globals.css`
- `components/AppShell.tsx`, `AppSidebar.tsx`, `AppProfileMenu.tsx`, `ui.tsx`
- `components/tempo/*`
- shared editor/request/session components
- authenticated route surfaces under `app/(app)/**`
- `app/share/[token]/ShareLandingClient.tsx`
- `docs/agent-workspace/decisions/0016-tempo-navy-split-board.md`

## Verification

- `pnpm test` — 175 passing on 2026-09-08.
- `pnpm lint` — pass on 2026-09-08.
- `pnpm build` — pass on 2026-09-08; existing middleware deprecation warning remains.
- `git diff --check` — pass on 2026-09-08.
- Impeccable detector — clean on 2026-09-08.
- Browser screenshot review — not run; no desktop browser was connected.

## Follow-up

Run a connected desktop/mobile viewport acceptance pass over the authenticated
shell and the `/design/tempo-split` preview.
