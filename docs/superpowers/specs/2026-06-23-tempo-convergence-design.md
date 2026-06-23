# Tempo convergence design

## Goal

Bring the existing app into alignment with the canonical Tempo design package in `fitness-coaching-platform-design/` while preserving working auth/session integration and replacing the current planning data model with the Tempo model.

## Source of truth

The target is defined by:

1. `fitness-coaching-platform-design/README.md`
2. `fitness-coaching-platform-design/Tempo Handoff Spec.dc.html`
3. `fitness-coaching-platform-design/Tempo Design System.dc.html`
4. `fitness-coaching-platform-design/Tempo App.dc.html`
5. `fitness-coaching-platform-design/Tempo Mobile.dc.html`
6. `fitness-coaching-platform-design/Tempo Coach.dc.html`

If the current app conflicts with those references, the Tempo design wins unless that would break auth or remove non-schema functionality without review.

## Current-state gap summary

What already aligns:

- Auth.js-backed login/session handling exists and should remain.
- The app already separates athlete and coach roles.
- Core mutations are already routed through service modules instead of direct route-handler Prisma logic.
- There are reusable editing primitives that can be refactored instead of rewritten from scratch.

Main gaps:

- The current UI uses a dark, blue-accented design system rather than Tempo's paper/surface/sage token system.
- The current information architecture does not match Tempo. It lacks athlete Home, Calendar, Activity, Session detail, Live execution, and coach Builder routes as first-class screens.
- The current shell is sidebar-plus-overlay only; it does not collapse into the Tempo bottom tab bar below 768px.
- The current schema is week-centric (`AthleteProfile`, `PlanWeek`, `PlannedSession`, text-only `SessionBlock`) rather than the Tempo `User / Plan / Session / Block / Template / Activity / Assignment` model.
- Duration, intensity, and structure are currently partly stored as top-level session fields instead of being derived primarily from structured blocks.
- Current coach planner and template flows are form-driven instead of using the shared block-bar, stepper, assignment, and status patterns defined by Tempo.

## Recommended implementation approach

Use a foundation-first convergence:

1. Replace the schema and local data model with the Tempo model.
2. Add exact Tempo tokens and typography to the theme.
3. Build the shared Tempo primitives once.
4. Migrate screens in product order so the app remains reviewable between steps.

Alternatives rejected:

- Retrofitting the new UI on the old schema would create adapter-heavy code and fight the canonical target.
- Doing backend-only work first would keep the product visually and behaviorally divergent for too long.

## Architecture and route design

### Shell

- Replace the current dark shell with a Tempo shell using paper background, white surfaces, hairline borders, sage active states, and Schibsted Grotesk.
- Desktop (`>= 768px`) uses the left sidebar.
- Mobile (`< 768px`) uses the bottom tab bar pattern from the Tempo references.
- All metric text uses tabular numerals.

### Athlete routes

- `/athlete` -> Home
- `/athlete/calendar` -> Calendar with week/month views
- `/athlete/session/[sessionId]` -> Session detail and adjustment
- `/athlete/live/[sessionId]` -> Live execution
- `/athlete/activity` -> Activity history and compliance
- `/settings` -> Settings, including Overview card toggles

Profile/account controls may stay available through the existing profile surface, but Settings becomes the primary Tempo-aligned preferences area.

### Coach routes

- `/coach` -> Roster
- `/coach/athletes/[athleteId]` -> Athlete detail
- `/coach/builder` -> Plan builder plus assignment
- `/coach/templates` -> Template library

### Service boundaries

Keep the current pattern of API handlers delegating into `lib/` services. Extend it with Tempo-aligned responsibilities:

- session derivation helpers for duration, TSS, compliance, and zone totals
- assignment service logic for coach-to-athlete scheduling
- screen loaders shaped to Tempo screens rather than week-planner-only views

## Data model

The new Prisma schema should align to these entities:

```ts
User {
  id
  email
  name
  role: 'athlete' | 'coach'
  selfCoached: boolean
  coachId?
  prefs: { overviewCards: string[] }
}

Plan {
  id
  athleteId
  name
  startDate
  endDate
  goalRace?
}

Session {
  id
  athleteId
  planId?
  templateId?
  date
  time?
  sport
  status: 'planned' | 'completed' | 'missed'
  source: 'self' | 'coach'
  adjusted: boolean
  assignedById?
}

Block {
  id
  sessionId?
  templateId?
  kind: 'warmup' | 'work' | 'recovery' | 'cooldown'
  zone: 1..5
  durationSec
  reps?
  targetType?: 'power' | 'pace' | 'hr'
  targetLow?
  targetHigh?
  sortOrder
}

Template {
  id
  ownerId
  name
  sport
}

Activity {
  id
  sessionId
  athleteId
  completedAt
  durationSec
  tss
  compliancePct
  zoneDistributionJson
}

Assignment {
  id
  sessionId
  athleteId
  assignedBy
  assignedDate
}
```

