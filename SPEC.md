# Workout Planner Product Spec

This document captures the **product direction** for the app. For the current implementation shape, read `ARCHITECTURE.md`. For a fast AI-oriented summary, read `docs/AI-HANDOFF.md`.

## Product goal

Replace spreadsheet-based weekly training planning with a purpose-built workflow for coaches and athletes.

## Current product state

The app already ships these core behaviors:

- Real authentication with Auth.js, credentials login/signup, and optional Google sign-in
- Coach and athlete role-based entry points
- Coach roster, athlete detail, builder assignment, and coach-request handling
- Coach-owned private templates with structured workout blocks and builder handoff
- Athlete coach-request onboarding plus Tempo Home, Calendar, Session, Live, Activity, and Settings surfaces
- Session completion persisted as activity/compliance data derived from structured blocks

## Current scope

### Roles

- **Coach:** manages athlete relationships, creates plans, manages templates
- **Athlete:** requests a coach, reads the plan, marks sessions complete, adds notes

### Planning model

- Training remains Monday-aligned even as the UI expands beyond a single week view.
- Plans group athlete training windows and optional goal races.
- Sessions derive duration, TSS, and zone distribution from structured blocks.
- Coaches schedule templates onto athlete calendars through the builder.

### Activity types

- Running
- Biking
- Swimming
- Strength
- Stretching
- Rest

### UX shape

- Coach workflow centers on roster -> athlete detail -> builder -> templates.
- Athlete workflow centers on Home -> Calendar -> Session/Live -> Activity.
- Session and template editing still use shared drawer/block-editor patterns.

## Near-term roadmap

These are the strongest next moves for the product and codebase:

1. Add automated test coverage around auth guards, planner behavior, template behavior, and the coach dashboard read model.
2. Remove the remaining unused week-planner-era code paths once all Tempo surfaces have replacement coverage.
3. Keep improving athlete onboarding, pending-request visibility, and cross-role navigation polish.

## Product principles

- Keep coach planning fast and readable.
- Keep athlete consumption simple and low-friction.
- Prefer structured session content over freeform long text.
- Derive metrics from structured blocks instead of duplicating them across surfaces.
- Reuse templates and builder assignment flows before introducing heavy recurrence features.
- Preserve a small MVP surface rather than expanding into analytics or collaboration too early.

## Non-goals for this version

- Multi-coach collaboration
- Shared business/workspace accounts
- Full recurring-session rules
- Full month-planner editing
- Deep analytics or performance dashboards
- Multi-device live coaching or messaging
- Custom sport definitions

## Notes for future planning

- `prisma/schema.prisma` is the source of truth for the actual shipped data model.
- `ARCHITECTURE.md` is the source of truth for where code should live.
- `docs/AI-HANDOFF.md` should stay the fastest entry point for future AI contributors.
