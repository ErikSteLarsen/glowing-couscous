---
name: Tempo
description: A bright white or layered black training workspace with decisive actions, restrained cobalt cues, and rounded work surfaces.
colors:
  signal: "#111412"
  signal-tint: "#F7F9F7"
  signal-hover: "#2A2D2B"
  signal-ink: "#FFFFFF"
  selection: "#DCE8FF"
  accent: "#3D64B0"
  accent-tint: "#E3ECFF"
  accent-dark: "#A9C5FF"
  scrollbar-thumb: "#A7B0A9"
  scrollbar-thumb-hover: "#7D8B80"
  liquid: "#68776B"
  liquid-tint: "#EDF1ED"
  paper: "#FFFFFF"
  surface: "#FFFFFF"
  field-surface: "#F8F9F8"
  sunken: "#FAFBF9"
  border: "#E1E5E0"
  field-border: "#BCC6BC"
  ink: "#111412"
  ink-secondary: "#3B443E"
  ink-muted: "#59635C"
  selected-border: "#68786B"
  selected-text: "#111412"
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
  nav-surface: "#FFFFFF"
  nav-border: "#E1E7E2"
  nav-text: "#111412"
  nav-muted: "#505C52"
  nav-active: "#E3ECFF"
  nav-signal: "#3D64B0"
  zone-1: "#2563EB"
  zone-1-tint: "#E4EDFF"
  zone-2: "#16A34A"
  zone-2-tint: "#E1F4E7"
  zone-3: "#CA8A04"
  zone-3-tint: "#FBF1D2"
  zone-4: "#EA580C"
  zone-4-tint: "#FDE7D9"
  zone-5: "#DC2626"
  zone-5-tint: "#FBE4E2"
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
  compact: "9px"
  control: "10px"
  field: "10px"
  surface: "16px"
  dialog: "20px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  page-inline: "20px"
  page-inline-sm: "24px"
  page-inline-lg: "32px"
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
    rounded: "{rounded.surface}"
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

**Creative North Star: "Movement in Contrast"**

Tempo is an operational training surface organized around the Monday-to-Sunday
week and rendered as a quiet Monolith workspace. The week connects personal planning,
session execution, completion, and history. The first MVP prioritizes people
managing their own training; onboarding, empty states, and primary actions
should make sense without a coach connection. Coach collaboration is secondary.
The interface should feel crafted and alive through line, texture, and considered
transitions while staying quick to use repeatedly rather than performing as a
motivational game board.

The product world is layered near-black in dark mode and crisp white in light
mode. Primary actions are porcelain white on dark and near-black on light.
Cobalt belongs to the logo, active navigation, hover feedback, and a few small
identity cues; it is not the main fill for actions or large work surfaces. Rounded panels distinguish
focused tasks from open reading areas. The selected Home and Workouts
compositions are production surfaces. Older `/design/*` workout and planning
experiments are developer-only studies, not alternative production themes.

**Key Characteristics:**

- Monday-first hierarchy with the current week and current day easy to locate.
- One clear next action before secondary metrics or history.
- Shared session, status, metric, and block-structure language across routes.
- Clear tonal separation, soft panel corners, semantic borders, and restrained depth.
- Content libraries and history favor open collections, clear spacing, and fine
  separators; reserve enclosing frames for focused tasks, controls, and
  deliberately compact grids.
- Text-visible states and persistent keyboard focus.

## Colors

The palette is black and white first. Dark mode uses near-black layers and
near-white controls. Light mode stays predominantly white, with a pale neutral
Today plane and black reserved for forward actions and selected work. Cobalt
marks the identity, active navigation, and small interaction cues. Large work
surfaces keep the neutral color of their theme. Status
colors remain available when their meaning matters, with text labels alongside.

In the implementation, `app/globals.css` owns both theme token sets on the
document root (`data-workspace-theme`). A small head script restores the saved
theme before hydration; `AppShell` owns the theme switch and persistence.
`--color-signal`, `--color-liquid`, and their tint tokens feed the semantic
aliases `--brand` and `--brand-tint`; preserve those aliases when changing
shared styles. Preview query parameters are not production theme inputs.

### Primary

- **Signal:** `{colors.signal}` is the near-black action fill in light mode and
  porcelain fill in dark mode.
- **Liquid:** `{colors.liquid}` is the quiet neutral for measurements and
  supporting lines.
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

- **Training zones:** Blue, green, yellow, orange, and red identify Zones 1–5.
  Zone color is reserved for intensity data, never primary actions or large
  work surfaces. Their tint tokens support compact block details. Text on those
  tints uses the theme ink color for legibility.
