# Tempo contrast refinement — 2026-09-08

## Change

Deepened the primary navy/blue tokens used by the selected split-board system so
white labels and controls have clearer separation from their backgrounds. The
change is token-level and keeps component placement, typography, and the muted
accent strategy intact.

## Files

- `app/globals.css`

## Verification

- `pnpm lint` — pass on 2026-09-08.
- `pnpm test` — 175 passing on 2026-09-08.
- `pnpm build` — pass on 2026-09-08; existing middleware deprecation warning remains.
- Impeccable detector — clean on 2026-09-08.
