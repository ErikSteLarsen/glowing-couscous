---
name: Wattonaut
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

# Design System: Wattonaut

## Overview

**Creative North Star: "Night Instrument"**

Wattonaut is an operational training surface organized around the Monday-to-Sunday
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
`SessionBlockBar`, `WorkoutProfile`, block details, and the `.ink-zone-N` classes. Zone color
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

Use `StatTile` for a standalone metric with a large tabular value, a quiet unit,
and optional detail. Use `MetricPair` from `components/wattonaut/` inside a `dl` for
compact summaries. Stack the label above the value by default, or use `inline`
for totals that read across. Use `MetricText` for a number within ordinary text.

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
- `BrandMark` is the Wattonaut mark: a 28px planet whose ridge forms a W
  and rises to the right, in its own two blues per theme. `BrandName` beside it is
  the lowercase logo lettering ("watt" 600, "onaut" 500); running text says
  Wattonaut. Both come from `brand/kit`. Do not add route-local primary navigation or a second shell.

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

- **`Surface`:** the bordered, padded container for grouped content. Give a
  named section an `aria-labelledby` that points to its visible heading, styled
  with `sectionHeadingClassName`.
- **`StatTile`:** the square of reading, `min-h 7.5rem`, label at the top, value
  pinned low, optional detail. Detail `tone` is `good` (green), `watch` (amber),
  or `neutral` (ink 3); neutral is the default and carries no signal.
- **Interactive tiles** (`a.tile`, `button.tile`, `.tile--interactive`) raise on
  hover and need a visible focus state.
- **`EmptyState`:** a dashed placeholder with a short title, optional
  explanation, and a recovery action when one exists. Place it where the content
  would have been.
- **Notices:** use `noticeBoxClassNames` for bordered information, warnings,
  and errors. Use `successTextClassName` and `dangerTextClassName` for inline
  feedback. Retain the announcement role that matches the interaction.
- **`Badge`:** pill, 24px minimum, tone neutral, brand, success, or warning, with
  text always present.
- **`WorkoutCard`** (`components/library/WorkoutCard.tsx`): the card for both
  Workouts tabs, Wattonaut Ride and Activity. Its title is the one link or button and
  covers the card; a mini profile, a meta line, an optional summary and a footer
  of metrics with tab-specific actions follow. It raises on hover and takes a
  trace border on keyboard focus. Grids are 1 column on phones, then 2–4.
- **`SessionRow`:** Home uses the compact row for completed and skipped
  sessions and the month variant in its week strip. The whole row is a link
  with a trace on hover and focus.
- **`SessionRowText`:** use the shared title and metadata stack for Calendar
  session cards and for activity rows in Import, Events, and Ride. The parent
  owns navigation, disclosure, or drag behavior.

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
  Profile, Settings, the coach roster, planner and workouts, and the Wattonaut Ride
  home (`/athlete/ride`).
- **Every page below them has exactly one**, the shared `BackLink`
  (`components/ui.tsx`), passed as `TopBar`'s `back`. It sits on its own row
  above the title, pinned to the content area's left edge next to the sidebar
  (the `.page-back` wrapper in `app/globals.css`), not to the centered column, so
  it is in the same place on every page: a 16px arrow and the destination name ("Calendar"),
  with "Back to Calendar" as its accessible name. It is 40px tall, 44px on
  mobile, and uses the shared focus ring.
- **The destination is deterministic.** `resolveBackTarget` in
  `lib/app-navigation.ts` maps (route, `from`) to `{ href, label, destination }`.
  It uses the `from=` origin when the route's allowlist accepts it, otherwise
  the route's parent. Origins are allowlisted keys, never URLs. Links into a
  detail page add `from=` with `withBackOrigin`. Never rely on `router.back()`:
  deep links, new tabs and Wattonaut Ride have no useful history.
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
The chooser lists only the modes this workout and device support and asks every
time. Each option is a row with an icon, its name and a few words; the full
explanations sit behind **Which one should I pick?** (**How it works** for a
single option). When a bike workout has more than one option, the best one for
this device stands alone as **Recommended**, with the reason in place of its
hint, above **Other ways to start**: riding in this browser when it has
Bluetooth, otherwise the desktop app on a computer, otherwise the Block timer.
Never add a direct Live, Ride or desktop link beside it; completed, skipped and
stepless sessions show no start. Runs offer the Block timer only (the Live
screen; formerly Follow along). Swims can't be started: Schedule becomes the primary action on their detail
pages with one line saying so, Mark as done is primary on the planned workout, and
`/athlete/live/<id>` explains this with a link back to the workout.

