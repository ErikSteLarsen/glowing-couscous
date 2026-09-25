---
name: Tempo
description: A light editorial endurance training workspace where structured workouts move like ink on paper.
colors:
  signal: "#102F51"
  signal-tint: "#E8EDF2"
  signal-hover: "#1D456D"
  signal-ink: "#FFFFFF"
  selection: "#DCE4EB"
  scrollbar-thumb: "#AAB3B8"
  scrollbar-thumb-hover: "#7C8D99"
  liquid: "#71879A"
  liquid-tint: "#E7ECEF"
  paper: "#F5F4EF"
  surface: "#FBFAF7"
  field-surface: "#F8F7F2"
  sunken: "#ECEAE4"
  border: "#D4D3CD"
  field-border: "#BFC2C0"
  ink: "#112842"
  ink-secondary: "#53606B"
  ink-muted: "#7F8588"
  selected-border: "#8AA0B5"
  selected-text: "#102F51"
  white: "#FFFFFF"
  success: "#2E6D53"
  success-tint: "#E6EFEA"
  success-border: "#B9D1C4"
  warning: "#8B681F"
  warning-tint: "#F1EBDD"
  warning-border: "#DCCBA6"
  danger: "#99443D"
  danger-tint: "#F2E5E0"
  danger-tint-strong: "#EBD3CC"
  danger-border: "#D7AAA0"
  missed: "#725C76"
  missed-tint: "#EEE7EE"
  missed-border: "#CDBFD0"
  nav-surface: "#F1F0EB"
  nav-border: "#D2D1CB"
  nav-text: "#112842"
  nav-muted: "#65717A"
  nav-active: "#E0E6EB"
  zone-1: "#71879A"
  zone-1-tint: "#E7ECEF"
  zone-2: "#658A7A"
  zone-2-tint: "#E6EFEA"
  zone-3: "#A48658"
  zone-3-tint: "#F1EBDD"
  zone-4: "#B36F5B"
  zone-4-tint: "#F2E5E0"
  zone-5: "#8B708A"
  zone-5-tint: "#EEE7EE"
typography:
  display:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.1
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.35
  control:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.07em"
  compact-control:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  metric:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: "tnum"
rounded:
  compact: "3px"
  control: "3px"
  field: "3px"
  surface: "3px"
  dialog: "5px"
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
    backgroundColor: "{colors.signal}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "40px"
  button-compact:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.white}"
    rounded: "{rounded.compact}"
    padding: "6px 10px"
    height: "32px"
  field:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "8px 12px"
    height: "40px"
  surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "20px"
  session-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "16px"
  status-chip:
    backgroundColor: "{colors.liquid-tint}"
    textColor: "{colors.selected-text}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
  nav-item:
    backgroundColor: "{colors.nav-surface}"
    textColor: "{colors.nav-muted}"
    rounded: "{rounded.field}"
    padding: "10px 16px"
    height: "40px"
  session-block-bar:
    backgroundColor: "transparent"
    rounded: "{rounded.field}"
    height: "32px"
---

# Design System: Tempo

## Overview

**Creative North Star: "Ink Is Movement"**

Tempo is an operational training surface organized around the Monday-to-Sunday
week and rendered as a quiet ink studio. The week connects personal planning,
session execution, completion, and history. The first MVP prioritizes people
managing their own training; onboarding, empty states, and primary actions
should make sense without a coach connection. Coach collaboration is secondary.
The interface should feel crafted and alive through line, texture, and considered
transitions while staying quick to use repeatedly rather than performing as a
motivational game board.

The product world is warm paper, indigo ink, fine rules, editorial spacing, and
organic flow linework. The sidebar is a studio index; the main field is a page
for the current work; sessions become study tiles and connected marks. The
authenticated product is the visual authority. The `/design/*` routes are
alternate visual previews and sample content; they are not production tokens or
layouts.

**Key Characteristics:**

- Monday-first hierarchy with the current week and current day easy to locate.
- One clear next action before secondary metrics or history.
- Shared session, status, metric, and block-structure language across routes.
- Warm paper surfaces with semantic borders, fine linework, and restrained depth.
- Text-visible states and persistent keyboard focus.

## Colors

The palette is warm paper, deep indigo ink, blue-gray current lines, and quiet
training-state colors. The indigo signal owns forward actions and active context;
status colors explain meaning without turning the workspace into a dashboard of
bright badges.