### Derivation rules

- Session duration is derived from `blocks`.
- Session TSS is derived from `blocks`.
- Block-bar geometry is derived from `blocks`.
- Compliance is derived by comparing activity actuals against planned block-derived expectations.
- Zone color is always paired with a textual zone label or zone name.

### Migration rule for this convergence

The existing planner data model and demo data may be replaced directly. Auth/account integration stays intact.

## Design tokens

Add exact Tempo tokens to the theme and use them as the only active design language in migrated areas:

### Neutrals and brand

- `paper` `#F3F2EE`
- `surface` `#FFFFFF`
- `sunken` `#ECEAE4`
- `border` `#E6E2DB`
- `ink-3` `#9C968B`
- `ink-2` `#6A655C`
- `ink` `#232220`
- `sage` `#6E7E63`
- `sage-tint` `#E9ECE3`

### Status

- `completed` text `#1B7A3D`, bg `#E3F7EC`
- `adjusted` text `#B45516`, bg `#FEEDE0`
- `missed` text `#2B6CB0`, bg `#E8F0FE`
- `planned` text `#57654E`, bg `#E9ECE3`

### Zones

- `Z1` `#3B82F6` / `#E8F0FE`
- `Z2` `#22C55E` / `#E3F7EC`
- `Z3` `#EAB308` / `#FBF1D5`
- `Z4` `#F97316` / `#FEEDE0`
- `Z5` `#EF4444` / `#FCE8E7`

### Typography

- Schibsted Grotesk
- display `30-44 / 700 / -3%`
- title `22-26 / 600 / -2%`
- heading `17-18 / 600`
- body `14-15 / 400 / 1.55`
- small `12.5-13 / 500`
- label `11 / 600 / +10%`
- tabular figures on all metrics

### Spacing / radius / elevation

- spacing `4 8 12 16 24 32 48`
- radius `8 input / 12 card / 16 modal / 999 pill`
- raised `0 6px 20px -8px rgba(35,34,32,.14)`
- overlay `0 24px 50px -18px rgba(35,34,32,.22)`

## Shared components to build first

Create or refactor these as shared Tempo primitives before screen migrations:

- `SessionBlockBar`
- `StatusBadge`
- `Stepper`
- `CalendarDayCell`
- `SessionChip`
- `NavItem`
- `SegmentedControl`
- `Toggle`
- tokenized shell/button/input/surface primitives
- metric typography helpers for tabular numbers

### Signature component: SessionBlockBar

- Horizontal flex row
- each block segment uses `flex-grow = duration`
- segment color uses zone solid color
- `2px` gaps
- `8-9px` container radius
- reused in athlete Home, Session detail, coach Builder, and Templates

## Screen migration plan

Screens should land in this order:

1. shell + tokens
2. athlete Home
3. athlete Calendar, with week/month on desktop and agenda treatment on mobile
4. athlete Session detail + adjustment
5. athlete Activity
6. Settings -> Overview toggles
7. mobile Live execution
8. coach Roster
9. coach Athlete detail
10. coach Builder + Assign
11. coach Templates

### Definition of done per screen

- visually matches the reference
- uses Tempo tokens only
- responsive shell behavior works
- empty/loading/error/skeleton states exist
- touch targets meet 44px minimum where relevant
- zone colors always include labels
- no new one-off hard-coded colors in migrated areas

## Behavior and cleanup rules

- Preserve auth and route protection.
- Do not silently remove working features beyond the approved schema reset.
- Refactor repeated draft/block logic into clearer shared helpers as the Tempo components are introduced.
- Remove obsolete dark-theme-specific primitives once their consumers are migrated.
- Keep feature logic behind service boundaries rather than pushing business logic into route handlers or view components.

## Validation focus

Target validation should cover:

- schema generation and seed flow after the reset
- route rendering for each migrated screen
- derived session math from block data
- assignment creation for coach-built sessions
- overview preference persistence
- responsive shell behavior at the sidebar-to-tab-bar breakpoint

## Delivery note

This convergence is too large for a single blind rewrite. It should be implemented as an ordered series of working, reviewable screen migrations on top of a shared Tempo token and component foundation.