### Block timer

`/athlete/live/<id>` is full-bleed like the Ride screen: a slim header (back,
title, Beeps toggle, ⋯ with spoken cues and Restart workout), the current block
card, a Done/Left tile with the workout strip, and a fixed bottom bar with
**Previous**, the round main button (**Start**, **Pause**, **Resume**, **Mark as
done**) and **Next block**. One Start runs the whole workout: a timed block
moves straight into the next, catching up time spent with the screen off. Open
blocks show **No set time** and wait for Next block. Soft beeps count the last
three seconds and mark each new block; beeps and spoken cues are both off by
default, and nothing vibrates. A block without its own target shows its zone's
Olympiatoppen heart-rate range from the maximum heart rate ("I-4 – 166–175
bpm"); Olympiatoppen HRmax targets use the same I-level label. The screen stays awake while it
runs. The countdown, spacing and bar scale with screen height so the block,
target, clock, next block and controls fit on short phones.

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
When no segments exist, omit the bar instead of rendering an empty image. It is
the compact bar for cards and rows only.

Every full-size workout structure uses `WorkoutProfile`
(`components/WorkoutProfile.tsx`, model in `lib/workout-profile.ts`): session
detail, library detail, Live, the comparison dialog and the builder.
It is one gap-free profile over time; height is %FTP when every effort has a
power target, otherwise an even Z1–Z5 scale. Color follows the continuous zone
ramp in both cases. Repeats are always unrolled so every repetition is drawn in
time; a light bracket over the repeated span names the set ("2 × 18m zone 4 + 3m
recovery", shortened to "2 × 21m" or "2×" when narrow). Never label a single
drawn instance "× 2". A phase row under the profile names each stretch
(Warm-up, Main set or Set N, the zone name for single efforts, Cool-down) with
duration and zone, positioned by time; labels that do not fit drop their detail,
then their text, and keep a tick and tooltip. Selectable profiles have one tab
stop with arrow-key movement and show the selected step's target and note.
The builder uses the full profile (with `chartHeight="short"`) as its editing
canvas. Live outlines the current step instead of offering selection.
`StatusBadge` shows planned, adjusted, or missed as text. Completed work does not
need a repeated completed badge. `WorkoutBuilder` is the canonical authoring
surface (profile, step list, step editor); drag reordering must always have
keyboard and explicit earlier/later alternatives.

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

### Voice and terms

Wattonaut talks to self-coached endurance athletes. They know sport terms; they do
not know software terms. Write short, plain, friendly sentences in the active
voice and second person ("you"). One idea per sentence. Buttons are concrete
verbs ("Save workout", "Mark as done", "Restore", "Discard"). Errors say what
happened and what to do next ("Could not save this workout. Try again.");
connection failures say "Could not reach Wattonaut. Check your connection and try
again." Applies to every user-facing string, including service errors the UI
shows, aria labels and confirmation dialogs.

Keep sport terms: FTP, zones (Z1–Z5), intervals, warm-up, cool-down, TSS,
training load, RPE, compliance, pace, heart rate, cadence, ERG, free ride,
fitness, fatigue, form, ramp rate, CSS, Olympiatoppen.

One term per concept. Workout parts follow TrainingPeaks and Zwift (blocks) and
Garmin Connect (Repeat), which matches the stored `blocks` model. "Interval" is
only a sport term for hard efforts or a workout type ("Threshold intervals"),
never the name of a part of a workout.

| Concept | Say | Don't say |
| --- | --- | --- |
| A single workout made up of blocks, saved or in the library | **workout** | session, source, entity |
| A workout put on a date | **planned workout** (or just workout) | session, scheduled copy, assignment |
| Your saved workouts / ready-made ones | **My workouts** / **Public library** | your library, catalog |
| One part of a workout; a repeated group of blocks | **block**; **repeat** ("Repeat 4×", "Add repeat") | step, set, segment, interval (block kinds stay **effort**, **recovery**, **warm-up**, **cool-down**) |
| Training you did and Wattonaut recorded | **activity** | completed session, outcome, record |
| What you did vs. what was planned | **result** vs. **plan** | actual, baseline, snapshot |
| Finishing a planned workout | **Mark as done**, status **done** | complete, log completion |
| Undo done / undo skip | **Mark as not done** / **Plan again** | mark planned again |
| Not done by its date / chosen not to do | **missed** / **skipped** | — |
| Weekly schedule of saved workouts | **training plan** (page **Training plans**) | template, routine |
| Pages | **Home, Calendar, Workouts, Training plans, Activity, Events, Import, Profile, Settings** (capitalized when naming the page) | planner (athlete side) |
| Training targets on Profile | **training targets** | training metrics |
| Changes not yet saved | **unsaved changes**, "only on this device" | draft, kept on this browser, local recovery, persist |
| A link anyone can open | **share link** | public link, URL, snapshot |
| Activity data from a device | **recorded data** | measurements, samples, streams, telemetry |
| TSS that can't be calculated | **No TSS** | load unavailable |
| Strava check for new activities | **Check Strava** | sync |
| The run analysis | **workout analysis**, **Analyze workout** | interpretation |
| Bike ride without trainer or sensors | **without devices** | targets only |

Never show HTTP codes, field names, IDs, "invalid", "payload", "provider",
"fingerprint", "transaction" or "request key". When a request is malformed or a
key clashes, say "Something went wrong. Reload the page and try again."

**Separators.** Never use the middle dot (·). Between items in a run of stats or
metadata, use a spaced en dash: "48 min – 27.1 km – TSS 69". Prefer something
better where it reads better: a gap between separate UI elements, a comma or
words when the run is really a phrase ("Mon 2 Nov, 08:15"), a line break when
the items are distinct facts. A range keeps an unspaced en dash ("80–95 rpm",
"Z1–Z5"), and a minus sign is "−", so a spaced dash always means a separator.
Put a non-breaking space before the separator dash when it must not start a line.

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

### Ride entertainment

- One header menu, **Entertainment** (popcorn icon), on the active ride only: **Data only**, **YouTube**, **Ride a course**. While a view is on, the button names it and a × beside it goes straight back to the data screen. V toggles the last view, and opens the menu when there is none. The stage has no header of its own. The open menu must end above the YouTube player. The choice is remembered per browser.
- Leaving a video that plays (or that Wattonaut paused), or a course ridden 50 m or more since it opened, asks first: **Leave the video?** / **Leave the course?**, with **Keep watching** / **Keep riding it** focused and a button naming the result (**Back to data only**, **Switch to YouTube**, **Switch to the course**, **Play the video**). Nothing else asks. In the Wattonaut Ride app any open video asks, since its state is unknown.
- Desktop keeps the block row, a compact profile chart and the shortcut legend. With YouTube, the player takes all the room left: full window width, narrow rails (power left, heart rate and cadence right), and no shortcut legend below 820 px of height. With a course, the stage is full width and the stats sit over the scene at its edges, never over the rider.
- Phone (under 640 px): no YouTube; the screen is too small for a player beside the stats. the header button (**Ride a course**) turns the course on and off, with no menu (also when YouTube was the remembered view). The stage replaces the profile chart and the block and workout averages, below the live power, heart rate and cadence. The course overlay shows only speed, distance, gradient and the loop profile.
- YouTube is not browsed inside Wattonaut. The rider uses YouTube itself, signed in with their own recommendations, and brings one video to the ride. The empty view is a calm panel: **Pick a video on YouTube**, an **Open YouTube** button (a named browser window of its own beside the ride, so the ride tab stays visible: "YouTube opens in its own window next to your ride…"; in the Wattonaut Ride app, the system browser), then three short rows: the **Send to Wattonaut** bookmark ("Drag this to your bookmarks bar. On any YouTube video, click it."), dragging a video's thumbnail or title onto the panel (outlined with **Drop to play** while dragging), and pasting a link (Ctrl/Cmd+V anywhere on the ride screen outside a text field and while no dialog is open, or the **Paste a YouTube link** field). A link dropped anywhere else on the ride screen never navigates away. In the Wattonaut Ride app the bookmark row has **Get the bookmark**, which opens the bookmark page (`/athlete/ride/send` without a link) in the system browser. App versions that block the player (0.2.2 and earlier) show "This version of Wattonaut Ride can't play videos. Update the app…" and offer **Open on YouTube** only. **Recently played** (per account, 30-day expiry, **Clear**) sits below as thumbnails.
- The bookmark opens a small Wattonaut window and then pauses the YouTube video (it doesn't pause when the browser blocks the window, and says "Allow pop-ups for YouTube to send videos to Wattonaut."). It sends the player's position, 0 included, and none for a live stream. The window hands the video to one open ride in the same browser (the first ride tab to answer) and closes itself: "Sent to your ride – you can close this window". Without a running ride: "No ride is open in this browser.", with **Send to the Wattonaut Ride app** (opens `tempo-ride://video`), **Send again** and **Close**. Signed-out setup returns after sign-in too. The bookmark carries a key private to this browser; a send window opened any other way shows the link with **Send to ride** and **Close** and sends only on that click. Signed out, the window returns to itself after sign-in. A video brought in while entertainment is off or on the course switches to YouTube (asking first when the course is under way).
- First video only (per account and browser): a small block above the picker, "Videos play through YouTube. By continuing, you agree to…", with **Agree and play** and **Not now**; nothing is looked up or embedded before that. The picker ends with one quiet line: YouTube's logo (linked, 24 px, never recoloured), **YouTube Terms of Service** and **YouTube privacy notice**, which unfolds in place. Nothing is shown outside the YouTube view.
- Watching: a slim bar (**← Change video**, title – channel, **Pause with ride**) above the player. A player that hasn't answered within 15 s gives way to **Open on YouTube**, **Try again** and **Change video**. Nothing is drawn over the player; while a link is dragged in, the player gets an outline around it, not over it. The player is never smaller than 200 × 200 px (letterboxed when 16:9 would be shorter); without room for that it offers **Open on YouTube**. YouTube's own full screen is off, so the ride's full screen (F) keeps the stats in view. Every video is checked first; videos made for kids, and any video Wattonaut can't check (no `YOUTUBE_API_KEY`, failed check), show as a card with **Open on YouTube** instead. The player starts only after the rider brings a video and only while the ride runs (or **Pause with ride** is off), the tab is visible, the player is at least half on screen and no dialog covers it. A dialog over the stage pauses and hides the player; closing it resumes only what Wattonaut paused. The view keeps its video and time when it remounts, and checks the video again before its player comes back. In the Wattonaut Ride app the rider uses YouTube's own controls: no **Pause with ride**, automatic start, pausing or kept time.
- Course: speed comes from power and gradient (constant ERG watts slow the rider on climbs). While the ride is paused the course stands still and the rider sits up. Reduced motion draws one still frame a second.
- Workout profile blocks name their length and effort at the bottom when it fits: "5m – 300 W" on one line, else on two, else "300 W", else "300", else nothing. A ramp is "150–250 W", a block without watts its zone, a pause only its length. Blocks still to ride follow the intensity change; the current one is bold. Recorded lines stop where time was skipped. Charts under 160 px drop the legend.
- The desktop data screen has three columns, separated by rules. **Now**: power with target and meter, then heart rate, cadence and % of FTP. **This block** (**Free ride** after the plan): time left of its length, progress, average power and heart rate, Next, and block navigation. **Workout**: time left of its length (elapsed after the plan), progress, average power and heart rate, Elapsed, **More data**. More data adds each advanced value to its own column: average cadence to the block; average cadence, Normalized, TSS, Work and Max power to the workout. Below 1024 px Now spans both columns. The profile takes the height left; from 1024 × 720 nothing scrolls with default data, and the shortcut legend hides below 820 px of height.
- With entertainment on, the block row holds **Elapsed**, **Workout left** and **Block left**, each labelled under its number. Phones keep the block clock top right with Elapsed and Workout left on one line under the block progress.
- A failure inside a view stays in the stage (**Try again**, **Turn off**); the ride keeps recording.

## Feature contracts (carried from main)

### Personal Calendar scheduling

`TrainingCalendar` owns the personal browsing and placement composition.
Opening Add session from a day seeds its date and focuses the inline composer
heading while retaining the date grid. Reuse shared buttons, segmented choices,
fields, and `SessionRow`; the composer uses the existing field surface and
rounded panel language. Workouts and Training plans have searchable saved
lists, explicit pressed selection, workout or training plan details, and contextual creation
links for empty results. Only the source results scroll independently, capped
at 280px; date review and Schedule remain outside that scroll area.

Workout dates toggle through calendar buttons and can also be added through an
explicit date field or removed through labelled date chips. Training plan selection
uses one reference date: show its full Monday-first week or calendar-month
range in both the calendar selection and a dated range summary before Schedule.
The selected-day agenda follows the reference date, while the range identifies
the entire placement. Explain that each planned workout is its own copy
and the saved workout stays as it is. Keep Schedule disabled until a source and
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

### Athlete Workouts

Keep **My workouts** and **Public library** visible together as a keyboard
operable tablist with counts and 44px minimum touch targets. Describe the
active collection in one line. Default to **My workouts** when the athlete
has saved workouts and **Public library** otherwise. The URL carries the
explicit tab and any catalog filters. The mobile navigation drawer links to
Training plans.

Public library shows one sport at a time. Its results heading ("Bike workouts" and
the count) states the sport and opens the menu that changes it; add no other sport
control. Bike is the default and stays out of the URL. Changing sport keeps search
and sort and clears the filters. Counts, the tab badge and "N of M" are for the
chosen sport. Detail pages put the sport badge first. Run and swim workouts show
zones, never FTP, IF, normalized power or watts; swim sets show distance, with their
times marked "est.". **Used in plans** under the block list links to Training plans.

Keep **New workout** on **My workouts**. Its menu includes **Start from
public library**. Catalog cards open a read-only detail page and offer
**Customize** and **Schedule** in their More options menu. On the detail
page, keep **Start workout** and **Schedule** visible and **Customize** in
More options. Catalog detail links opened from Workouts return to its
Public library tab on the workout's sport.

Hide the header and tabs while the editor is open. **Customize** prefills an
unsaved copy of the catalog workout. Name the original and explain that
Save adds your version to My workouts and the original stays as it is.
Workouts are one concept. Both tabs share the `WorkoutCard` grid (the same
%FTP or zone profile, meta line, TSS, and IF where efforts have power targets), the search, Filters and sort
toolbar, and the count row. Every card opens a detail page rendered by the
shared `WorkoutDetail` layout: public at `/athlete/library/<slug>`, saved at
`/athlete/workouts/<id>`. Saved workouts differ only where ownership does: the
detail page shows **Edit** beside Start workout and Schedule, and ⋯ adds share
link and Delete; public workouts offer **Customize** in ⋯ instead. Workout
drafts kept on this device appear as an "N unsaved workouts" chip at the right of
the tabs row, opening a popover that names each one with its age and offers
Restore and Discard. Opening a workout that has a draft says "You have unsaved
changes from <age>. Restore them?" inside the editor, with "They're only on this
device." below. Drafts identical to the saved version
are removed. Profile keeps its inline recovery notice, beside its single form. Back returns
to Public library. A clean draft closes without confirmation.

### Editing

`WorkoutBuilder` is the canonical structured authoring surface. Show the
minimum by default and put advanced fields behind **More options**; a typical
workout (up to about eight rows) fits a 1440×900 screen with the save bar.

- **Title row.** Name, sport and an Edit basics link, then **Add block**, undo,
  redo, total time and TSS, a **Time by zone** toggle, then the host's status
  and ⋯ (passed as `headerActions`, so a host does not add a second header).
  New workouts open the basics panel (name, sport, notes, schedule) first; it
  closes with Done.
- **Profile.** The shared full `WorkoutProfile` is the canvas: click or arrow to
  a bar to select that step. A missing-profile hint ("Add your FTP to see watts.
  Open Profile") appears once under the chart, never per step.
- **Step list.** One line per row: drag handle, zone swatch, name (phase, or the
  zone for work), duration and target. Repeated sets are stored as consecutive
  copies but shown as one Set row with a − × N + stepper and its steps indented
  once; editing a set step changes every repeat. Identical single steps stay
  separate rows. Row actions (duplicate, repeat with next step, move earlier
  or later, remove) live in the row ⋯ menu; Alt+↑/↓ moves the focused row and
  the handle supports keyboard drag. The whole row drags too: with a mouse
  after 6px of movement (a click still selects), on touch after a short hold
  (a swipe still scrolls). Buttons, fields, the open step editor and a set's
  own steps never start a row drag; a set drags from its header row. On
  desktop the list scrolls inside the page when long.
- **Step editor.** A side panel from `lg`, otherwise inline under the selected
  row. By default only duration (free text such as 10, 90s or 1:30; arrow keys
  nudge) and intensity (Z1–Z5 plus −/+ on the target). More options holds step
  type, target type and low/high range (warm-up and cool-down power ranges
  ramp), single-step repeats and the coaching note, which also carries cadence
  cues.
- **Adding.** Add block offers Warm-up, Steady, Intervals (a 5 × repeat), Recovery,
  Cool-down and a few interval presets; new cycling steps start with a %FTP
  target. Focus and selection move to the new step.

Undo and redo cover every builder change (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z outside
text fields). The workout library shows unsaved status in the builder's title
row, not inside the chart. While the session adjustment editor is open it
replaces the read-only overview profile.
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

In the workout editor, chart bar height follows the block's numeric target within its zone. Adjacent values within one zone should be distinguishable; a pause remains a short visible mark above the baseline. Keep a step's target adjustment immediately below its zone choice. Resolve profile pace bounds and HRmax percentages for the current user, and expose only the current block's relevant pace or heart-rate target in its inspector and spoken chart label.

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
says the changes are only on this device. Present stale workout edits as new copies rather than
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

### Session detail

The DOM order is the phone order: header, Workout overview, the logging or
result card (How did it go?, Result, Skipped, Your result
or Activity notes), Steps, recorded data, Description, Coach. When the
content area is at least 56rem wide (a container query, so the sidebar counts),
the logging card and Coach move to a 320px side column beside the overview; it is
sticky on tall viewports unless it holds a recorded outcome. Opening the
planned adjustment or outcome correction editor returns the page to one column.
The header Mark as done link scrolls to the card and focuses the note.
A saved activity with recorded data puts **Post to Strava** (secondary) in the
header; once posted it reads **Posted to Strava** with a **View on Strava** link. The post sheet
shows the chart image, then editable Title and Description, with **Not now** and
**Post to Strava**; Download image and the .tcx fallback stay in the sheet.

### Activity

Completed work is a `WorkoutCard` grid: title, date and sport, duration, a slim
block bar, one-line notes, TSS and compliance, and Compare where a planned
baseline exists. The card opens the session outcome. Search, sport filter,
totals and pagination stay above and below the grid.

### Home overview

Home is a compact overview that fits one desktop screen: Today (sport, title,
duration, TSS and target, a compact block bar, Start workout and Details) beside
the next three Coming up sessions, then This week, then a row of summary tiles.
The long description lives on the session page. Training trends, Weekly volume
and Last activity are tiles with one value line and a word-sized sparkline;
each opens its full chart and explanation in `HomeSummaryDialog`. Settings
switches hide their tiles and the row reflows. Missed sessions appear only in
the week strip summary and on Calendar. Phones stack in the same order.

### Home training setup

Show incomplete training targets in a compact link directly below Today. Name
the missing target and open its Profile row. Profile keeps units explicit and
shows calculated previews and advanced targets with the fields they affect.
The link disappears when maximum heart rate and the selected sports’ targets
are saved. Unknown values may remain blank.

### Personal training plans

Use the established Night Instrument surfaces and shared controls. Keep the
plan name and optional purpose together. Follow them with a sport-filtered
workout picker with My workouts and Public library groups, multi-weekday
selection, and an ordered Monday-to-Sunday outline. Default the picker to Bike.
Built-in plans offer Customize to open a new draft from their default workouts.
Link each public workout in the built-in preview to its library page.
Days without entries say No workout. Multiple entries expose accessible reorder
and remove controls; at narrow widths their actions wrap below the workout
selector. Show save failures beside Save and retain the draft. Cancelling or
leaving the browser requires an unsaved-change safeguard.

The library previews only the weekdays that have workouts, with the session count.
The title opens the editor, and Duplicate and Delete live in the card's ⋯ menu.
Apply to Calendar opens scheduling for the chosen training plan with options
for One week or Whole month, an explicit full date range, and the actual dated
workout list/count before saving. Explain that existing sessions remain, empty
days add nothing, relative targets use Profile and fixed targets remain fixed.
Training plans use one weekly schedule model. Keep cadence controls, workout block
authoring, and loading a training plan as a single workout out of the editor.
