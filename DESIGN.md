---
name: Tempo
description: A week-first endurance training workspace for athletes and coaches.
colors:
  active-signal: "#155EEF"
  active-signal-tint: "#EAF1FF"
  paper: "#F4F6F7"
  surface: "#FFFFFF"
  sunken: "#E8EDF0"
  border: "#C8D3D9"
  ink: "#17232B"
  ink-secondary: "#435560"
  ink-muted: "#5D6D75"
  nav-surface: "#F8FAFB"
  success: "#2D6A4F"
  warning: "#8A5A13"
  danger: "#9C3D35"
  missed: "#6A4D8F"
typography:
  label-xs:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.35
  label-sm:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.35
  label:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.35
  label-md:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
  body-xs:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  display:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  title-sm:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.1
  headline:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.1
  label-lg:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  sm: "7px"
  md: "10px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.active-signal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "44px"
  session-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: Tempo

## Overview

**Creative North Star: "The Training Calendar Wall"**

Tempo is an operating surface organized around the Monday-to-Sunday training
week. The week is the shared object connecting coach planning, athlete
execution, completion, and history. It should feel familiar at first glance,
fast under repeated use, and calm when the schedule is dense.

The system uses aligned day and session groupings, compact measurable metadata,
and one decisive current/action signal. Planning and exception states can be
explicit when they help the next decision; completed work is communicated by
history, metrics, and restrained muting rather than a repeated status badge.
Desktop exposes
parallel day groups only at wide enough widths; intermediate layouts use fewer
columns, and mobile preserves the same order as a focused sequence. Visual
emphasis communicates training state and next action, never gamification.

**Key Characteristics:**
- Monday-first hierarchy with a visible current week
- One clear next action before secondary metrics
- Text-visible planned, adjusted, missed, loading, and error states; completed
  work uses outcome/history context instead of a status badge
- Shared session-row, status, metric, and block-structure grammar
- Light work surface with restrained depth and strong keyboard focus

## Colors

The palette is light, high-contrast, and functional: ink and paper form the
working surface, the blue active signal marks current/action context, and muted
state colors explain training meaning without competing for attention.

### Primary
- **Active Signal** (`#155EEF`): Primary actions, current day, selected context, and links that move the athlete or coach forward.
- **Active Signal Tint** (`#EAF1FF`): Selected day and contextual grouping behind the active signal.

### Secondary
- **Completed Green** (`#2D6A4F`): Completed state and positive confirmation.
- **Adjusted Amber** (`#8A5A13`): Planned changes and attention without treating adjustment as failure.
- **Missed Violet** (`#6A4D8F`): Missed state, always paired with visible text.

### Neutral
- **Paper** (`#F4F6F7`): Page canvas and quiet workspace background.
- **Surface** (`#FFFFFF`): Focused content surfaces and rows.
- **Sunken** (`#E8EDF0`): Structure bars, field contrast, and recessed regions.
- **Border** (`#C8D3D9`): Rules and grouping, not decoration.
- **Ink** (`#17232B`): Headings, primary actions, and high-priority content.
- **Secondary Ink** (`#435560`): Supporting copy and metadata.
- **Muted Ink** (`#5D6D75`): Secondary labels that still need normal-text contrast.

**The One Signal Rule.** The active signal owns attention. Status colors explain
what happened; they do not compete with the current day or next action.

## Typography

**Display Font:** Schibsted Grotesk (with system sans-serif fallback)
**Body Font:** Schibsted Grotesk (with system sans-serif fallback)
**Label Font:** Schibsted Grotesk with tabular numerals for metrics.

The type system is compact, legible, and operational. Headings carry their own
weight; the interface does not depend on decorative eyebrow labels above them.

### Hierarchy
- **Display** (600, 26px, 1.1, -0.02em): Page titles and primary route identity.
- **Headline** (600, 20px or 22px, 1.1): Week and section titles.
- **Title** (600, 15px or 18px, 1.3): Session names, card headings, and actions.
- **Body** (400, 13px, 13.5px, 14px, or 15px, 1.5–1.55): Explanations, notes, and supporting content.
- **Label** (600, 10px, 10.5px, 11px, or 12px, 1.35, tracked where uppercase): Dates, status, and compact metadata.

**The Measurement Rule.** Duration, TSS, RPE, dates, and counts use tabular
numerals and align as data, not prose.

## Layout

The authenticated shell reserves a responsive navigation region and a fluid
work surface. Page shells provide narrow, default, wide, and wall tiers. The
wall tier supports the seven-day composition only at very wide widths; before
that point, day groups reflow into two or three columns. Mobile uses a vertical
Monday-first sequence with persistent day headings and bottom navigation.

The week is the primary composition on Home and Calendar, the context strip on
Session and Live, the lead scheduled section on Workouts, and the assignment
target in coach planning. Secondary authoring, history, and comparison surfaces
remain subordinate to the current operational task.

## Elevation & Depth

Depth is primarily tonal. Rules, alignment, selected tints, and spacing carry
the week wall; shadows are reserved for overlays and small menus. Surfaces are
flat at rest so a page does not become a stack of floating cards.