- **Within-zone intensity:** A target's percentage determines a fraction of its
  zone band. Bar height and hue move continuously through the five anchor colors;
  the midpoint of each band is its named zone color. Adjacent zone edges share
  the same interpolated color. Missing target data uses the zone midpoint, and
  pauses stay neutral. Dark mode uses brighter anchors and darker tints.

### Neutral

- **Paper:** `{colors.paper}` is the light canvas; dark mode uses near-black.
- **Surface:** `{colors.surface}` is a focused work surface held on the canvas.
- **Field surface:** `{colors.field-surface}` is the quiet control and row
  surface.
- **Sunken:** `{colors.sunken}` is the week ribbon and inactive structure.
- **Ink:** `{colors.ink}`, `{colors.ink-secondary}`, and `{colors.ink-muted}`
  form the primary, supporting, and muted text hierarchy in light mode; dark
  mode inverts them.
- **Borders:** `{colors.border}` is the ordinary rule; `{colors.field-border}`
  separates controls from their surrounding surface.
- **Navigation:** the `nav-*` tokens carry the restrained cobalt accent in
  active context while keeping the shell surface neutral.

**The Monolith Roles Rule.** Contrast owns forward action and major work
surfaces. Cobalt is reserved for the mark and subtle interaction feedback. Status colors
explain what happened; they do not compete with the next action.

## Typography

**Display Font:** Schibsted Grotesk (with `system-ui`, `sans-serif` fallback)

**Body Font:** Schibsted Grotesk (with `system-ui`, `sans-serif` fallback)

**Character:** The single family keeps dense training information coherent while
the lightest loaded weight gives route titles an editorial, studio-like voice. A
clear scale ladder separates route titles, task labels, metrics, and supporting
copy without compromising scan speed.

### Hierarchy

- **Display:** use the `display` token for route headings and primary page
  titles. The selected Home and Workouts compositions use the large Focus
  heading scale; other routes use the shared `TopBar` scale.
- **Title:** use the `title` token for section headings and prominent session
  titles. Shared page headings use `pageHeadingClassName` at 40px desktop and
  34px mobile on shared routes. Focus Home and Workouts use their own aligned
  section scale from `app/monolith.css`, with their selected Monolith
  surface treatments in `app/globals.css`.
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
`components/ui.tsx` remains the shared frame for most signed-in routes. Athlete
Home and Workouts use the selected Focus composition, backed by the real data
and editor owners. The `page-layout`
rules and `--page-*` tokens in `app/globals.css` own the centered 1800px maximum,
20px mobile / 24px desktop / 32px large-screen gutters and matching top padding,
64px desktop minimum header band (content-sized on mobile), and 24px page-group gap. `TopBar` top-aligns titles and actions.
Descriptions, long titles, zoom, and narrow screens may grow the band to preserve
content rather than clipping it. Content below the header can use shared
maximum measures of 860px for compact account forms, 960px for session detail,
and 1080px for activity and template libraries. The selected Workout library
uses a rounded work panel and responsive compact-card grid, reaching three
columns when space permits. These
sections stay fluid below their maximum and center within the page frame when
there is extra horizontal space. Workout and template editors use the full available frame width when
active; the workout basics step keeps its centered 46rem panel. Home, Calendar,
and Planner retain the full available frame width. None of these content
measures moves the page heading or outer content anchor. Authentication
uses the separate `AuthPageShell` reading-width frame.

### Return Navigation

Pages and nested editing states with a clear parent use the shared 40px (44px on mobile)
icon-only `BackControl`. At page level, `TopBar` places its left arrow inline
immediately before the title so the control adds no header row. Its accessible
name and hover hint identify the destination; navigation uses an explicit
parent URL and preserves relevant entry context. Main destinations reachable
from workspace navigation do not repeat a back control. Nested editors place
the same control beside their local heading and preserve any draft safeguards.

Personal Calendar owns browsing and scheduling in one Monday-first week or
month surface. Keep the page-level Add session action above the compact period
toolbar, with previous/next, Today, Select days, and Week/Month controls. The seven-column
grid uses fluid columns without a fixed minimum width. At viewport widths of
1200px and above, inline scheduling occupies a 320px right rail with a 24px
gap. Below 1200px, the date grid precedes the composer and selected-day agenda
in natural page flow; the composer is capped at 640px. Week sessions move from
day columns to a date strip and selected-day agenda below that viewport
breakpoint or at 1000px or less of calendar container width. Month cells show
counts in place of previews below 640px viewport width or at 600px or less of
month grid width. Phone date buttons retain 72px height, and the
toolbar wraps without clipping controls. Month cells preview one session and
an additional count, with a 96px minimum height on wide calendars. Month browsing
places its summary and selected-day agenda in a 280px right rail above 1200px;
on narrower screens these follow the grid. Today uses a quiet neutral plane and
a small text label beside the date, without a full-cell outline. Selection uses
a subtle field border with stable padding. Select days exposes a count and clear/cancel
controls, then carries the dates into scheduling; routines preview a full week or month.
Preserve page scrolling and bottom
navigation clearance rather than fitting all dates and scheduling controls
into a fixed viewport.

