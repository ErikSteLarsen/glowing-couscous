# Tempo visual direction demos — 2026-09-08

## Change

Created two isolated visual-system previews for the Tempo athlete dashboard:

- `/design/tempo-split` — a high-signal split-board direction with graphite
  navigation, mint action signal, compact metrics, and strong workout block
  rails.
- `/design/tempo-field` — a warmer field-notes direction with ink-blue
  navigation, sea-glass surfaces, citrus emphasis, softer geometry, and the
  same information architecture.

Both demos use the same synthetic athlete scenario so the comparison isolates
visual language. They include responsive layout behavior, mobile navigation,
keyboard focus states, workout start/detail demo states, week progress, recent
activity, and reduced-motion handling. Production authenticated routes and
shared tokens remain unchanged pending owner selection.

## Files

- `components/design/TempoDirectionDemo.tsx`
- `app/design/tempo-split/page.tsx`
- `app/design/tempo-field/page.tsx`
- `app/globals.css`
- `.impeccable/surfaces/app-page-tsx.md`

## Verification

- `pnpm lint` — pass.
- `pnpm test` — 175 passing.
- `pnpm build` — pass; existing Next.js middleware deprecation warning remains.
- `git diff --check` — pass.
- Impeccable detector — clean.
- Local HTTP checks — both demo routes returned `200 OK` on port `3002`.
- Browser screenshot review — not run; no desktop browser was connected in this
  session.

## Follow-up

Ask the product owner to choose a direction, then migrate the selected tokens
and component grammar into `app/globals.css`, `components/ui.tsx`,
`components/AppShell.tsx`, and `components/AppSidebar.tsx`, followed by a full
desktop/mobile browser acceptance pass.
