# Start Live Anchor Color Cascade Fix

- **Date:** `2026-08-22`
- **Agent:** `OpenCode`
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`
- **Related task:** [interactive color and contrast audit](../tasks/2026-08-22-interactive-color-contrast.md)

## Root Cause

The `Start live` link rendered the expected `text-white` utility, but
`app/globals.css` declared an unlayered `a { color: inherit; }` rule after the
Tailwind import. Because the selectors have equal specificity and the custom
rule was later in the cascade, the anchor inherited `--text` and displayed
black text on the dark primary background.

## Fix

Moved the baseline anchor color and text-decoration rule into `@layer base`.
Tailwind utilities now take precedence for explicitly styled links while
unstyled anchors retain the application defaults.

## Verification

- `node --test tests/theme-accessibility.test.mjs` — failed on the new cascade
  assertion before the fix; passed after the fix.
- `pnpm test` — pass, 115 tests, 2026-08-22
- `pnpm lint` — pass, 2026-08-22
- `pnpm build` — pass, 2026-08-22
- `git diff --check` — pass, 2026-08-22

The existing Next.js `middleware` deprecation warning remains non-blocking.