The coach Planner retains the shared `PlannerDesk` composition. It adapts to the actual page container: below 900px its source, calendar,
and selection panels stack; from 900px the source and selection share a 240px
rail alongside the calendar; from 1400px they flank it in three columns. The
seven-day grid has no fixed minimum width. Month height responds to viewport
height and always shows every week.
Day cells preview one session and an additional count; the selection panel owns
full details. Narrow calendars show counts instead of session titles. Source
results may scroll independently on desktop once their list exceeds 320px;
search, creation links, and selected-day details remain outside that scroll
area. Small screens and enlarged text retain
natural page scrolling; never hide content to force the whole page into a viewport.

Desktop shows a `228px` viewport-bounded sidebar from the `md` breakpoint
(`768px`) upward. Hide menu releases the whole sidebar column to the page;
the browser remembers this preference across pages and reloads. A sticky
Show menu control at the top left restores it without obscuring page actions.
The sidebar owns primary navigation and local overflow; the
content column must remain `min-width: 0`. Below that breakpoint, secondary
navigation moves into a focus-managed drawer and the first four role-aware
destinations become a fixed bottom navigation with four destinations and an icon-only menu control. Mobile content keeps
bottom space for that navigation and never relies on hover.

Training weeks always render Monday first. Home composes around the week,
Calendar joins week/month browsing with contextual scheduling, Workouts and
Session retain scheduled context, and coach Planner uses a month-first
assignment desk with selected workout dates and Monday-starting training plans.
Home uses a content-sized Today panel and compact optional readouts alongside
a complete week ledger. The ledger has no fixed height or internal scrollbar;
session titles wrap above their duration and state. Below 880px available
content width the two groups stack. Disabled readouts reserve no grid space.
Home and Workouts reuse the shared page gutters, and workout library columns
fit their available width with a 280px preferred minimum, shrinking to one
fluid column on phones. Preferences uses a 640px reading width; Profile keeps
its 860px form width. Workouts hides its library while the production editor is active; returning
to the library preserves the shared page context. Controls wrap without hiding save or navigation actions.

Use the route-specific current-day treatment described under Workout / Session
Language. Keep it independent of selection; expose selected Calendar and Planner dates
through their button state. Preserve
accessible current-date semantics and spoken labels; reserve “Today” text for
headings and navigation actions.

## Elevation & Depth

Tempo is quiet and high contrast. Ordinary pages, rows, fields, and surfaces
use tonal layering and one-pixel borders. The light canvas is a pale neutral
`#F5F6F5` beneath white panels and lightly recessed `#F8F9F8` controls. Dark
mode separates the `#080909` canvas, `#171919` work panels, `#202323` Today
plane, and `#222424` fields. The shared inset highlight gives panel edges a
subtle material cue without making repeated rows float. `--shadow-raised` is for a small number of
persistently raised settings or utility surfaces. `--shadow-overlay` is for
menus, dialogs, drawers, and other layers that must clearly sit above the page.
Do not add a shadow to make a repeated content row feel more important.

**The Depth Rule.** A surface earns outer elevation only when it is raised
by state or interaction, such as a menu, drawer, or dialog. Regular work panels
rely on tonal contrast and a fine rule.

Repeated content does not need a separate enclosing surface for every item.
Use open rows with spacing and a fine separator for activity history and other
reading-first collections. Keep a frame when it helps users recognize an active
work area, a control group, a date cell, or a compact interactive library card.

## Shapes

The form language uses rounded but disciplined geometry. Compact controls use
9px, normal buttons and fields 10px, common surfaces and library cards 16px,
and focused Home or Workouts panels 20–24px. Status indicators use pill
geometry. Borders remain semantic one-pixel rules.

Training chart bars use the shared `--radius-chart-bar` token (4px) on their
top corners and keep a flat baseline. Apply this cap to workout timelines,
authoring bars, session structure, recorded metrics and recent load; preserve
duration widths, intensity heights and missing/zero-value gaps. Calendar
intensity swatches use subtle 2px corners.

Avoid mixing unrelated radius values within one control group. Keep the 40px
minimum control height for ordinary actions and fields; compact actions use 32px
in dense toolbars where the surrounding context already provides sufficient room.

