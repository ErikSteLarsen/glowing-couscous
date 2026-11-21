---
name: Tempo
description: A dark, quiet night instrument for endurance training where hairline rules, tabular numbers, and one cyan trace carry the week.
colors:
  ground: "#0B0F15"
  raised: "#151B24"
  surface: "#10151C"
  sunken: "#090C11"
  field-surface: "#0E131A"
  rule: "#1F2732"
  rule-strong: "#323C4A"
  ink-1: "#EEF2F6"
  ink-2: "#A9B4C1"
  ink-3: "#8592A1"
  trace: "#5EB6D8"
  trace-hover: "#82C9E4"
  trace-faint: "#2D4A5A"
  trace-ink: "#06121A"
  selection: "#2C6078"
  scrollbar-thumb: "#323C4A"
  scrollbar-thumb-hover: "#4A5666"
  success: "#5FCFA2"
  warning: "#F0A84A"
  danger: "#F3877A"
  missed: "#E3818F"
  compliance-good: "#5FCFA2"
  compliance-partial: "#F0A84A"
  compliance-off: "#F3877A"
  metric-fitness: "#5EB6D8"
  metric-fatigue: "#C08AE8"
  metric-form: "#F0A84A"
  zone-1: "#7F9BB5"
  zone-2: "#4FB89F"
  zone-3: "#D9B44A"
  zone-4: "#EE8A4C"
  zone-5: "#E8667E"
typography:
  page-heading:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  section-heading:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
  form-label:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  control:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1
  compact-control:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1
  stat-value:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
rounded:
  compact: "6px"
  control: "8px"
  field: "8px"
  tile: "16px"
  dialog: "16px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  page-inline: "20px"
  page-inline-sm: "28px"
  page-inline-lg: "40px"
components:
  button-primary:
    backgroundColor: "{colors.trace}"
    textColor: "{colors.trace-ink}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "40px"
  button-compact:
    backgroundColor: "{colors.trace}"
    textColor: "{colors.trace-ink}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
    height: "32px"
  icon-step-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    height: "40px"
  field:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.field}"
    padding: "8px 12px"
    height: "40px"
  tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.tile}"
    padding: "16px"
  status-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "24px"
  switch-track:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.control}"
    padding: "2px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "36px"
  session-block-bar:
    backgroundColor: "transparent"
    rounded: "{rounded.compact}"
    height: "32px"
---

# Design System: Tempo

## Overview

**Creative North Star: "Night Instrument"**

Tempo is an operational training surface organized around the Monday-to-Sunday
week. The week connects personal planning, session execution, completion, and
review. The first MVP prioritizes people managing their own training; onboarding,
empty states, and primary actions must make sense without a coach connection.
Coach collaboration is secondary.

The interface is a dark, quiet instrument: one deep ground, hairline rules
instead of heavy cards, tabular numbers wherever a value is read, and a single
cyan trace for what is active. It should feel precise and calm to open every day,
not like a motivational game board.

The authenticated product is the visual authority. `app/globals.css` is the token
implementation. The `/design/*` routes are alternate previews with sample content
and their own scoped CSS in `app/design/previews.css`; they are not production
tokens, layouts, or references.

**Key Characteristics:**

- Dark only. `color-scheme: dark` everywhere; there is no light theme or toggle.
- Hairline rules and tonal layers over heavy cards, borders, and shadows.
- One cyan trace owns primary action, active state, focus, and "now".
- Numbers are the content: large, tabular, with quiet units.
- Monday-first hierarchy with the current week and day easy to locate.
- Text-visible states and persistent keyboard focus.

## Colors

The ground is near-black blue; structure is drawn with rules and one step of
lift. Color is scarce and always means something.

### Neutrals

- **Ground** `{colors.ground}`: page canvas and sidebar.
- **Raised** `{colors.raised}`: hover fill, switch track, skeletons, avatars.
- **Surface** (`{colors.surface}`, raised mixed 55% into ground): tile fill.
- **Field surface** `{colors.field-surface}`: input fill, slightly below ground.
- **Rule** `{colors.rule}`: ordinary hairline and chart gridline.
  **Rule strong** `{colors.rule-strong}`: control borders, dashed empties, the
  lifted option in a switch.
