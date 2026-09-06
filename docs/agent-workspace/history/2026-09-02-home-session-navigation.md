# Home Session Navigation

- **Date:** `2026-09-02`
- **Agent:** `OpenCode`
- **Feature IDs:** `ATHLETE-001`

## Changed Files

- `lib/athlete-service.ts`
- `app/(app)/athlete/page.tsx`
- `tests/athlete-calendar.test.ts`
- Athlete feature and workspace status records

## Behavior

- Home keeps every session assigned to each of the four upcoming days instead
  of retaining only the first session.
- Today and upcoming-day session tiles are individually keyboard-accessible links
  to `/athlete/session/[sessionId]`.
- Multiple sessions assigned to the same day remain separate and can each be
  opened independently.

## Verification

- `pnpm exec node --experimental-strip-types --test tests/athlete-calendar.test.ts` — 7 tests passed on 2026-09-02.
- `pnpm test` — 168 tests passed on 2026-09-02.
- `pnpm lint` — passed on 2026-09-02.
- `pnpm build` — passed on 2026-09-02; the existing middleware deprecation warning remains.
- `git diff --check` — passed on 2026-09-02.
