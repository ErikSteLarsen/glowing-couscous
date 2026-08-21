# Feature: Regression Coverage

- **ID:** `COVERAGE-001`
- **Status:** `planned`
- **Last verified:** `2026-08-21`
- **Owner:** `tests/` plus the service modules they exercise
- **Related work:** [current status](../CURRENT-STATUS.md), [product roadmap](../../../SPEC.md)

## Contract

Central service boundaries and route authorization should have focused tests so
future agents can change behavior without relying only on source inspection,
lint, or a successful build.

## Existing Coverage

- Planner draft, planner services, library sessions, training plans, templates,
  assignments, coach reads, calendar shaping, session math, preferences, shell,
  navigation, layout, and architecture boundaries have focused tests.
- The current command runs 84 tests with no failures.

## Planned Coverage

- Auth.js callbacks and role guard outcomes.
- Signup and setup validation/persistence.
- Coach-request service edge cases and route responses.
- Completion persistence, undo, and ownership behavior.
- API contract tests for the active planner/library/training-plan routes.

## Extension Rules

- Prefer factory-injected service tests with small fake DB interfaces, matching
  the existing test style.
- Add a regression test when an ownership, date, weekday, or status rule changes.
- Record the command and result in the feature record and history.
