# App Shell Navigation Design

**Date:** 2026-06-18  
**Status:** Draft written from approved design conversation

## Goal

Move signed-in app from centered page stack to consistent application shell with:

- persistent left navigation on desktop,
- drawer navigation on small screens,
- role-aware menu options,
- profile and settings access,
- built-in sign out,
- clear separation between global navigation and local back navigation.

## Problem

Current signed-in flow feels fragmented:

- navigation lives inside page headers and ad hoc action buttons,
- sign out repeats across screens,
- “back” behavior is inconsistent between global movement and nested detail flow,
- main content often sits in a narrow centered column, which makes the product feel more like a single-page card than a full app shell.

This creates navigation friction for both coach and athlete users and makes new screens harder to add without more drift.

## Recommended approach

Adopt one shared signed-in shell across coach and athlete routes, with role-aware navigation inside the shell rather than separate shells per section.

Why this approach:

- best consistency across current and future signed-in pages,
- lowest long-term drift risk,
- matches existing route model without requiring schema changes,
- still allows role-specific menu items and settings sections.

Rejected alternatives:

1. **Slim nav rail** — saves horizontal space but hurts discoverability and clarity for mixed role-based navigation.
2. **Separate shells per role or section** — increases flexibility, but reintroduces inconsistency through duplicated layout logic.

## Scope

### In scope

- New shared signed-in layout wrapper for non-auth app routes
- Desktop sidebar + mobile drawer
- Role-aware primary navigation
- Shared `/profile` entry point for both roles
- Shared `/settings` entry point for both roles
- Shared sign-out placement in shell
- Clear rule for contextual back links on detail pages
- Wider main content shell for signed-in pages

### Out of scope

- Changing domain data models or Prisma schema
- Reworking planner or template business logic
- Introducing new major feature areas beyond navigation and settings structure
- Redesigning login, signup, or setup flows
- Persisting new profile metrics or system-preference fields beyond data already available today

## Shell architecture

### Route model

- Keep auth pages under the existing auth route group.
- Add signed-in route grouping, for example `(app)`, so coach and athlete pages render inside one app shell layout.
- Shell should cover current signed-in routes such as:
  - `/coach`
  - `/coach/templates`
  - `/coach/athletes/[athleteId]`
  - `/athlete`
  - `/athlete/find-coach`
  - `/profile`
  - `/settings`
  - existing `/athlete/profile` should become compatibility redirect to `/profile`

### Layout structure

- Root layout keeps global providers only.
- Signed-in layout loads current user once and renders:
  1. sidebar or drawer navigation,
  2. profile block with `Profile`, `Settings`, and `Sign out` actions,
  3. main content region for page-local content.
- Main content area becomes full app canvas rather than a narrow centered stack.
- Existing `PageShell` remains useful inside page content, but no longer defines whole-app framing.

### Likely shared components

| Component | Responsibility |
|---|---|
| `components/AppShell.tsx` | Main signed-in frame, responsive two-column layout, mobile drawer state |
| `components/AppSidebar.tsx` | Role-aware nav groups, active item styling, profile block slot |
| `components/AppNav.tsx` | Pure nav item rendering from role-aware config |
| `components/AppProfileMenu.tsx` or similar | User summary plus `Profile`, `Settings`, and sign-out actions |
| Small page-level helper for contextual back link | Nested-flow return affordance near page header |

## Navigation model

### Global navigation rules

- Sidebar owns movement between top-level app areas.
- Profile block owns `Profile`, `Settings`, and `Sign out`.
- Page headers stop carrying global navigation actions like templates, profile, or sign out.
- Sign out moves to one consistent place in the profile block.
- Active state reflects current route or route family.

### Coach navigation

- Dashboard
- Templates

Nested pages like `/coach/athletes/[athleteId]` are contextual views, not primary nav items. They should keep `Dashboard` active in sidebar while showing a local back link to the dashboard.

### Athlete navigation

- Week plan
- Coach discovery

If an athlete does not yet have a coach or week plan, keep the shell structure intact. The athlete should still be able to open coach discovery, search coaches, view minimal information for each coach, and see a clear “messaging coming soon” affordance without a live messaging flow yet.

If an athlete already has an active coach, hide coach discovery from sidebar navigation. Changing coaches should be a separate future flow that first resigns the current coach relationship before allowing a new application. Direct navigation to `/athlete/find-coach` in this state should redirect back to `/athlete`.

Route behavior for incomplete athlete setup:

- `/athlete` without active coach context should redirect to `/athlete/find-coach`.
- Pending or rejected coach-request state remains owned by the coach-discovery area rather than profile or settings.

## Profile and settings design

- Add one shared `/profile` page and one shared `/settings` page.
- Use same overall page structure for coach and athlete users.
- Render role-specific sections within each page instead of creating unrelated role-specific page types.

### Profile

