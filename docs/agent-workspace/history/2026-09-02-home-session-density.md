# Home Session Density

- **Date:** `2026-09-02`
- **Agent:** `OpenCode`
- **Feature IDs:** `ATHLETE-001`

## Changed Files

- `app/(app)/athlete/page.tsx`
- `tests/architecture-boundaries.test.mjs`
- Athlete feature and workspace status records

## Behavior

- Removed the planned/status badge from Home session tiles.
- Allowed Home workout titles to wrap instead of truncating, preserving more of
  the title and workout information in the available card space.
- Kept the session time, sport, block bar, duration, TSS, and target metadata.

## Verification

- `pnpm exec node --test tests/architecture-boundaries.test.mjs` — 17 tests passed on 2026-09-02.
- `pnpm test` — 168 tests passed on 2026-09-02.
- `pnpm lint` — passed on 2026-09-02.
- `pnpm build` — passed on 2026-09-02; the existing middleware deprecation warning remains.
- `git diff --check` — passed on 2026-09-02.
