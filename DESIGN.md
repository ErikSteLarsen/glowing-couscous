---
name: Tempo
description: A calm, week-first endurance training workspace for athletes and coaches.
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
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  display:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.1
  label:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  control: "7px"
  surface: "10px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.active-signal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    height: "44px"
  session-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: Tempo

## Visual Direction

Tempo is an operational training surface organized around the Monday-to-Sunday
week. It should feel calm, readable, and fast under repeated use. The light
paper canvas, flat white work surfaces, thin rules, and one blue action signal
keep dense schedules legible without turning training into a game board.

## Color Rules

- `#155EEF` is the active signal for primary actions, selected context, links, and current-day emphasis.
- `#F4F6F7` is the page canvas. `#FFFFFF` is a focused surface. `#E8EDF0` is recessed structure and field contrast.
- `#17232B` is primary ink. `#435560` and `#5D6D75` are supporting text and muted labels.
- Green, amber, violet, and red explain completion, adjustment, missed, warning, and danger states.
- Never communicate a state with color alone. Pair it with text, structure, or an accessible label.

## Type and Layout

Schibsted Grotesk is the display, body, and label family. Metrics, durations,
dates, and counts use tabular numerals. Headings state the route or task plainly;
decorative eyebrow labels are not required.

The week is the primary composition on Home and Calendar, the scheduled context
on Workouts and Session, and the assignment target in Planner. Desktop uses a
viewport-bounded sidebar with local overflow. Mobile uses a four-item bottom
navigation and a drawer for secondary destinations. Preserve Monday-first order
at every breakpoint.

## Surfaces and Controls

- Keep ordinary surfaces flat. Reserve shadows for drawers, menus, and overlays.
- Use one-pixel semantic borders and restrained corners: 7px for controls and rows, 10px for larger surfaces.
- Default controls should reach a 44px touch target and expose a visible focus ring.
- Primary actions use the active signal. Secondary actions use white surfaces with borders. Destructive actions use the danger tint and confirmation where loss is possible.
- Loading, empty, error, permission, and success states sit beside the task that produced them.

## Workout Cards

`SessionRow` is the shared workout-card unit across Home, Calendar, Workouts,
and week surfaces. Reuse its variants instead of creating route-specific card
grammars:

- `default` shows title, context, metrics, target, and block structure for roomy lists.
- `compact` shows the essential context and intensity timeline on the week wall.
- `month` shows only title and sport so the month grid remains scannable.

Cards are whole keyboard-focusable links when they navigate. The action should
not be repeated inside the same link. Completed work can be muted by its caller
but does not need a repeated completed badge.

`SessionBlockBar` keeps duration-proportional segments. On card and compact
variants, segment color signals zone and height rises from Zone 1 to Zone 5. The
timeline is a compact reading aid, not a chart panel.

## Editing and Accessibility

Reuse `WorkoutBuilder`, `WorkoutBlocksEditor`, `CoachEditorDrawer`, `StatusBadge`,
`MetricText`, `SessionRow`, and `SessionBlockBar` before adding new primitives.
Structured blocks must remain editable without drag-and-drop being the only
reordering mechanism. Preserve keyboard focus, readable contrast, explicit
labels, reduced-motion behavior, and mobile save actions.