- **Ink 1** `{colors.ink-1}` primary text and values; **Ink 2** `{colors.ink-2}`
  supporting text and labels; **Ink 3** `{colors.ink-3}` metadata and
  placeholders. Ink 3 on ground passes AA (4.5:1); never go dimmer for text.

### Trace

`{colors.trace}` is the only accent. It marks the one primary action, the active
nav item, the focus ring, the "today" or "now" marker, the planned state, and the
fitness line. Hover is `{colors.trace-hover}`; button text on trace is
`{colors.trace-ink}`. `--brand` and `--brand-tint` (trace at 14%) are the
semantic aliases consumed by shared classes; preserve them. `--band` (trace at
17%) draws the "usual range" band in charts.

### Signal colors

- **Green** `{colors.success}`: better than usual, on plan, completed, saved.
- **Amber** `{colors.warning}`: worse than usual, needs attention, adjusted plan.
- **Danger** `{colors.danger}`: destructive actions and destructive feedback only.
- **Missed** `{colors.missed}`: missed work, kept distinct from danger.
- Each has a 13% tint and 40% border derived with `color-mix`
  (`--status-*-tint`, `--status-*-border`).
- **Compliance:** good `{colors.compliance-good}`, partial
  `{colors.compliance-partial}`, off `{colors.compliance-off}`.

**The Signal Rule.** Amber means worse than usual or needs attention; green means
better or on plan. Neutral metrics (volume, counts, durations with no target)
show no signal color at all. Never color a number just to decorate it.

### Training load

Fitness (CTL) `{colors.metric-fitness}` is the trace, fatigue (ATL)
`{colors.metric-fatigue}`, and form (TSB) `{colors.metric-form}`. These three are
reserved for load charts and their legends.

### Intensity zones

`{colors.zone-1}` through `{colors.zone-5}` run cool to hot, mirrored in
`lib/tempo-blocks.ts` (tints are the same hue at 16% alpha). Used by
`SessionBlockBar`, block details, and the `.ink-zone-N` classes. Zone color
always travels with a "Z1" to "Z5" label or accessible text.

## Typography

**Font:** Instrument Sans, loaded in `app/layout.tsx` as `--font-body`, with
`ui-sans-serif`, `system-ui` fallback. One family throughout.

- **Page heading:** `pageHeadingClassName`; 28px, 30px from `sm`, weight 500,
  `-0.02em`, balanced wrap.
- **Section heading:** `sectionHeadingClassName`; 16px, weight 500.
- **Body:** 14px, relaxed line height. Muted text is never used for essential
  instructions.
- **Labels:** 12 to 13px, weight 500, sentence case. No uppercase tracking labels,
  eyebrows, or section numbers. `eyebrowClassName` is a small sentence-case line.
- **Numbers:** apply `.data` (or `MetricText`, `.metric-text`), which sets
  `tabular-nums`. Required for durations, TSS, RPE, dates, counts, and chart axes.

**The Reading Rule.** A value is label, then a large tabular figure, then a quiet
unit at `0.5em` in ink 3, then optional detail. Do not restyle each route's
metrics as a new object; use `StatTile`.

## Layout

`PageShell` centers one `1440px` wall with `20px` inline padding, `28px` from
`sm`, and `40px` from `lg`. Content is left-aligned inside it: `narrow`
`max-w-3xl`, `default` `max-w-5xl`, `wide` `1140px`, `wall` full width. `TopBar`
reserves a `64px` header band. Rhythm between page groups is `24px`. Content
columns keep `min-width: 0`. Weeks always start on Monday.

### Shell

- **Desktop (from `md`, 768px):** fixed sidebar, `14rem` wide, collapsible to a
  `3.75rem` icon rail. Width is the `--sidebar` variable; `.with-sidebar` pads the
  content to match, animating 200ms with `--ease-out-expo`.
- **Rail state:** persisted in `localStorage` under `tempo:sidebar`
  (`lib/sidebar-state.ts`) and applied before paint as
  `html[data-sidebar='rail']` so there is no layout jump. Style rail-dependent
  parts with the `rail:` Tailwind variant (`@custom-variant` in `globals.css`,
  desktop only), for example `rail:hidden` on labels and `rail:justify-center`
  on items. In rail mode icons keep accessible names and titles.
- **Mobile (below `md`):** sticky top bar with brand mark and a menu button
  (44px), opening a drawer with overlay, Escape-to-close, focus return to the
  menu button, and body scroll lock. A fixed bottom nav shows five icon items
  with labels and a safe-area inset.
