# Athlete Flow, Week View, and Template Polish Design

**Date:** 2026-06-16  
**Status:** Assumed approved for autonomous execution

## Goal

Improve the next three product slices in this order:

1. Athlete onboarding and profile flow
2. Athlete week-view UX
3. Coach template workflow

The intent is to remove friction from the athlete journey first, then make week navigation clearer, then speed up coach template reuse without widening the product surface.

## Problem

The current app has the core flows in place, but a few high-friction edges remain:

- Athletes can send a request, but the request flow is split across `/athlete/find-coach` and `/athlete/profile` with limited feedback in the search experience.
- Rejected requests are visible on the profile page, but the app does not make retrying or understanding next steps especially smooth.
- Athlete week navigation already exists, but the page does not clearly distinguish the viewed week from the current week or provide a fast return path.
- Coach templates support create/edit/delete, but the library is still a little slow to reuse when a coach wants to start from an existing template.

## Recommended approach

Keep the current service-oriented architecture and improve each surface in place instead of introducing new route groups, state managers, or schema changes.

- Put onboarding behavior changes behind `lib/coach-request-service.ts` and `lib/athlete-service.ts`.
- Keep athlete week reads server-driven from `app/athlete/page.tsx` and `components/AthleteWeekView.tsx`.
- Keep template persistence in `lib/template-service.ts` and expose any new mutation through the existing coach template API area.

This is better than adding new workflow models or a larger navigation refactor because the existing seams are already good enough for focused UX improvements.

## Scope

### 1. Athlete onboarding polish

- Show the athlete's current coach-request state inside the search flow, not only on the profile page.
- Prevent confusing repeated submissions while a request is pending.
- Allow a rejected request to the same coach to be re-sent instead of leaving the athlete permanently blocked by the `(athleteId, coachId)` uniqueness rule.
- Keep the profile page as the canonical waiting-state surface, but make the find-coach page better at explaining what just happened after a request is sent.

### 2. Athlete week-view polish

- Add a stronger week identity in the athlete header and weekly note area so the user always knows which week they are reading.
- Add a fast “back to this week” action when the athlete is browsing a past or future week.
- Make the initial selected day in `AthleteWeekView` feel smarter: use today when the viewed week contains today, otherwise prefer the first day with sessions, then fall back to the first day of the week.
- Preserve navigation affordances even when a viewed week is empty.

### 3. Coach template workflow polish

- Add a duplicate-template action so coaches can branch an existing template into a new one without editing the original.
- Improve library browsing with a lightweight client-side filter so larger template lists remain usable.
- Keep reuse centered on the existing template library and planner “create from template” flow.

## Phase design

### Phase 1: Onboarding

#### Data and service behavior

- Extend `coachRequestService.createForAthlete()` so:
  - a pending request for the same coach still returns a conflict,
  - a rejected request for the same coach is re-opened by setting it back to `PENDING`,
  - invalid coach ids still return a `404`.
- Extend `athleteService` with a read that can power both `/athlete/profile` and `/athlete/find-coach` with the latest request state.

#### UI behavior

- `/athlete/profile` remains the primary “waiting for coach approval” page.
- `/athlete/find-coach` gains a request-state banner and better button states:
  - pending request to this coach → disabled “Request pending”
  - rejected previous request to this coach → “Send request again”
  - newly submitted request → success feedback and a clear link back to profile

This keeps the athlete from wondering whether the request worked and removes the current dead-end feeling after rejection.

### Phase 2: Athlete week view

#### Page-level behavior

- Show the viewed week range in the page copy, not only inside the content card.
- Add a “This week” action when `weekStart` is not the current Monday-based week.
- Keep previous/next week actions where they already are.

#### Component behavior

- Update `AthleteWeekView` so default day selection uses:
  1. today, if the viewed week contains today
  2. the first day with one or more sessions
  3. the first day in the week

This avoids landing on an empty Monday in future or past weeks when the meaningful workout is later in the week.

### Phase 3: Templates

#### Service and API behavior

- Add a `duplicateForCoach()` method to `templateService` that clones the template row plus blocks after confirming coach ownership.
- Expose duplication through the existing coach template API surface instead of creating a new page.

#### UI behavior

- Add a duplicate action on each template card.
- Add a simple text and/or sport filter in `CoachTemplatesClient`.
- Keep the existing create/edit drawer intact so duplication becomes a fast starting point, not a separate editor mode.

## File map

| Area | Likely files |
|---|---|
| Athlete onboarding | `app/athlete/profile/page.tsx`, `app/athlete/find-coach/page.tsx`, `app/api/athlete/coach-requests/route.ts`, `lib/athlete-service.ts`, `lib/coach-request-service.ts` |
| Athlete week view | `app/athlete/page.tsx`, `components/AthleteWeekView.tsx`, possibly small shared UI helpers |
| Templates | `app/coach/templates/CoachTemplatesClient.tsx`, `app/api/coach/templates/route.ts`, `app/api/coach/templates/[templateId]/route.ts`, `lib/template-service.ts` |

## Error handling

- Keep request errors explicit in API responses and surface them in the existing UI instead of silently swallowing failures.
- Preserve ownership checks for template mutations and coach-request mutations.
- Treat invalid ids and unauthorized access the same way current route handlers already do.

## Validation

- Use the existing `node --test` suite for targeted regression checks where relevant.
- Run `pnpm lint` and `pnpm build` after the feature sequence is complete.

## Expected outcome

After this work:

- athletes will understand where they are in the coach-request process and can recover from rejection more cleanly,
- athlete week browsing will feel more anchored and easier to navigate,
- coaches will be able to reuse templates faster without manual recreation.
