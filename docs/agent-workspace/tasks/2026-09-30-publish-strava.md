# Task: Publish Strava activity notifications

- **Status:** `in-progress`
- **Owner:** Codex, Strava chat
- **Started / updated:** 2026-09-30 / 2026-09-30
- **Capabilities:** STRAVA-001

## Goal and scope

Publish the verified Strava notification implementation to the existing
production deployment. Preserve independently staged documentation work and
all existing activity deletion behavior.

## Next steps

- [ ] Recheck tests, lint, bundle, and additive migration.
- [ ] Commit only Strava implementation/evidence files and push main.
- [ ] Verify the corresponding Vercel deployment and production callback.

## Current evidence and blockers

User confirms webhook registration is configured and authorizes production
publication. Separate documentation consolidation is staged in this checkout;
it must remain intact and must not be included incidentally in this commit.

## Finish

Record actual publication result in current status/index, remove this brief.