In the implementation, `--color-signal`, `--color-liquid`, and their tint
tokens are the theme tokens. Existing component classes consume the semantic
aliases `--brand` and `--brand-tint`; preserve those aliases when changing
shared styles.

### Primary

- **Signal:** `{colors.signal}` is the indigo action ink for primary actions,
  active context, and current-day emphasis.
- **Liquid:** `{colors.liquid}` is the blue-gray linework for focus, links,
  channel connectors, and selected navigation context.
- **Signal tints:** `{colors.signal-tint}` holds selected context;
  `{colors.liquid-tint}` holds quiet informational surfaces.

### Secondary

- **Completion green:** `{colors.success}` and `{colors.success-tint}` indicate
  completed or successfully saved work.
- **Adjusted amber:** `{colors.warning}` and `{colors.warning-tint}` indicate a
  changed plan or a warning that needs attention.
- **Missed violet:** `{colors.missed}` and `{colors.missed-tint}` identify missed
  work without competing with the active signal.
- **Danger red:** `{colors.danger}` and `{colors.danger-tint}` are reserved for
  destructive actions and destructive feedback.

### Tertiary

- **Training zones:** `{colors.zone-1}` through `{colors.zone-5}` are used by
  `SessionBlockBar` and block details to show intensity. Their tint tokens are
  for supporting surfaces, not large decorative fills.

### Neutral

- **Paper:** `{colors.paper}` is the page canvas and studio field.
- **Surface:** `{colors.surface}` is a focused work surface held on the paper.
- **Field surface:** `{colors.field-surface}` is the quiet control and row
  surface.
- **Sunken:** `{colors.sunken}` is the week ribbon and inactive structure.
- **Ink:** `{colors.ink}`, `{colors.ink-secondary}`, and `{colors.ink-muted}`
  form the primary, supporting, and muted text hierarchy on paper.
- **Borders:** `{colors.border}` is the ordinary rule; `{colors.field-border}`
  separates controls from their surrounding surface.
- **Navigation:** the `nav-*` tokens keep the persistent shell visually
  distinct without introducing a second accent system.

**The Ink Roles Rule.** Indigo owns forward action and active context. Blue-gray
linework owns focus and flow. Status colors explain what happened; they do not
compete with the next action.

## Typography

**Display Font:** Schibsted Grotesk (with `system-ui`, `sans-serif` fallback)

**Body Font:** Schibsted Grotesk (with `system-ui`, `sans-serif` fallback)

**Character:** The single family keeps dense training information coherent while
the lightest loaded weight gives route titles an editorial, studio-like voice. A
clear scale ladder separates route titles, task labels, metrics, and supporting
copy without compromising scan speed.

### Hierarchy

- **Display:** use the `display` token for route headings and primary page
  titles. Home uses the same shared page-heading scale and placement as the
  rest of the authenticated workspace.
- **Title:** use the `title` token for section headings and prominent session
  titles. Shared page headings use `pageHeadingClassName` at 40px desktop and
  34px mobile; comparable Home section headings use `sectionHeadingClassName`
  at 20px.
- **Body:** use the `body` token for explanations, notes, and task copy. Keep
  supporting text readable and do not use muted text for essential instructions.
- **Label:** use the `label` token for compact metadata, dates, section labels,
  and status text. Uppercase tracking is functional only when it improves scan
  order.
- **Metric:** use the `metric` token or `MetricText` for duration, TSS, dates,
  counts, and other comparable measurements. Tabular numerals are required.

**The Measurement Rule.** Duration, TSS, RPE, dates, and counts are data. Keep
their numerals stable and aligned with `MetricText` instead of styling each
route's metrics as a new visual object.

## Layout

The product is a week-first workspace, not a marketing canvas. `PageShell` in
`components/ui.tsx` is the single workspace frame and main landmark. All signed-in
pages share its full-width frame; there are no route-level frame variants. The `page-layout`
rules and `--page-*` tokens in `app/globals.css` own the centered 1800px maximum,
20px mobile / 24px desktop / 32px large-screen gutters, 24px top padding, 96px
minimum header band, and 16px page-group gap. `TopBar` top-aligns titles and actions.
Descriptions, long titles, zoom, and narrow screens may grow the band to preserve
content rather than clipping it. Content below the header can use shared
maximum measures of 860px for compact account forms, 800px for the single-column
workout library, 960px for session detail, and 1080px for activity and template libraries. These
sections stay fluid below their maximum and center within the page frame when
there is extra horizontal space. Workout and template editors use the full available frame width when
active; the workout basics step keeps its centered 46rem panel. Home, Calendar,
and Planner retain the full available frame width. None of these content
measures moves the page heading or outer content anchor. Authentication
uses the separate `AuthPageShell` reading-width frame.