## Components

### Buttons

Buttons are tactile, direct task controls. A near-white or near-black fill
marks the forward action, according to the theme. Use the shared class
names exported by `components/ui.tsx` rather than restyling buttons in a route.

- **Primary:** contrasting signal background and text, 10px radius, and a 40px
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
  can discard or delete work. It uses the same 10px control radius and sizing
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
  content. It is a bordered tonal work surface using the 16px surface radius.
- **Session row:** use `SessionRow` for navigable workout summaries. The whole
  row is the link; `default` uses the field radius, while `compact`, `calendar`,
  and `month` use the compact radius. Calendar variants highlight the row
  border and surface on hover and keyboard focus without the animated leading
  stripe.
- **Empty state:** use `EmptyState` beside the task that produced the empty
  result, with a recovery action when one exists.
- **Selection:** selected editor blocks and selected sessions use the liquid
  tint and border; do not create a new selected-card treatment.

### Inputs / Fields

Inputs use the shared `formFieldClassName`, `formSelectClassName`, and
`formTextareaClassName` exports. Ordinary inputs and selects use a 40px control
height, 13px text, 10px radius, field surface, semantic border, and a visible
focus ring. Textareas use the same type and surface language
with extra vertical room for writing. Labels remain explicit and use the 13px
form label scale; placeholder text is supporting copy, never the only label.
Mobile forms keep save and destructive actions reachable without requiring a
horizontal layout.

### Navigation

`AppShell` and `AppSidebar` own authenticated navigation. Desktop uses a sticky
228px sidebar with a near-black surface in dark mode and a white surface in
light mode. Hide menu and Show menu use panel-direction icons and explicit
accessible names and hover hints; reserve back arrows for returning to a page. Hidden desktop navigation
leaves no rail or focusable links. Its active tint and identity cue use cobalt. The sidebar theme switch saves a user's light or
dark choice locally. Mobile uses a drawer with an overlay, Escape-to-close,
focus containment, and a fixed bottom bar with four primary destinations.
Mobile uses the icon-only menu control in the bottom bar instead of a sticky
top row. Right swipe from the interior left-edge band (20–48px) opens the drawer;
left swipe inside closes it. Vertical scrolling, inputs and dialogs are excluded.
The outer edge remains available for browser history. The desktop top-left
Show menu control remains reachable when scrolling. Drawer
dismissal restores focus, releases scroll lock, and retains the separate desktop
preference. Route changes and crossing into desktop close the drawer; hidden
page content is inert while it is open. Menu controls have 44px touch targets
and honor safe areas and reduced motion. Do not add route-local
primary navigation or a second shell. Page headers should not repeat sibling
workspace destinations; reserve their actions for the current page's task or
for contextual return and execution controls.

### Workout / Session Language

Imported running-file interpretation reuses `SessionBlockBar` for detected
effort structure: width represents actual duration, height and color represent
estimated intensity, and unknown intensity remains neutral. Keep the intensity
basis and actual-duration label visible. Present likely intent separately from
recorded measurements and user-confirmed intent; supporting repetitions belong
in a disclosure with a locally scrolling table on narrow screens. Reuse shared
actions and fields for confirmation.

- Home uses `HomeTrainingReadouts` for separate Scheduled and Completed summaries
  and the latest four activity loads. Show estimated TSS numerically and use
  proportional bar heights; unavailable values use an em dash and explanatory
  text, while valid zero has no positive-height bar. Each chart item links to its
  outcome with title/date/load in its accessible name. Last activity includes
  date, source and an outcome link. Never call these estimates a fitness trend
  or call an empty date a planned rest day.

- `SessionRow` is the shared workout-card unit across Calendar, Planner, and
  session lists. Focus Home's week ledger and Workouts' library cards use
  their own compositions over the same data and `SessionBlockBar` language.
  `default` includes metrics and the timeline, `compact`
  preserves essential context for a week wall, `calendar` uses a shorter
  timeline for stacked same-day entries, and `month` shows only what a month
  grid can support.
- Coach Planner month cells preview one session on a single row, with a short
  zone-colored swatch beside its title. The swatch color represents the rounded,
  duration-weighted average intensity zone; pause time is excluded. Below
  600px container width they show counts instead. Athlete month calendar cells
  show up to two single-line session titles, then a remaining-session count;
  narrow month cells retain a selectable date button and session count, with
  full details in the selected-day agenda. Calendar week and month rows
  use the same zone swatch immediately before the session title; week rows retain
  their session details and recorded heart-rate timeline.
