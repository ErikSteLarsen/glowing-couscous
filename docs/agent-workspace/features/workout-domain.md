# Feature: Structured Workout Domain

- **ID:** `DOMAIN-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-25`
- **Owner:** `lib/tempo-blocks.ts`, `lib/session-math.ts`, `lib/planner-draft.ts`, `lib/session-editor.ts`, `lib/sport.ts`
- **Related work:** [baseline](../history/2026-08-21-baseline.md), [schema](../../../prisma/schema.prisma)

## Contract

Workout content is a sequence of typed blocks with a zone, duration, optional
repetitions, target range, and note. Derived duration, TSS, zone distribution,
and visual segments come from those blocks.

## Live Path

- **Data:** `Block` rows on `Session` and `Template`; `sportMetricsJson` stores optional sport thresholds.
- **Types:** `TempoBlock`, `TempoBlockKind`, `TempoZone`, target types, `SPORT_OPTIONS`.
- **Derivation:** `deriveSessionMetrics` totals duration, applies zone factors
  for TSS, and creates colored segments.
- **Draft:** `planner-draft` normalizes, edits, serializes, and validates active planner drafts.

## Behavior Already Implemented

- Five zones have shared labels, colors, tints, and factors.
- Supported sports are running, biking, swimming, strength, stretching, and rest.
- Active block kinds are warmup, work, recovery, and cooldown.
- Planner validation requires positive duration and complete non-inverted target ranges.
- The canonical session editor preserves Tempo-compatible non-skipped blocks,
  represents skipped blocks explicitly, and derives metrics through
  `session-math`.

## Verification

- `tests/session-math.test.ts`, `tests/planner-draft.test.ts`,
  `tests/session-editor.test.ts`, and template tests pass on 2026-08-25.
- `pnpm lint && pnpm build` — pass on 2026-08-21.

## Known Gaps

- Domain strings are validated in code rather than represented as Prisma enums because SQLite is used.
- The older `planner.ts` / `workout-spec.ts` shape remains for compatibility and uses legacy block names.

## Extension Rules

- Add shared domain values here before duplicating labels or magic strings.
- Derive metrics from blocks and keep persistence transforms separate from UI drafts.
- Preserve the active Tempo block contract when adding new services.