- **Landmarks:** a "Skip to content" link first in tab order, and
  `<main id="main">`.
- `BrandMark` is the Tempo mark: a pace line in a 28px outlined square, trace
  colored. Do not add route-local primary navigation or a second shell.

## Elevation & Depth

Depth is tonal, not shadowed. Tiles are surface plus a one-pixel rule. Interactive
tiles lift to raised plus rule-strong with `--shadow-raised` on hover.
`--shadow-overlay` is for menus, dialogs, and drawers. `--shadow-inset` is a faint
top highlight only. Do not add a shadow to make a repeated row feel important.

## Shapes

- **Tiles and surfaces:** `rounded-2xl` via `.tile`.
- **Controls and fields:** `rounded-lg`. Standard is 40px tall; compact is 32px
  tall for dense toolbars and menus with surrounding room.
- **Switch options and compact segments:** `rounded-md`.
- **Chips, badges, avatars, icon step buttons:** full pill or circle.
- Borders are one-pixel rules, not ornament. Avoid mixing unrelated radii within
  one control group.

## Components

### Buttons

Use the exports in `components/ui.tsx`; do not restyle buttons in a route.

- **Primary:** trace fill, `{colors.trace-ink}` text, 40px. Exactly one forward
  action per task.
- **Secondary:** transparent, rule-strong border, ink 1 text; raised on hover.
- **Danger:** danger tint, border, and text. Confirm actions that discard work.
- **Ghost:** trace text, tint on hover, standard or compact.
- **Compact:** 32px, 13px label, for dense lists and command strips. Do not use
  compact buttons beside 40px fields in a form; use the standard tone so the row
  reads as one instrument.
- **Icon step button:** `iconButtonClassName`, a round 40px outlined button for
  period navigation (previous/next week or month). Needs an `aria-label`.
- **Segmented choice:** `getSegmentedChoiceClassName` for form-like selection;
  selected uses trace tint and border.
- **Segmented switch:** `switchTrackClassName` (raised track, `p-0.5`, `gap-0.5`)
  with `getSwitchOptionClassName(selected)`: the active option is lifted on
  rule-strong with ink 1 text; inactive is ink 3. Use for view and range
  switching, not for form values.
- **Focus and disabled:** every button shows a visible trace ring with offset
  from the ground; disabled stays legible at reduced opacity.

### Tiles

- **`Surface`:** `.tile rounded-2xl p-5` for grouped content.
- **`StatTile`:** the square of reading, `min-h 7.5rem`, label at the top, value
  pinned low, optional detail. Detail `tone` is `good` (green), `watch` (amber),
  or `neutral` (ink 3); neutral is the default and carries no signal.
- **Interactive tiles** (`a.tile`, `button.tile`, `.tile--interactive`) raise on
  hover and need a visible focus state.
- **`EmptyState`:** a dashed `.tile-empty` with a short title, one line of
  explanation, and a recovery action when one exists. Place it where the content
  would have been.
- **`Badge`:** pill, 24px minimum, tone neutral, brand, success, or warning, with
  text always present.
- **`SessionRow`:** the shared workout unit across Home, Calendar, Workouts, and
  week surfaces (`default`, `compact`, `month`). The whole row is the link; a thin
  trace line grows on its left edge on hover and focus.

### Fields

`formFieldClassName`, `formSelectClassName`, `formTextareaClassName`: 40px,
`rounded-lg`, field surface, rule-strong border, 14px text, trace border and
40% trace ring on focus. Labels are explicit (`formLabelClassName`, 13px, ink 2);
placeholders are never the only label. Mobile forms keep save and destructive
actions reachable.

### Navigation

`AppShell`, `AppSidebar`, and `AppProfileMenu` own authenticated navigation.
Items are `rounded-lg`, 36px on desktop and 44px on mobile, ink 2 at rest, raised
fill and ink 1 when active, with a trace icon or marker for the current page. The
profile menu sits at the sidebar foot and collapses to an avatar in the rail.
Page headers do not repeat sibling destinations.

### Back navigation

- **Top-level destinations have no back control.** These are the main nav items,
  Profile, Settings, the coach roster, planner and workouts, and the Tempo Ride
  home (`/athlete/ride`).