### Shadow Vocabulary
- **Raised** (`0 1px 2px rgba(23, 35, 43, 0.06), 0 5px 16px -12px rgba(23, 35, 43, 0.18)`): Small elevated contexts where separation is needed.
- **Overlay** (`0 20px 45px -18px rgba(23, 35, 43, 0.28)`): Drawers, menus, and protected overlays only.

**The Flat-By-Default Rule.** A surface does not earn a shadow merely because
it is a container; elevation communicates a state or overlay.

## Shapes

Corners are restrained and purposeful: 7px for controls and rows, 10px for
surfaces, and 12px only where a larger grouping needs a softer boundary. Borders
are thin and semantic. Day columns and session rows carry the composition more
often than rounded containers.

## Components

### Buttons
- **Shape:** compact corners (7px) with 44px standard touch height and 36px compact desktop height.
- **Primary:** active-signal background, white text, clear hover contrast, and visible focus ring.
- **Secondary:** surface background with border; hover strengthens the border and field contrast.
- **Ghost:** low-chrome text action for navigation and secondary context.
- **States:** pending actions disable and change their label; destructive actions use a semantic danger tint and confirmation where needed.

### Chips
- **Style:** rounded-full with a thin border, tonal background, and visible text.
- **State:** status chips use planned, adjusted, missed, and warning roles; completed work does not render a status chip, and color never carries the state alone.

### Cards / Containers
- **Corner Style:** 10px for shared surfaces; 7px for session rows.
- **Background:** surface for focused content, field-surface for quiet controls, paper for the page.
- **Shadow Strategy:** flat by default; use overlay depth only for menus/drawers.
- **Border:** one-pixel border or rule for grouping.
- **Internal Padding:** 16–20px for surfaces, 10–12px for dense rows.

### Inputs / Fields
- **Style:** light field surface, semantic border, 8–10px corners, readable 44px default height.
- **Focus:** active-signal border and visible two-pixel focus ring with page-color offset.
- **Error / Disabled:** errors use danger text/tint and recovery guidance; disabled controls remain readable and explain pending state through their label.

### Navigation
- **Style:** light navigation surface with ink labels, muted secondary copy, active-signal marker/tint, and `aria-current` on the active route.
- **Desktop:** viewport-bounded sidebar with local overflow.
- **Mobile:** bottom navigation for the role’s four highest-frequency destinations plus a modal drawer for the rest; drawer focus is isolated and restored on close.

### Workout Card / Session Row

`SessionRow` is the shared workout-card unit across athlete Home, Calendar,
Workouts, and week surfaces. It carries title, date/time context, sport,
duration, TSS, target, block structure, and one contextual action in a
predictable order. Use its space-aware variants instead of rebuilding a
route-local workout tile:

- **`default`** — the full card for Workouts and other roomy lists; uses the
  supplied card reference's larger title/context/metrics and block structure.
  The card does not render a status badge; completed work can still be muted by
  the caller, and the whole card is the link so it does not repeat an `Open
  session` action.
- **`compact`** — the week-wall card for Home and Calendar; keeps the title,
  context, compact intensity timeline, and metrics while omitting the repeated
  action.
- **`month`** — the calendar-cell card; keeps only the title and sport so the
  month grid stays scannable, while the accessible name retains full workout
  context.

All variants remain one whole keyboard-focusable link with the same hover/focus
grammar. Completed work is muted by the caller where density requires it, never
communicated by color alone.

`SessionBlockBar` keeps the full-detail structure timeline at its original
height. Its card and compact sizes use a short, duration-proportional intensity
timeline: color remains the zone signal and each segment rises from Zone 1 to
Zone 5, making session effort scannable without turning a calendar card into a
chart panel. The card bars are transparent, cap at a compact reading width, and
use 32px/24px card/compact heights so the zone silhouette remains legible. The
intensity segments have square edges to avoid clipped-looking short bars.

Coach oversight cards and editor-library entries remain specialized when they
need comparison/share controls or an in-place editing affordance; they should
reuse the same `SessionBlockBar` and metric grammar rather than duplicate a
scheduled workout card.

## Do's and Don'ts

### Do:
- **Do** show the week, current day, and next action in one context; use status
  text only for planned, adjusted, or missed work when it helps the decision.
- **Do** reuse `SessionRow`, `StatusBadge`, `MetricText`, and `SessionBlockBar` before inventing a route-local session grammar.
- **Do** darken supporting text enough for normal-text contrast and preserve visible keyboard focus.
- **Do** preserve Monday boundaries, source ownership, snapshot independence, and role-specific API/service seams.
- **Do** keep loading, empty, error, permission, and success states next to the task that produced them.

### Don't:
- **Don't** return to the navy split-board or generic card-grid dashboard as the default composition.
- **Don't** make every bordered region a floating card or every secondary action equally prominent.
- **Don't** use color alone to communicate planned, completed, adjusted, missed, loading, error, or permission states.
- **Don't** hide dates, ownership, or assignment scope when a session is detached from its week column.
- **Don't** use drag-and-drop as the only way to reorder structured workout blocks.
