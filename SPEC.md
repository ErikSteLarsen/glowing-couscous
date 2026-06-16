# Workout Planner Product Spec

This document captures the **product direction** for the app. For the current implementation shape, read `ARCHITECTURE.md`. For a fast AI-oriented summary, read `docs/AI-HANDOFF.md`.

## Product goal

Replace spreadsheet-based weekly training planning with a purpose-built workflow for coaches and athletes.

## Current product state

The app already ships these core behaviors:

- Real authentication with Auth.js, credentials login/signup, and optional Google sign-in
- Coach and athlete role-based entry points
- Coach dashboard with roster status and coach-request handling
- Coach week planner with weekly notes, session editing, and copy-previous-week behavior
- Coach-owned private templates with structured workout blocks
- Athlete coach-request onboarding, week view, and session completion notes

## Current scope

### Roles

- **Coach:** manages athlete relationships, creates plans, manages templates
- **Athlete:** requests a coach, reads the plan, marks sessions complete, adds notes

### Planning model

- The app is week-first, not month-first.
- Weeks start on Monday.
- Each week can have a weekly note.
- Sessions contain structured blocks such as warmup, main set, cooldown, intervals, reps, rest, and note content.

### Activity types

- Running
- Biking
- Swimming
- Strength
- Stretching
- Rest

### UX shape

- Coach planning uses a compact week strip plus focused day detail.
- Session editing uses a slide-over / drawer pattern.
- Athlete view prioritizes clarity over dense planning controls.

## Near-term roadmap

These are the strongest next moves for the product and codebase:

1. Add automated test coverage around auth guards, planner behavior, template behavior, and the coach dashboard read model.
2. Add lightweight coverage around the new pure utility modules that shape weeks and sport labels.
3. Keep improving athlete onboarding, pending-request visibility, and cross-role navigation polish.

## Product principles

- Keep coach planning fast and readable.
- Keep athlete consumption simple and low-friction.
- Prefer structured session content over freeform long text.
- Reuse templates and copy-week flows before introducing heavy recurrence features.
- Preserve a small MVP surface rather than expanding into analytics or collaboration too early.

## Non-goals for this version

- Multi-coach collaboration
- Shared business/workspace accounts
- Full recurring-session rules
- Month-planner editing
- Deep analytics or performance dashboards
- Detailed performed metrics beyond completion and notes
- Custom sport definitions

## Notes for future planning

- `prisma/schema.prisma` is the source of truth for the actual shipped data model.
- `ARCHITECTURE.md` is the source of truth for where code should live.
- `docs/AI-HANDOFF.md` should stay the fastest entry point for future AI contributors.