- **Every page below them has exactly one**, the shared `BackLink`
  (`components/ui.tsx`), passed as `TopBar`'s `back`. It sits top-left of the
  header, above the title: a 16px arrow and the destination name ("Calendar"),
  with "Back to Calendar" as its accessible name. It is 40px tall, 44px on
  mobile, and uses the shared focus ring.
- **The destination is deterministic.** `resolveBackTarget` in
  `lib/app-navigation.ts` maps (route, `from`) to `{ href, label, destination }`.
  It uses the `from=` origin when the route's allowlist accepts it, otherwise
  the route's parent. Origins are allowlisted keys, never URLs. Links into a
  detail page add `from=` with `withBackOrigin`. Never rely on `router.back()`:
  deep links, new tabs and Tempo Ride have no useful history.
- **Chrome-less screens** (the ride page) use `BackLink variant="compact"`, the
  icon-only form with the same target and accessible name.
- **In-page views** that replace a list, such as the workout editor, use
  `BackButton` with the same look and the list's name.
- A page's own links ("View session", "Start live") and in-flow step controls
  ("Back to preview") are not back controls. Error and not-found pages offer a
  recovery action, not a `BackLink`.

### Starting a workout

Every runnable workout shows one **Start workout** button that opens the shared
chooser (`components/WorkoutStartChooser.tsx`; options from `lib/workout-start.ts`).
The chooser lists only the modes this workout and device support, with one
sentence each, and asks every time. Never add a direct Live, Ride or desktop
link beside it; completed, skipped and stepless sessions show no start.

### Primary and secondary actions

Each screen keeps its one or two primary actions visible. Secondary and
advanced actions go in a named place: the row or page ⋯ menu, **Advanced
options**, **Connections**, **Filters** or **More details**. Move, don't
remove: every feature stays reachable.

### Charts and data

Charts are hand-written SVG, not a charting library.

- Lines are 2px with `vector-effect: non-scaling-stroke`; gridlines use `--rule`;
  the usual range is a `--band` fill; fitness, fatigue, and form use the
  metric tokens.
- On first render the plot sweeps in with `.chart-reveal` (500ms,
  `--ease-out-expo`).
- Points are keyboard focusable, show a visible focus state, and expose their
  value as text. Every chart has a text title and a summary or legend; color is
  never the only identifier of a series.
- Axis and value numerals use `.data`.

### Workout language

`SessionBlockBar` uses duration-proportional segments; height and color map to
Zone 1 to Zone 5, with an accessible label carrying the same information in text.
When no segments exist, omit the bar instead of rendering an empty image.
`StatusBadge` shows planned, adjusted, or missed as text. Completed work does not
need a repeated completed badge. `WorkoutBuilder` is the canonical authoring
surface (palette, canvas, inspector); drag reordering must always have keyboard
and explicit earlier/later alternatives.

### Loading and empty

Loading uses `.skeleton`, a raised block with a slow opacity "breathe" (1.6s),
shaped like the content it replaces. No spinners over content that has a known
shape. Empty is `.tile-empty` (above).

## Motion

- Hover, focus, and state changes: 150 to 200ms, `ease-out`.
- Reveals and layout moves (sidebar width, chart sweep): `--ease-out-expo`,
  200 to 500ms.
- Buttons press to `scale(0.98)`. Nothing loops except the skeleton.
- Everything honors `prefers-reduced-motion`: durations collapse to near zero
  globally, and state is still conveyed by color, text, or position.

## Copy

Terse, sentence case, and specific. Say what the thing is, then what to do. No
exclamation marks, filler, emoji, or decorative glyphs; use the icon set
(`lucide-react`, 1.5 to 1.6 stroke).

## Accessibility

- Focus: `:focus-visible` is a 2px trace outline with 2px offset; buttons use a
  2px trace ring with ground offset. Never remove it.
- Targets: 40px for ordinary controls, 44px for touch on mobile (menu button,
  nav rows, bottom nav items at 48px). 32px compact controls only where the
  surrounding context gives room.
- Labels: every control has a visible or accessible name; icon-only controls
  need `aria-label`.
- State is text, shape, or position plus color, never color alone.
- Contrast: ink 1, 2, and 3 on ground all pass AA; signal colors are tuned for
  the dark ground and pass for text.
- Keyboard: drawer traps focus and returns it; drag and drop is never the only
  path.

## Do's and Don'ts

### Do:

