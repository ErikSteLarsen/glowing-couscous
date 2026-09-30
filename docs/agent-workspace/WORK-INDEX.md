# Work index

Capability-to-owner lookup. Priority belongs in [PRODUCT.md](../../PRODUCT.md),
boundaries in [ARCHITECTURE.md](../../ARCHITECTURE.md), evidence/open gates in
[CURRENT-STATUS.md](CURRENT-STATUS.md).

`shipped` means implemented with recorded evidence, not complete production/device
certification. `in-progress` means an important gate remains. `transitional`
means compatibility code, not the extension point for new work.

## Capabilities

| ID | Area | Status | Primary owners | Main entry points |
|---|---|---|---|---|
| `AUTH-001` | Authentication and dormant role compatibility | `shipped` | `auth.ts`, `middleware.ts`, `lib/auth-session.ts`, `lib/api-auth.ts`, `lib/password-reset-service.ts` | `/login`, `/signup`, `/setup`, `/forgot-password`, `/reset-password`, `/api/auth/*` |
| `ACCOUNT-001` | Account controls and bounded training export | `in-progress` | `lib/account-service.ts`, `lib/account-export-service.ts`, `components/AccountControls.tsx`, `/api/account/*` | `/profile`; sign-in capability, credential recovery, connection access, downloads and session revocation; deletion/public trust/auth hardening gates remain |
| `RECOVERY-001` | Browser draft and Live checkpoint recovery | `in-progress` | `lib/draft-recovery.ts`, `components/useDraftRecovery.ts`, `components/DraftRecoveryNotice.tsx`, `lib/profile-recovery.ts`, `lib/workout-recovery.ts`, `lib/live-recovery.ts`, `WorkoutSaveRequest`, `lib/workout-library-service.ts` | Profile, workout authoring and Live; independent writers, restore/discard, revision conflicts, duplicate-safe creation and paused checkpoints; rollout/device/failure gates remain |
| `SHELL-001` | Unified personal shell, saved theme, collapsible desktop menu, and mobile drawer | `shipped` | `components/AppShell.tsx`, `components/AppSidebar.tsx`, `components/ui.tsx` (`TopBar`, `BackControl`), `app/globals.css`, `lib/app-navigation.ts` | Authenticated `(app)` layout; persisted desktop icon controls, mobile bottom-bar menu access, horizontal swipe and focus-managed drawer |
| `DESIGN-001` | Production Monolith system | `shipped` | `DESIGN.md`, `app/globals.css`, `app/monolith.css`, `components/FocusHome.tsx`, `components/FocusWorkouts.tsx` | Shared authenticated shell and route families; accepted browser coverage limits are in `CURRENT-STATUS.md` |
| `HOME-001` | Personal Home overview | `shipped` | `app/(app)/athlete/page.tsx`, `components/FocusHome.tsx`, `components/HomeTrainingReadouts.tsx`, `components/AthleteHomeContent.tsx` (prior composition), `lib/athlete-service.ts`, `lib/home-summary.ts` | `/athlete`; current day, separate scheduled/completed week summaries, last outcome and proportional recent estimated load; current browser gate is in CURRENT-STATUS.md |
| `COACH-001` | Dormant coach roster and requests | `transitional` | `lib/coach-service.ts`, `lib/coach-request-service.ts` | Current middleware redirects coach/discovery pages; APIs retain role guards |
| PLAN-001 | Personal planning and secondary coach planning | shipped | app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx, components/PlannerDesk.tsx, components/tempo/SessionRow.tsx, components/tempo/SessionIntensitySwatch.tsx, lib/session-intensity.ts, lib/coach-planner-service.ts, lib/athlete-planner-service.ts, lib/assignment-service.ts | /coach/planner, /athlete/planner, /athlete/calendar |
| `LIB-001` | Owner-scoped workout libraries | `shipped` | `lib/workout-library-service.ts`, `lib/coach-session-library-service.ts`, `components/WorkoutLibraryClient.tsx`, `components/FocusWorkouts.tsx` | `/coach/workouts`, `/athlete/workouts` |
| `AI-WORKOUT-001` | Guided athlete workout creator | `in-progress` | `lib/guided-workout.ts`, `lib/guided-workout-service.ts`, `lib/workout-llm.ts`, `components/GuidedWorkoutForm.tsx`, `components/WorkoutLibraryClient.tsx` | `/athlete/workouts`, `/api/athlete/workouts/generate`, `/api/athlete/workouts/ai-status`; validated model-authored drafts, shared provider health cache, and keyless fallback work; live model and authenticated browser acceptance remain |
| `TEMPLATE-001` | Templates and training plans | `in-progress` | `lib/template-service.ts`, `lib/coach-training-plan-service.ts` | `/coach/templates`, `/athlete/templates` |
| SESSION-001 | Canonical editor and outcomes | in-progress | lib/session-editor.ts, lib/athlete-execution.ts, lib/athlete-service.ts, lib/workout-canvas-drop.ts, lib/workout-pattern.ts, lib/workout-zone-intensity.ts, lib/intensity-color.ts, lib/profile-training-zones.ts, lib/performance-profile.ts, lib/account-service.ts, components/WorkoutBuilder.tsx, components/WorkoutCanvasEditor.tsx, components/SessionPlanCanvas.tsx, components/tempo/SessionBlockBar.tsx, components/WorkoutLibraryClient.tsx, lib/session-snapshot-service.ts, lib/athlete-completion-service.ts | Profile, read-only session detail, timed live execution, workout canvas, outcome APIs; profile-backed zones, target adjustments, and continuous five-color intensity ramp |
| `ACTIVITY-001` | Activity import, removal, filtered history, and outcome review | `in-progress` | `lib/activity-file-parser.ts`, `lib/activity-import-service.ts`, `lib/activity-series.ts`, `components/tempo/ActivityIntensityBars.tsx`, `components/ImportedActivityMeasurements.tsx`, `components/ActivityImportClient.tsx`, `components/ActivityHistoryOverview.tsx`, `components/tempo/SessionRow.tsx`, `lib/athlete-service.ts`, athlete session detail page, `app/(app)/athlete/activity/page.tsx` | `/athlete/activity` week/month summaries and sport-filtered completed-work history; shared `/athlete/import` page (legacy `/athlete/imported-activities` redirects) and `/api/activity-imports`; imported activity measurements and single-column no-plan detail in athlete Calendar/session detail |
| `STRAVA-001` | Automatic Strava API sync and activity notifications | `in-progress` | `lib/strava-service.ts`, `lib/strava-inbox-service.ts`, `app/api/strava/*`, `components/StravaImportPanel.tsx`, `components/StravaActivityNotifications.tsx`, `components/AppShell.tsx` | OAuth, leased retries, app-entry/live notifications, >2 activity batch list with bulk add/dismiss and individual matching, and durable dismiss/restore; live provider acceptance remains |
| `SHARE-001` | Sanitized workout sharing | `in-progress` | `lib/share-link.ts`, `lib/share-link-service.ts` | `/share/[token]`, share APIs |
| `COMPAT-001` | Older coach session adapter | `transitional` | `lib/planner-service.ts` | `/api/coach/sessions/[sessionId]` |


## Active work

- [Trustworthy account controls, recoverable work and truthful Home](tasks/2026-09-30-account-recovery-home.md) — Home, workout/Profile/Live recovery and initial Account controls implemented; deletion, public trust facts, auth hardening and remaining acceptance are open.

## Task lifecycle

Use [tasks/TEMPLATE.md](tasks/TEMPLATE.md) for active multi-step work and link it
here. Keep goal, owners, next steps and blockers concise. On completion/deferral,
put durable rules in their contract and unresolved gates in CURRENT-STATUS.md,
then remove the brief. Do not create completed-task/handoff/decision archives.
Small isolated changes need no brief.
