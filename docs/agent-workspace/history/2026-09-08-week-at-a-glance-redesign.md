# Week-at-a-glance redesign — 2026-09-08

## What changed

- Replaced the incumbent navy split-board visual world with a light,
  high-contrast Training Calendar Wall system centered on the Monday-first week.
- Documented and extracted the shared system in `DESIGN.md`,
  `.impeccable/design.json`, `.impeccable/surfaces/authenticated-app.md`, and
  the agent-workspace design inventory.
- Reworked shared shell/tokens/primitives: action signal, semantic statuses,
  calmer surfaces, wall width tier, intentional mobile destinations, safe-area
  padding, reduced motion, focus recovery, status summaries, and keyboard block
  reordering.
- Redesigned athlete Home/Calendar around Next action, a seven-day week wall,
  aligned session rows, explicit state, retryable async feedback, and month
  status semantics.
- Carried week/date/status context into athlete Workouts/Session/Live/Activity;
  made scheduled work lead Workouts, made Session actions state-derived, and
  improved completion/history recovery feedback.
- Reworked athlete Planner/Templates/coach discovery clarity and reliability:
  selected-day summaries, save/delete recovery, role-specific template actions,
  labelled search, announced feedback, and a private-planning pending path.
- Reworked coach roster/detail/Planner/Source Assignment: direct planning
  handoffs, empty state, reliable next-session selection, aligned athlete weeks,
  synchronized assignment athlete state, specific assignment confirmation, and
  recoverable Planner mutations.

## Files

The implementation spans the authenticated route families under `app/(app)`,
shared UI under `components/`, read models in `lib/athlete-service.ts` and
`lib/coach-service.ts`, shared styles in `app/globals.css`, tests, and the
Impeccable/workspace records. See the active task for the complete coordination
map.

## Verification

- `pnpm test` — 175 passing.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing middleware-to-proxy deprecation warning remains.
- `git diff --check` — pass.
- Final Impeccable detector over changed production UI targets — `[]`.
- Browser viewport acceptance — not run; no connected desktop browser.

## Follow-up

- Run manual browser acceptance at mobile, intermediate, and wide desktop viewports.
- Decide whether to fund the remaining Coach Planner workflow consolidation,
  comparison focus/delta work, and route-level loading/error boundaries.
- Keep public sharing browser acceptance and existing reliability gaps visible.

## Finish verification — 2026-09-08

- The connected OpenCode desktop-browser bridge remained unavailable, but local
  headed Chrome on `DISPLAY=:0` was available through CDP and provided real
  pointer/hover media. Authenticated athlete and coach route families were
  reviewed at 1440×1000, 1024×900, and 390×844; dense scheduled Calendar,
  completed Session, Live stepper, roster/detail, Workouts, Planner, and
  Templates states were included.
- Responsive checks found no horizontal overflow, console errors, or sub-32px
  visible interactive targets after adding `min-w-11` and the shared focus ring
  to the calendar day-focus buttons in
  `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`.
- Mobile drawer open/close, focus isolation, Tab cycling, Escape recovery, and
  focus restoration passed. Hover styles changed on the headed session, and
  key ink/action/status token combinations measured at or above 4.95:1.
- `pnpm test` (175), `pnpm lint`, `pnpm build`, `git diff --check`, and the
  Impeccable detector (`[]`) pass. The build retains the existing middleware
  deprecation warning.
- Public share-link acceptance and deeper planned-edit/actual/comparison
  mutation coverage remain explicit follow-up work; they are not inferred from
  this route-level finish review.

## Final acceptance correction — 2026-09-08

- Local headed Chrome was launched on `DISPLAY=:0` with CDP at
  `http://localhost:3002` because the connected OpenCode browser bridge was
  unavailable. Athlete Home, Calendar week/month, Workouts, Session, Live,
  Activity, Planner, Templates, discovery, coach roster/detail, Workouts,
  Templates, and Planner were inspected at `390x844`, `1280x900`, `1440x1000`,
  and `1920x1080`; the route matrix contained 64 states.
- Runtime evidence found no horizontal overflow, runtime exceptions, or console
  errors. Mobile drawer focus stayed contained during ten Tab cycles, Escape
  closed the drawer, focus returned to `Open menu`, and athlete/coach permission
  redirects behaved as expected. Dense scheduled content used the seeded prior
  Monday week; the current week empty/rest state was also reviewed.
- One bounded fix was applied in `components/SessionComposer.tsx`: the skipped
  block checkbox label now uses a `44px` minimum height and pointer cursor.
  Confirmation measured all checkbox label hit areas at least `44px`.
- `pnpm test` (175), `pnpm lint`, `pnpm build`, `git diff --check`, and the
  focused Impeccable detector over the changed authenticated-app seams all pass;
  the build retains the existing middleware-to-proxy deprecation warning.
- Evidence is retained outside the worktree at
  `/tmp/opencode/tempo-browser-evidence/acceptance.json`,
  `/tmp/opencode/tempo-browser-evidence/confirmation.json`, and the generated
  route screenshots.
- The remaining Coach Planner, comparison, loading/error, month-source, and
  public-sharing work is deferred per the owner's instruction and is not part
  of this completion record.
