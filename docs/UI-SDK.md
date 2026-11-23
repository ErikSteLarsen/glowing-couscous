# UI SDK integration

Tempo uses `@ui-sdk/react` and its `@ui-sdk/core` peer, pinned together to
0.1.0-beta.6. React 19 is already installed. The SDK is unstyled; Tempo's
semantic tokens and shared classes remain the visual contract. No provider,
global SDK stylesheet, or agent access to private account actions is needed.

## Shared controls

| Control | Owner and usage |
|---|---|
| Buttons and action links | Use the primary, secondary, danger, ghost, compact, and round icon classes in `components/ui.tsx`. Use `ActionLink` for navigation with button styling. Keep `control-hover` for enabled-only feedback on native buttons and SDK controls. |
| Fields and groups | Use `formFieldClassName`, `formSelectClassName`, `formTextareaClassName`, and `formLabelClassName` with native elements. Keep native number fields and group related choices with a labelled fieldset. Associate field-specific hints and errors with the input via `aria-describedby`. |
| Search and filters | Use `components/tempo/SearchField.tsx` for labelled search, and `CollectionToolbar` for the Workouts tabs. Activity submits its native GET form. The public library applies changes immediately and keeps its query parameters in the URL. |
| View and value choices | Use `switchTrackClassName` and `getSwitchOptionClassName` for view controls, preserving the caller's link or tab semantics. Use `getSegmentedChoiceClassName` for form values, SDK segmented radios for single-select filters, and SDK Menu radio or checkbox items for choices inside a menu. |
| Overflow | Use `OverflowMenuTrigger` for a row or editor ellipsis, and the round icon class for a toolbar trigger. Give each trigger an accessible name. Use the SDK parts from `components/tempo/Menu.tsx` for keyboard navigation and focus return. |
| Dialogs and popovers | Start with `centeredDialogClassName`, `sheetDialogClassName`, or `nativeDialogClassName` for the matching layout. `overlayPanelClassName` supplies the surface for menus and popovers. Use a labelled title, the round icon class for an icon-only close button, and `dialogActionsClassName` for end-aligned footer actions. For a dialog opened from a menu, return focus to the menu trigger or a surviving control if the action removes it. |
| Confirmations | Use SDK AlertDialog with `components/tempo/ConfirmationDialogContent.tsx` for destructive actions. Focus lands on the safe action. While a request is pending, disable the actions and prevent dismissal. On failure, keep the dialog open and show the error. |
| Save feedback | Use `successTextClassName` with `role="status"` for inline success and `dangerTextClassName` with `role="alert"` for errors. Use a specific pending label and disable the initiating control or fieldset while a write is pending. |

## Owners

- `components/tempo/Toggle.tsx`: controlled SDK Switch for settings, retaining
  the existing checked/onChange contract and pending-write disabling.
- `components/SessionDeleteAction.tsx`: SDK AlertDialog for explicit deletion,
  safe initial focus, focus containment and return, and Escape dismissal.
  Pending deletes prevent dismissal; failures retain the dialog and show the
  server error. Successful deletion closes it through existing callbacks.
- Templates use the same AlertDialog content to discard a draft or delete a
  saved template. Events use it to delete an event.
- `components/SessionComparisonDialog.tsx`: SDK segmented radios for the
  Planned/Actual snapshot choice.
- `components/HomeSummaryDialog.tsx`: SDK Dialog for Home summary tiles. The
  tile is the trigger, so focus returns to it; Escape, a labelled title,
  contained scrolling, a bottom sheet on phones and a centered panel from
  `md`. Charts inside only consume Escape while a point is selected.
- `components/tempo/Menu.tsx`: Tempo-styled SDK Menu parts (content, items,
  checkbox/radio items, indicator, label, separator). Calendar uses it for the
  header More menu and each session's overflow actions. `WorkoutBuilder` uses
  it for Add step and each step or set ⋯ menu; actions that add, duplicate or
  remove a step pass `finalFocus` so focus lands on the resulting step.
- `components/StravaImportPanel.tsx`: SDK segmented radios for the Needs
  review/All activities filter. Existing inbox focus-return ref is preserved.

Native Library filters, Strava details, and session rescheduling keep their
existing focus and dismissal behavior. Account actions, workout deletion and
draft replacement, Profile recovery, Planner and Import removal, Strava
disconnect, and Ride retain their native confirmations. Domain writes, ownership checks, and validation
remain in their existing services.

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