- **Do** read `DESIGN.md`, then `app/globals.css` and the shared owner, before
  adding tokens or primitives.
- **Do** reuse `PageShell`, `TopBar`, `Surface`, `StatTile`, `Badge`,
  `EmptyState`, `SessionRow`, `SessionBlockBar`, `MetricText`, and the shared
  button, switch, and field classes.
- **Do** use semantic CSS variables instead of inline colors or shadows.
- **Do** keep the current week, session state, and next action in one context.
- **Do** reserve trace for one thing per view that is active or primary.

### Don't:

- **Don't** reintroduce a light theme, paper textures, indigo ink, or uppercase
  tracked labels.
- **Don't** copy the look of `/design/*` previews into production.
- **Don't** turn every region into a floating card; prefer rules and spacing.
- **Don't** color neutral metrics, or use green and amber without meaning.
- **Don't** add gradients, decorative shadows, oversized hero metrics, charting
  libraries, or extra accent roles.
- **Don't** use color alone for planned, completed, adjusted, missed, loading,
  error, or success states.

## Interaction Feedback

Before an action, show its target and consequence. During it, distinguish
selection, dragging, and pending persistence. Afterward, make the result easy to
locate. Drags indicate the insertion point and resolve visibly; reduced motion
keeps a clear static cue. Local drafts are never presented as saved. Show
operation-specific pending, success, and failure text at the affected block,
session, or date; preserve drafts on failure, offer recovery, and confirm server
persistence before claiming a save.

### Mobile action clearance

`--mobile-nav-clearance` reserves the bottom navigation and device safe area.
Mobile sticky editor actions sit above that clearance. The shell reserves one
additional rem of content padding, so the final field remains reachable.
Desktop sticky actions use the viewport bottom.

## Feature contracts (carried from main)

### Personal Calendar scheduling

`TrainingCalendar` owns the personal browsing and placement composition.
Opening Add session from a day seeds its date and focuses the inline composer
heading while retaining the date grid. Reuse shared buttons, segmented choices,
fields, and `SessionRow`; the composer uses the existing field surface and
rounded panel language. Workouts and Templates have searchable saved-source
lists, explicit pressed selection, source metadata, and contextual creation
links for empty results. Only the source results scroll independently, capped
at 280px; date review and Schedule remain outside that scroll area.

Workout dates toggle through calendar buttons and can also be added through an
explicit date field or removed through labelled date chips. Template selection
uses one reference date: show its full Monday-first week or calendar-month
range in both the calendar selection and a dated range summary before Schedule.
The selected-day agenda follows the reference date, while the range identifies
the entire placement. Explain that scheduled sessions are independent copies
and saved content remains reusable. Keep Schedule disabled until a source and
valid dates are selected.

Escape or the explicit close control dismisses the composer and returns focus
to the page Add session action. During persistence, show Scheduling and disable
conflicting controls; confirm success only after the server response. Failure
retains the source and dates for retry with visible feedback. Unfinished
scheduled sessions expose a separate labelled removal action with confirmation;
completed sessions remain review links without that removal action. Reserve
space within session rows for the removal target, increasing it to 44px on
phones. Date selection, source selection, scheduling, and removal all have
explicit keyboard and touch controls.

### Editing

`WorkoutBuilder` is the canonical structured authoring surface. Reuse its
three-part palette, canvas, and inspector model for new workout editing. Drag
reordering is supported, but keyboard and explicit earlier/later controls must
remain available. Do not make drag-and-drop the only way to edit block order.
New workout creation is progressive: name and sport are confirmed before the
library, sequence, and inspector appear. Presets expose a visible Add action as
well as drag behavior, the sequence exposes its drop target, and selecting a
block reveals direct intensity and duration controls, an action to edit its
target range in a focused dialog, and adjacent recovery controls. Repeats are
created from the selected chart pattern rather than a per-block repetition
field. Every `SessionBlockBar` maps continuous intensity to segment height and time to width,
including the full-size authoring timeline. The basics step uses a
centered reading-width panel and presents Continue as its only forward action;
save controls appear with the detailed authoring workspace.
After details are unlocked, Edit basics changes the existing summary row into
inline name and sport fields without hiding or resetting the authoring workspace.
The chart remains the primary authoring surface. Block details follow the chart
when the available content width cannot support a readable side inspector;
selection, selected-block actions, and history controls share a compact toolbar
beside the Workout chart title where space allows. History starts the toolbar
as quiet icon buttons, followed by a 40px square selected-count badge and the
selection control. Block actions use a soft group surface; at narrow widths the
groups wrap without divider lines. Selected-block actions and pattern
repeats appear only when blocks are selected. The workout
library shows unsaved status in its Create/Edit workout header, not inside the
chart.
Block type and effort are separate fields. Skipped blocks remain identifiable in
existing sessions and do not count toward active workout time. New reusable
workouts require an active block before saving.