- Home's current day uses a quiet tinted row; personal Calendar uses a
  brand-tinted full-day surface. Selected Calendar dates use the field surface
  and selected border; keep the current-day tint identifiable during selection.
  Planning Desk marks today on the numeral; selected dates use a tinted
  full-day surface and inset brand frame, including when today is selected.
- `SessionBlockBar` uses duration-proportional segments. Segment height and
  color follow the target within its zone when a percentage is available. Its
  accessible label carries the zone and block information in text.
- Imported sessions in the week Calendar use `ActivityIntensityBars` when
  heart-rate samples are available. Equal-width, minute-aligned bins follow the
  recorded session duration and widen only for long activities to cap the chart
  at 48 bars. Bar height follows the recorded heart-rate range, and saved HRmax
  enables Olympiatoppen zone colors. Without HRmax, the chart stays neutral
  and does not imply calibrated zones. Missing samples remain visible as gaps.
  Calendar rows keep average bpm visible and move bin duration into the chart's
  accessible label; hover text carries each bin's time, average, and
  range. Month rows keep their title-only summary.
- `ActivityMetricBars` keeps recorded heart rate, pace/speed, power, cadence,
  temperature, elevation, and grade in a bar-based visual language. Time-based
  metrics use one-minute buckets (five minutes for temperature); terrain uses
  50 m distance buckets and widens only to cap a long chart. Pace omits
  near-stationary readings below 0.5 m/s, averages from the underlying speeds,
  and scales bars to the central 90% of samples so outliers do not flatten the
  chart. Faster pace intervals still use taller bars; the interval table keeps
  the accepted sample range. Each chart has average/range context and an
  expandable interval table so the graph is not the only way to read values.
- Session detail uses a compact structure overview. Fold identical consecutive
  efforts/recoveries and repeated sets, retaining explicit warm-up/cool-down,
  repeat counts and whether recovery follows the final effort. The diagram is
  a structure schematic; it does not imply a duration-proportional full timeline.
  Selecting an effort or pause reveals its target, duration and notes below.
  Details start collapsed, keep keyboard/touch controls, and expose every
  original block through the inspector selector. Different instructions and
  skipped blocks must remain distinct. Resolve relative targets from Profile
  and retain the reference alongside the resolved value.
  For imported FIT and Strava sessions, recorded sensor charts follow the workout
  overview so the athlete can compare planned structure with measured activity.
  An import without a matched workout uses a single-column activity overview
  with recorded duration and load, followed by its available measurements and
  any saved activity notes. It omits plan-only context and the empty plan
  canvas and block list.
- `StatusBadge` shows planned, adjusted, or missed text states. Completed work
  does not need a repeated completed badge.
- `MetricText` provides tabular numerals. `Stepper` owns ordered live execution
  and `Toggle` owns switch semantics and its focus treatment.

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
  unrelated developer-only `/design/*` experiments. Monolith is the sole
  production direction.
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

Incomplete personal training targets appear in an inline, neutral-surface section
above Today. Keep the Monolith treatment: a restrained cobalt outline and icon,
shared field and button classes, rounded surface corners, and wrapping controls.
Choose sports first, then maximum heart rate, then only the selected sports'
targets. Show calculated heart-rate and running-pace previews beside their inputs;
identify running estimates as estimates and disclose manual pace bounds on demand.
Keep units and optional values explicit. Narrow layouts stack paired fields and
retain readable zone labels and keyboard focus.

Each successful step saves through Profile and announces the result. Preserve
entries on failure, distinguish unsaved edits, and offer Continue later with a
discard safeguard. Unknown values may remain blank and keep setup incomplete;
never require guesses. Once the selected sports' targets and maximum heart rate
are saved, hide the setup section and leave subsequent editing in Profile.


### Personal training templates

Use the established Monolith surfaces and shared controls. Personal Templates
is a routine composer, using existing library workouts rather than the block
editor. Keep name and optional purpose together, followed by one saved-workout
picker with multi-weekday selection and an ordered Monday–Sunday outline.
Days without entries say No workout. Multiple entries expose accessible reorder
and remove controls; at narrow widths their actions wrap below the workout
selector. Show save failures beside Save and retain the draft. Cancelling or
leaving the browser requires an unsaved-change safeguard.

The library previews weekday workout names, session count and week/month reuse.
Apply to Calendar carries the chosen template into scheduling. Routine application
offers One week or Whole month, an explicit full date range and the actual dated
workout list/count before saving. Explain that existing sessions remain, empty
days add nothing, relative targets use Profile and fixed targets remain fixed.
Templates have one routine model. Do not expose cadence controls, workout block
authoring, single-workout template loading or public Save as Template intake.
