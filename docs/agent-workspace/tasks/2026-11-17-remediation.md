# Task: Resolve remaining maintenance findings

- **Status:** `in-progress`
- **Owner:** Codex with navigation and dependency agents
- **Started / updated:** 2026-11-17 / 2026-11-17
- **Capabilities:** AUTH-001, ACCOUNT-001, SHARE-001

## Goal and scope

Eliminate seven navigation lint warnings while preserving auth/cache boundaries,
and remediate the remaining deepmerge-ts dependency advisory with evidence.
Keep significant steps independently verified and committed. Distinguish fixes
from provider/device acceptance that needs external access.

## Next steps

- [ ] Fix and verify navigation behavior, then commit.
- [ ] Assess, implement and verify supported dependency remediation, then commit.
- [ ] Update current status and remove this brief.

## Current evidence and blockers

Clean starting checkpoint f6a6c32. Previous code baseline:455 DB-enabled tests,
2 Chromium component checks, type/deadcode/build pass. No issue is being
suppressed; dependency remediation must exercise Prisma config and DB behavior.
