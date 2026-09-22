# Task: Unified personal workspace first shipment

- **Status:** `in-progress`
- **Agent:** `Codex`
- **Started:** `2026-09-22`
- **Updated:** `2026-09-22`
- **Capability IDs:** `AUTH`, `SHELL`, `PERSONAL-TRAINING`

## Goal

Every signed-in account enters the same personal training workspace without seeing or choosing a coach/athlete role, while coach discovery and collaboration surfaces remain hidden for a later release.

## Plan

- [ ] Remove role choice and role-labelled interface from signup, setup, navigation, profile, settings, and session surfaces.
- [ ] Route every signed-in account through the personal workspace and allow both stored legacy roles to use its pages and APIs.
- [ ] Preserve dormant coach data and implementation paths without exposing coach discovery or roster navigation.
- [ ] Add regression coverage and run the full verification gates.

## Progress

### 2026-09-22

- Change: Started the unified-workspace release pass.
- Decision or discovery: Keep the persisted role field as compatibility data, but make the athlete route family the single shipped personal workspace.
- Files: Authentication, shell/navigation, personal routes/services, profile/settings, tests, and current workspace documentation.
- Verification: Pending.
- Next step: Implement access and presentation changes, then verify.

## Completion

- **Final status:** `deferred`
- **Current docs updated:** Pending.
- **Remaining work:** Implementation and verification.