Planner adapts to the actual page container: below 900px its source, calendar,
and selection panels stack; from 900px the source and selection share a 240px
rail alongside the calendar; from 1400px they flank it in three columns. The
seven-day grid has no fixed minimum width. Month height responds to viewport
height, including room for template-range controls, and always shows every week.
Day cells preview one session and an additional count; the selection panel owns
full details. Narrow calendars show counts instead of session titles. Supporting
rails may scroll independently on desktop. Small screens and enlarged text retain
natural page scrolling; never hide content to force the whole page into a viewport.

Desktop reserves a `216px` viewport-bounded sidebar from the `md` breakpoint
(`768px`) upward. The sidebar owns primary navigation and local overflow; the
content column must remain `min-width: 0`. Below that breakpoint, secondary
navigation moves into a focus-managed drawer and the first four role-aware
destinations become a fixed four-item bottom navigation. Mobile content keeps
bottom space for that navigation and never relies on hover.

Training weeks always render Monday first. Home and Calendar compose around the
week, Workouts and Session retain scheduled context, and Planner uses a
month-first assignment desk with selected dates and exact template ranges. At `2xl`, a week can expand into a wall; at
  smaller widths, the home week ribbon becomes a horizontal channel and controls
  wrap without hiding the primary save or navigation action.

Mark the current date on its numeral with the shared understated ink underline
and tint. Keep that cue independent of a selected day, which uses the selected
surface and checkmark. Preserve accessible current-date semantics and spoken
labels; reserve “Today” text for headings and navigation actions.

## Elevation & Depth

Tempo is paper-deep by default. Ordinary pages, rows, fields, and surfaces use
warm tonal layering, one-pixel borders, and the restrained `--shadow-inset` token
to feel printed into the field. `--shadow-raised` is for a small number of
persistently raised settings or utility surfaces. `--shadow-overlay` is for
menus, dialogs, drawers, and other layers that must clearly sit above the page.
Do not add a shadow to make a repeated content row feel more important.

**The Paper Depth Rule.** A surface earns outer elevation only when it is raised
by state or interaction, such as a menu, drawer, or dialog. Inset depth belongs
to the paper material and should remain quiet.

## Shapes

The form language is restrained and tactile without becoming rounded-card
decoration. Compact controls use the compact radius, normal buttons use the
control radius, fields and default session rows use the field radius, compact
and month session rows use the compact radius, and larger tiles use the surface
radius. Status indicators use pill geometry. Borders are semantic one-pixel
rules, not ornament. Use a larger radius only when the component's role
requires a distinct container or dialog silhouette.

Avoid mixing unrelated radius values within one control group. Keep the 40px
minimum control height for ordinary actions and fields; compact actions use 32px
in dense toolbars where the surrounding context already provides sufficient room.

## Components

### Buttons

Buttons are tactile, direct task controls. Indigo is reserved for the one forward
action; blue-gray is reserved for focus and navigation. Use the shared class
names exported by `components/ui.tsx` rather than restyling buttons in a route.

- **Primary:** signal background, white text, normal control radius, and a 40px
  minimum height with a 13px label. Use for the one forward action in
  the current task.
- **Secondary:** surface tone, ordinary border, ink text, and the same target
  size and label scale. Use for adjacent or reversible actions.
- **Compact:** the compact primary/secondary/danger classes are for dense lists,
  editor command strips, menus, and navigation. They keep the same hierarchy at
  a smaller 32px height with a 12px sentence-case label and no raised shadow.
  Do not use them for a button that submits, cancels, clears, copies, or
  destructively changes a form with 40px fields; those actions use the matching
  standard 40px tone so the row reads as one instrument.
- **Danger:** danger tint, danger border, and danger text. Confirm actions that
  can discard or delete work. It uses the same 3px control radius and sizing
  tiers as the other tones.
- **Ghost:** text-only actions use the shared ghost class at the standard or
  compact height. They are for inline recovery and contextual links, not a new
  visual button size.
- **Segmented choices:** role, view, and comparison choices use the standard or
  compact height matrix rather than padding-only sizing.
- **Editor content controls:** preset cards and block selectors may be taller
  when their labels and descriptions are the content being selected. They are
  not general-purpose CTA variants.
