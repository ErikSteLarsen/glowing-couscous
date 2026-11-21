# UI SDK integration

Tempo uses `@ui-sdk/react` and its `@ui-sdk/core` peer, pinned together to
0.1.0-beta.6. React 19 is already installed. The SDK is unstyled; Tempo's
semantic tokens and shared classes remain the visual contract. No provider,
global SDK stylesheet, or agent access to private account actions is needed.

## Owners

- `components/tempo/Toggle.tsx`: controlled SDK Switch for settings, retaining
  the existing checked/onChange contract and pending-write disabling.
- `components/SessionDeleteAction.tsx`: SDK AlertDialog for explicit deletion,
  safe initial focus, focus containment and return, and Escape dismissal.
  Pending deletes prevent dismissal; failures retain the dialog and show the
  server error. Successful deletion closes it through existing callbacks.
- `components/SessionComparisonDialog.tsx`: SDK segmented radios for the
  Planned/Actual snapshot choice.
- `components/HomeSummaryDialog.tsx`: SDK Dialog for Home summary tiles. The
  tile is the trigger, so focus returns to it; Escape, a labelled title,
  contained scrolling, a bottom sheet on phones and a centered panel from
  `md`. Charts inside only consume Escape while a point is selected.
- `components/tempo/Menu.tsx`: Tempo-styled SDK Menu parts (content, items,
  checkbox/radio items, indicator, label, separator). Calendar uses it for the
  header More menu and each session's overflow actions.
- `components/StravaImportPanel.tsx`: SDK segmented radios for the Needs
  review/All activities filter. Existing inbox focus-return ref is preserved.

Native navigation links, selects, date fields, and existing native dialogs
remain valid controls. Adopt SDK behaviors when they improve an interaction;
replacement alone is not a reason to remove native semantics. Domain writes,
ownership checks and validation remain in their existing services.

## Development

Before using the SDK, read `node_modules/@ui-sdk/react/docs/llms.txt` and the
relevant pages in its `docs/components/` directory. For custom primitives,
search `docs/core.md` by heading and read `docs/rendering.md`. Installed docs
match the pinned release; the public website can describe a newer beta.
Upgrade both SDK packages together and rerun interaction acceptance.

Run `pnpm exec playwright install chromium` once, then `pnpm test:ui`.
The isolated Chromium fixture bundles the real Toggle, SessionDeleteAction and
SessionComparisonDialog. It checks keyboard selection, disabled controls,
modal focus containment/return, Escape, pending deletion, error retention and
successful retry at 390px and 1440px. Router navigation and fetch responses
are test adapters: this does not certify authenticated persistence, layout,
Strava delivery, physical devices or assistive technology.

Reference: [UI SDK documentation](https://ui-sdk.dev/docs).