Profile owns user-specific training or identity details.

Shared profile structure:

- account summary,
- editable fields only where current persisted data already exists,
- clearly labeled placeholder rows for future richer fields,
- clear separation from system/app preferences.

V1 profile content:

- **Both roles:** editable display name, read-only email, read-only role label.
- **Athlete:** small coach-status summary plus placeholder presentation for future items like weight, height, and FTP.
- **Coach:** placeholder presentation for future coach-facing profile details such as bio and specialties.

### Settings

Settings owns app-level preferences rather than training profile data.

V1 settings content:

- no new persisted preference fields in this project,
- shell-ready settings page with non-destructive account/app sections,
- placeholder presentation for future preferences such as metric/imperial behavior, kilometer display, and notification preferences.

Coach discovery stays in its own primary app area rather than inside profile or settings.

This keeps the mental model unified while separating “who I am” from “how app behaves.”

### Athlete state ownership

| Athlete state | `/athlete` | `/profile` | `/athlete/find-coach` |
|---|---|---|---|
| No coach yet | Redirect to coach discovery | Show profile fields + small status summary + link to discovery | Primary action area for search and coach exploration |
| Request pending | Redirect to coach discovery | Show profile fields + pending summary + link to discovery | Primary status page with waiting-state messaging |
| Request rejected | Redirect to coach discovery | Show profile fields + rejected summary + link to discovery | Primary recovery page for retry/search |
| Active coach | Show week plan | Show profile fields | Hidden from sidebar; future coach-change flow requires resign-first behavior |

## Back-navigation rules

- Sidebar is for lateral movement across major app areas.
- Detail pages get one contextual back link near the page header or content header.
- Remove redundant “back” buttons when they duplicate the sidebar or browser history.
- Preserve page-local controls that are not navigation, such as week switching or editor actions.

Examples:

- `/coach/athletes/[athleteId]` shows `Back to dashboard`.
- `/athlete/find-coach` is a primary sidebar destination, so it does not need a contextual back link by default.
- `/profile` and `/settings` are profile-block destinations, so they do not need contextual back links by default.
- `/coach/templates` likely needs no back link because it is primary sidebar navigation.

## Responsive behavior

- `lg+`: fixed desktop sidebar, independent main-content scrolling.
- Small screens: menu button opens drawer containing same nav items and profile block.
- Drawer closes on navigation.
- No separate mobile information architecture; only presentation changes.

## Data flow and ownership

- Signed-in layout uses `getCurrentUser()` as the source of truth for user identity and role.
- Navigation config derives from user role plus current pathname.
- Add small shared account-facing service module, such as `lib/account-service.ts`, to own profile/settings reads and writes instead of pushing that logic into pages.
- Route handlers keep role guards in `lib/api-auth.ts`; shell does not replace authorization.

## Error handling

- Missing or invalid signed-in user keeps existing redirect behavior.
- Shell must not render broken links for unavailable role states.
- Sign-out failures remain visible where the user triggered sign out.
- Existing `/athlete/profile` should remain safe during migration by redirecting to `/profile` instead of breaking.
- Profile and settings pages should surface unavailable data as explicit empty/error states consistent with current UI patterns.

## File map

| Area | Likely files |
|---|---|
| Signed-in shell | `app/layout.tsx`, new signed-in route layout, `components/ui.tsx`, new shell components |
| Coach pages | `app/coach/page.tsx`, `app/coach/templates/page.tsx`, `app/coach/athletes/[athleteId]/page.tsx` |
| Shared profile/settings | new `/profile` page, new `/settings` page, redirect handling from `app/athlete/profile/page.tsx` |
| Athlete pages | `app/athlete/page.tsx`, `app/athlete/find-coach/page.tsx` |
| Shared auth/user data | `lib/auth-session.ts`, possibly small nav config helper |

## Implementation notes

- Prefer route-group layout composition over repeating shell markup inside pages.
- Keep page-local action slots so pages can still expose controls like week switching, create session, or search actions without polluting global navigation.
- Reuse existing shared visual primitives where possible, but add shell-specific components if current `TopBar`/`PageShell` abstractions become overloaded.
- Avoid direct Prisma reads in new page logic when behavior belongs in existing services.

## Validation

- Signed-in pages render inside one consistent shell.
- Desktop sidebar and mobile drawer show same role-aware nav items.
- Global sign out appears once in shared shell.
- Contextual back links appear only on nested/detail pages.
- Main signed-in content uses wider layout than current centered shell.
- `/profile` and `/settings` are distinct destinations with clear responsibility split.
- Existing role redirects and page-specific actions keep working.

## Expected outcome

After implementation:

- app navigation feels like one product instead of isolated centered screens,
- coach and athlete users can move predictably through top-level areas,
- nested pages have clearer return paths,
- profile, settings, and sign out live in durable, easy-to-find places with clearer ownership.
