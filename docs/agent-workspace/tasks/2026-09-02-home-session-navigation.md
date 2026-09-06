# Task: Home session navigation

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-09-02`
- **Updated:** `2026-09-02`
- **Feature IDs:** `ATHLETE-001`
- **Related records:** [athlete](../features/athlete.md), [history](../history/2026-09-02-home-session-navigation.md)

## Goal

Allow athletes to open every session shown for an upcoming day on Home and view
that session's existing detail route, including when a day has multiple sessions.

## Starting Context

- Current behavior: Home shows only the first upcoming session for each day; today's sessions already have individual Open links.
- Existing owner/service: `lib/athlete-service.ts` owns the Home dashboard read model; `/athlete/session/[sessionId]` owns detail rendering.
- Related active or transitional work: `SESSION-ADJUST-001` owns the existing session detail editor and must remain unchanged.

## Plan

- [x] Keep every upcoming day's session in the Home dashboard read model.
- [x] Render each upcoming session as an individual detail link and add regression coverage.
- [x] Run focused tests and repository gates, then update feature/workspace records.

## Progress Log

### 2026-09-02

- What changed: Registered the Home navigation gap after confirming the Calendar already has the required per-session link behavior.
- Decision or discovery: The minimal extension is to change `nextDays` from one optional session to a session list; no new route or service boundary is needed.
- Files touched: `docs/agent-workspace/tasks/2026-09-02-home-session-navigation.md`, `docs/agent-workspace/features/athlete.md`, `docs/agent-workspace/WORK-INDEX.md`.
- Verification: Source inspection completed; implementation verification pending.
- Blocker or next step: Update the Home dashboard shape and UI, then test multiple sessions on one day.

### 2026-09-02

- What changed: Home now retains all sessions for each upcoming day and renders today and upcoming sessions as individual links to `/athlete/session/[sessionId]`.
- Decision or discovery: The existing athlete session detail route is the correct destination; no new route or data model is required.
- Files touched: `lib/athlete-service.ts`, `app/(app)/athlete/page.tsx`, `tests/athlete-calendar.test.ts`, and the athlete workspace records.
- Verification: Focused athlete tests — 7 passing; `pnpm test` — 168 passing; `pnpm lint`, `pnpm build`, and `git diff --check` — pass. Build retains the existing middleware deprecation warning.
- Blocker or next step: None for this task.

## Verification

- `pnpm exec node --experimental-strip-types --test tests/athlete-calendar.test.ts` — 7 passing on 2026-09-02.
- `pnpm test` — 168 passing on 2026-09-02.
- `pnpm lint` — passed on 2026-09-02.
- `pnpm build` — passed on 2026-09-02; existing middleware deprecation warning remains.
- `git diff --check` — passed on 2026-09-02.

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [Home session navigation](../history/2026-09-02-home-session-navigation.md)
- **Feature records updated:** [athlete](../features/athlete.md), [work index](../WORK-INDEX.md)
- **Remaining work:** None.