Profile uses the shared field controls for heart-rate maximum, race result, and
per-zone running paces. Show the calculated Olympiatoppen heart-rate BPM bands
beside HRmax, and make race-derived pace defaults directly editable as fastest
and slowest `m:ss /km` values. Keep its save action and explicit saved,
unsaved, pending, and error feedback in a viewport-pinned footer above mobile
navigation, with content space reserved below the form. Workout blocks show
the selected zone's resolved target and keep other target systems out of that
block's readout.

## Feature feedback contracts

In the workout editor, chart bar height follows the block's numeric target within its zone. Adjacent values within one zone should be distinguishable; a pause remains a short visible mark above the baseline. Keep session-wide target configuration beside the sport selector and individual adjustments immediately below the block's zone selector. Resolve profile pace bounds and HRmax percentages for the current user, and expose only the current block's relevant pace or heart-rate target in its inspector and spoken chart label.

Functional repairs must preserve or improve usability. Prefer simpler flows and
visual feedback at the affected block, session, or calendar date. Keep the
existing visual identity, explicit labels, keyboard controls, and touch
alternatives; drag-and-drop must never be the sole way to perform an action.

Before an action, show its target and consequence. During an action, distinguish
selection, dragging, and pending persistence. Afterward, make the resulting
placement or change easy to locate. A drag should indicate the insertion point
and visibly resolve into the resulting item; reduced-motion mode must retain a
clear static cue. Local draft changes must not be presented as saved data.

Show operation-specific pending, success, and failure feedback. Preserve drafts
and useful context on failure, provide a clear recovery action, and confirm
server persistence before claiming a save. Pair visual cues with meaningful
text or accessible announcements; do not rely on color, motion, or distant
banners alone. Reuse shared semantic tokens and component owners.

Recovery offers explicit Restore and Discard actions with timestamps and
browser-only wording. Present stale workout edits as new copies rather than
silently overwriting the saved source. Live restores paused; counting elapsed
time is a separate explicit choice, and Finish remains the persistence action.
The Profile Account section stays outside its training form and save bar's
meaning: session controls, sign-in capability, connection access and downloads
are independently actionable. Export omissions must be visible before download.

### Compact feedback

Shell feedback uses a content-sized frame capped at 480px, centered within the
available content column. Use 12px inline / 8px block padding, a 12px gap,
and an icon-only dismiss control with a 44px mobile target. Feedback clears
bottom navigation and Profile save actions; sync errors do not overlap notices.

### Home training setup

Show incomplete training targets in a compact link directly below Today. Name
the missing target and open its Profile row. Profile keeps units explicit and
shows calculated previews and advanced targets with the fields they affect.
The link disappears when maximum heart rate and the selected sports’ targets
are saved. Unknown values may remain blank.

### Personal training templates

Use the established Night Instrument surfaces and shared controls. Personal Templates
is a routine composer, using existing library workouts rather than the block
editor. Keep name and optional purpose together, followed by one saved-workout
picker with multi-weekday selection and an ordered Monday–Sunday outline.
Days without entries say No workout. Multiple entries expose accessible reorder
and remove controls; at narrow widths their actions wrap below the workout
selector. Show save failures beside Save and retain the draft. Cancelling or
leaving the browser requires an unsaved-change safeguard.

The library previews only the weekdays that have workouts, with the session count.
The title opens the editor, Duplicate and Delete live in the card's ⋯ menu, and
the visible Apply to Calendar carries the chosen template into scheduling. Routine application
offers One week or Whole month, an explicit full date range and the actual dated
workout list/count before saving. Explain that existing sessions remain, empty
days add nothing, relative targets use Profile and fixed targets remain fixed.
Templates have one routine model. Do not expose cadence controls, workout block
authoring, single-workout template loading or public Save as Template intake.