- **Focus and disabled:** every button keeps a visible signal focus ring;
  disabled controls remain legible and expose their unavailable state.

### Cards / Containers

Containers organize a task; they are not a page template. Repeated content reads
as channels and study tiles inside the studio rather than a grid of floating
dashboard cards.

- **Surface:** use `Surface` from `components/ui.tsx` for ordinary grouped
  content. It is a warm paper, bordered, inset work surface using the field
  radius.
- **Session row:** use `SessionRow` for navigable workout summaries. The whole
  row is the link; `default` uses the field radius, while `compact` and `month`
  use the compact radius.
- **Empty state:** use `EmptyState` beside the task that produced the empty
  result, with a recovery action when one exists.
- **Selection:** selected editor blocks and selected sessions use the liquid
  tint and border; do not create a new selected-card treatment.

### Inputs / Fields

Inputs use the shared `formFieldClassName`, `formSelectClassName`, and
`formTextareaClassName` exports. Ordinary inputs and selects use a 40px control
height, 13px text, 3px radius, field surface, semantic border, inset depth, and
visible blue-gray focus ring. Textareas use the same type and surface language
with extra vertical room for writing. Labels remain explicit and use the 13px
form label scale; placeholder text is supporting copy, never the only label.
Mobile forms keep save and destructive actions reachable without requiring a
horizontal layout.

### Navigation

`AppShell` and `AppSidebar` own authenticated navigation. Desktop uses a sticky
216px sidebar with a paper navigation surface, indigo active tint, and a thin
indigo rail. Mobile uses a drawer with an overlay, Escape-to-close,
focus containment, and a fixed bottom bar with four primary destinations. Do not add route-local
primary navigation or a second shell. Page headers should not repeat sibling
workspace destinations; reserve their actions for the current page's task or
for contextual return and execution controls.

### Workout / Session Language

- `SessionRow` is the shared workout-card unit across Home, Calendar, Workouts,
  and week surfaces. `default` includes metrics and the timeline, `compact`
  preserves essential context for a week wall, and `month` shows only what a
  month grid can support.
- `SessionBlockBar` uses duration-proportional segments. On card and compact
  variants, segment height maps to Zone 1 through Zone 5 and color identifies
  the zone. Its accessible label carries the same information in text.
- `StatusBadge` shows planned, adjusted, or missed text states. Completed work
  does not need a repeated completed badge.
- `MetricText` provides tabular numerals. `Stepper` owns ordered live execution
  and `Toggle` owns switch semantics and its focus treatment.

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
field. Every `SessionBlockBar` maps zone to segment height and time to width,
including the full-size authoring timeline. The basics step uses a
centered reading-width panel and presents Continue as its only forward action;
template and save controls appear with the detailed authoring workspace.
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
and slowest `m:ss /km` values. Workout blocks show the selected zone's resolved
target and keep other target systems out of that block's readout.

## Do's and Don'ts

### Do:

- **Do** start from `DESIGN.md`, then inspect `app/globals.css` and the shared
  component owner before creating new visual tokens or primitives.
- **Do** keep the current week, current day, session state, and next action in
  one context when the task requires them together.
- **Do** reuse `PageShell`, `TopBar`, shared button and field classes, `Surface`,
  `SessionRow`, `StatusBadge`, `MetricText`, and `SessionBlockBar`.
- **Do** pair every color state with text, structure, or an accessible label.
- **Do** preserve keyboard focus, reduced-motion behavior, explicit labels,
  readable contrast, and 40px standard action targets. Reserve 32px compact
  controls for dense contexts with surrounding room.
- **Do** use `app/globals.css` semantic variables when a token exists instead
  of introducing an inline color or shadow.

### Don't:

- **Don't** copy the palette, rounded geometry, or dashboard composition from
  `/design/tempo-split` or `/design/tempo-field`; those routes are previews only.
- **Don't** invent a route-local card grammar when a shared session or surface
  primitive already fits.
- **Don't** make every bordered region a floating card, or every secondary
  action as prominent as the primary action.
- **Don't** use color alone for planned, completed, adjusted, missed, loading,
  error, permission, or success states.
- **Don't** add gradients, decorative shadows, oversized hero metrics, or extra
  accent roles to ordinary authenticated product screens.
- **Don't** use decorative eyebrow labels, section numbers, emoji, or Unicode
  glyphs as substitutes for hierarchy and the established icon system.
- **Don't** add a new token before checking whether the semantic token in
  `app/globals.css` already expresses the state.

## Interaction Feedback Contract

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
